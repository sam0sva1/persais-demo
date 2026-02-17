# Секция 2a: Архитектура мультиагентной системы

## Scope
Детальное описание routing, shared state, взаимодействия агентов.

---

## Высокоуровневая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     MESSAGE FLOW                                 │
│                                                                  │
│  Telegram ──► Intent Classifier (cheap model) ──┬──► Current Agent
│                      │                          │
│                      │ "uncertain"              │ "confident"
│                      ▼                          │
│               Orchestrator ─────────────────────┘
│               (Master Agent)
│                      │
│                      │ set_active_agent tool
│                      ▼
│  ┌────────────────────────────────────────────────────────────┐
│  │                   SHARED STATE (Postgres)                   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  │ active_agent │  │ messages[]   │  │ llm_configs{}   │   │
│  │  │ = 'master'   │  │ (last 10)    │  │ per-agent       │   │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘   │
│  └────────────────────────────────────────────────────────────┘
│                      │
│          ┌───────────┼───────────────┐
│          ▼           ▼               ▼
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│  │ Master   │  │ Mechanic │  │ Dynamic      │
│  │(Orchestr)│  │  Agent   │  │ Agents       │
│  └──────────┘  └──────────┘  └──────────────┘
│        │             │               │
│        └─────────────┴───────────────┘
│                      │
│               return_to_master tool
│               switch_to_agent tool
│               (all agents have this)
│
└─────────────────────────────────────────────────────────────────┘
```

---

## Компоненты

### 1. Intent Classifier (Pre-Router)

**Модель:** Дешёвая и быстрая (Haiku / GPT-3.5)

**Input:**
- Текущий активный агент
- Новое сообщение пользователя
- Список доступных агентов с описаниями

**Output (Structured):**
```typescript
interface ClassifierResult {
  action: 'keep_current' | 'uncertain' | 'switch';
  suggested_agent?: string;  // if action === 'switch'
  confidence: number;        // 0-1
}
```

**Логика:**
- `keep_current` → сообщение идёт напрямую в текущего агента
- `uncertain` → сообщение идёт в Orchestrator (Master)
- `switch` → быстрое переключение без Orchestrator (только если высокая уверенность)

```typescript
// Пример промпта для классификатора
const classifierPrompt = `
You analyze user messages to route them efficiently.

Current active agent: {{activeAgent}}
Available agents:
{{#each agents}}
- {{name}}: {{description}}
{{/each}}

User message: {{message}}

Respond in JSON:
{
  "action": "keep_current" | "uncertain" | "switch",
  "suggested_agent": "agent_name or null",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}

Rules:
- If message clearly relates to current agent's domain → "keep_current"
- If message might need different agent but unclear → "uncertain"
- If message obviously needs specific different agent → "switch"
- When in doubt, choose "uncertain"
`;
```

---

### 2. Orchestrator (Master Agent)

**Модель:** Claude 3.5 Sonnet (или настраиваемо)

**Capabilities:**
- Отвечает на общие вопросы
- Знает о всех субагентах
- Может переключить routing на субагента
- Видит полную историю сообщений

**Tools:**
```typescript
// Tool: switch_to_agent
const switchToAgentTool = {
  name: 'switch_to_agent',
  description: 'Switch routing to a specific subagent for subsequent messages',
  schema: z.object({
    agent_name: z.string(),
    reason: z.string(),
    handoff_message: z.string().optional(), // Initial context for the agent
  }),
};
```

**System Prompt (structure):**
```markdown
You are the Master Orchestrator for Demiurge system.

## Your Role
- Answer general questions
- Route complex requests to specialized agents
- Maintain conversation context

## Available Agents
{{dynamically_loaded_from_registry}}

## When to Switch
- User explicitly asks for specific agent
- Task clearly belongs to agent's domain
- Current conversation needs specialization

## Important
- You have full conversation history
- After switching, messages go directly to that agent
- Agent will return control when done
```

---

### 3. Субагенты (Mechanic и динамические)

**Каждый субагент имеет:**

1. **Уникальный system prompt**
2. **Tools для работы**
3. **Tool для возврата управления:**

```typescript
const returnToMasterTool = {
  name: 'return_to_master',
  description: 'Return control to Master Orchestrator when task is complete or needs escalation',
  schema: z.object({
    reason: z.enum(['task_complete', 'need_other_agent', 'user_request', 'cannot_handle']),
    summary: z.string(), // Summary of what was done
    suggested_next_agent: z.string().optional(),
  }),
};
```

**Mechanic дополнительно имеет:**
```typescript
const updateAgentConfigTool = {
  name: 'update_agent_config',
  description: 'Update LLM configuration for any agent',
  schema: z.object({
    agent_name: z.string(),
    config: z.object({
      model: z.string().optional(),
      temperature: z.number().optional(),
      max_tokens: z.number().optional(),
      // other LLM params
    }),
  }),
};
```

---

## Shared State

### Schema

```typescript
// Postgres table for agent state
export const agentState = pgTable('agent_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: bigint('user_id', { mode: 'number' }).notNull().unique(),

  // Current routing
  activeAgent: varchar('active_agent', { length: 100 }).default('master'),

  // Conversation (last N messages)
  messages: jsonb('messages').$type<Message[]>().default([]),
  maxMessages: integer('max_messages').default(10),

  // Per-agent memory (agent-specific state)
  agentMemory: jsonb('agent_memory').$type<Record<string, any>>().default({}),

  // Metadata
  lastActivity: timestamp('last_activity').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent: string;        // Which agent responded
  timestamp: string;
  metadata?: {
    tools_used?: string[];
    routing_change?: string;
  };
}
```

### LLM Configs

```typescript
// Postgres table for LLM configurations
export const llmConfigs = pgTable('llm_configs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Target
  agentName: varchar('agent_name', { length: 100 }).notNull(),
  // 'classifier', 'master', 'mechanic', or dynamic agent name

  // OpenRouter config
  model: varchar('model', { length: 200 }).notNull(),
  // e.g., 'anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku'

  temperature: real('temperature').default(0.7),
  maxTokens: integer('max_tokens').default(4096),
  topP: real('top_p').default(1),

  // Structured output
  useStructuredOutput: boolean('use_structured_output').default(false),
  responseFormat: jsonb('response_format'), // JSON schema if SGR

  // Meta
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Default Configs

```typescript
const DEFAULT_LLM_CONFIGS = {
  classifier: {
    model: 'anthropic/claude-3-haiku',
    temperature: 0.1,
    maxTokens: 256,
    useStructuredOutput: true,
  },
  master: {
    model: 'anthropic/claude-3.5-sonnet',
    temperature: 0.7,
    maxTokens: 4096,
    useStructuredOutput: false,
  },
  mechanic: {
    model: 'anthropic/claude-3.5-sonnet',
    temperature: 0.3, // Lower for code tasks
    maxTokens: 8192,
    useStructuredOutput: true, // For planning outputs
  },
};
```

---

## Message Flow (Detailed)

### Flow 1: Message to Current Agent (Fast Path)

```
1. User sends message
2. Intent Classifier: "keep_current" (high confidence)
3. Skip Orchestrator
4. Send directly to current agent
5. Agent responds
6. Save message to history
```

### Flow 2: Message Needs Routing (Slow Path)

```
1. User sends message
2. Intent Classifier: "uncertain"
3. Send to Orchestrator with full context
4. Orchestrator decides:
   a) Answer directly → respond
   b) Switch agent → call switch_to_agent tool
5. If switched:
   a) Update shared state
   b) Optionally send handoff_message to new agent
   c) New agent processes
6. Save message to history
```

### Flow 3: Agent Returns Control

```
1. Subagent decides task is complete
2. Calls return_to_master tool
3. System updates activeAgent = 'master'
4. Summary added to context
5. Next message goes to Orchestrator
```

---

## LLM Client Factory

```typescript
// core/llm/llm-client.factory.ts

@Injectable()
export class LLMClientFactory {
  private clients = new Map<string, OpenRouterClient>();

  constructor(
    @Inject('DRIZZLE') private db: DrizzleDB,
    private configService: ConfigService,
  ) {}

  async getClient(agentName: string): Promise<OpenRouterClient> {
    // Check if we have a cached client
    const cached = this.clients.get(agentName);
    if (cached) return cached;

    // Load config from DB
    const config = await this.db.query.llmConfigs.findFirst({
      where: and(
        eq(llmConfigs.agentName, agentName),
        eq(llmConfigs.isActive, true),
      ),
    });

    if (!config) {
      // Use default config
      const defaultConfig = DEFAULT_LLM_CONFIGS[agentName] ||
                           DEFAULT_LLM_CONFIGS.master;
      return this.createClient(defaultConfig);
    }

    const client = this.createClient(config);
    this.clients.set(agentName, client);
    return client;
  }

  async refreshClient(agentName: string): Promise<void> {
    this.clients.delete(agentName);
    // Next getClient call will create fresh instance
  }

  private createClient(config: LLMConfig): OpenRouterClient {
    return new OpenRouterClient({
      apiKey: this.configService.get('OPENROUTER_API_KEY'),
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      // ... other params
    });
  }
}
```

---

## Telegram Integration

### Current Agent Display

```typescript
// Show in /status command
async function getStatusMessage(userId: number): Promise<string> {
  const state = await getAgentState(userId);
  const agentInfo = await getAgentInfo(state.activeAgent);

  return `
🤖 Текущий агент: ${agentInfo.displayName}
📝 Режим: ${agentInfo.description}

/switch - переключить агента
/reset - вернуться к Master
/agents - список агентов
  `;
}
```

### Agent Switching via UI

```typescript
// /agents command
async function showAgentsKeyboard(userId: number): Promise<InlineKeyboard> {
  const agents = await agentRegistry.getAll();

  return new InlineKeyboard()
    .text('🏠 Master', 'switch:master')
    .row()
    ...agents.map(a => keyboard.text(a.emoji + ' ' + a.name, `switch:${a.id}`).row());
}

// Callback handler
bot.on('callback_query:data', async (ctx) => {
  if (ctx.callbackQuery.data.startsWith('switch:')) {
    const agentName = ctx.callbackQuery.data.replace('switch:', '');
    await switchAgent(ctx.from.id, agentName);
    await ctx.answerCallbackQuery({ text: `Переключено на ${agentName}` });
  }
});
```

---

## CORE vs DYNAMIC

### Не изменяются Механиком (CORE):
- Intent Classifier
- Orchestrator (Master Agent)
- Mechanic Agent
- Routing logic
- LLM Client Factory
- Shared State management

### Создаются/изменяются Механиком (DYNAMIC):
- Новые субагенты (src/dynamic/agents/)
- Их tools (src/dynamic/tools/)
- Их schemas (src/dynamic/schema/)
- Конфигурации LLM (через update_agent_config tool)

---

## Вопросы (решённые)

| Вопрос | Решение |
|--------|---------|
| Intent Classifier в MVP? | Да, сразу |
| Какая модель для Classifier? | Haiku |
| Sticky vs Per-message routing? | Sticky |
| Где хранить state? | Postgres |
| Лимит сообщений | 10 (настраиваемо) |
| Может ли Mechanic менять LLM configs? | Да |
| Hub-spoke или Mesh? | Hub-spoke + explicit handoff |

---

## Definition of Done

- [ ] Intent Classifier работает
- [ ] Orchestrator роутит правильно
- [ ] Shared state сохраняется в Postgres
- [ ] Субагенты могут вернуть управление
- [ ] LLM configs можно менять через Mechanic
- [ ] Telegram показывает текущего агента
- [ ] Manual switch через Telegram работает
