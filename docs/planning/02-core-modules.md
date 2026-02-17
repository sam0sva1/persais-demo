# Секция 2: Core Modules (NestJS)

## Scope
Неизменяемое ядро системы - модули NestJS, которые НЕ редактируются Механиком.

---

## Архитектура модулей

```
src/
├── app.module.ts              # Root module
├── main.ts                    # Bootstrap
│
├── core/                      # IMMUTABLE - не трогает Механик
│   ├── telegram/
│   │   ├── telegram.module.ts
│   │   ├── telegram.controller.ts
│   │   ├── telegram.service.ts
│   │   ├── guards/
│   │   │   └── auth.guard.ts
│   │   └── handlers/
│   │       └── emergency.handler.ts
│   │
│   ├── gitops/
│   │   ├── gitops.module.ts
│   │   ├── gitops.service.ts
│   │   └── interfaces/
│   │
│   ├── coder/
│   │   ├── coder.module.ts
│   │   ├── coder.service.ts    # Aider wrapper
│   │   └── template.service.ts
│   │
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── drizzle.provider.ts
│   │   └── schema-loader.ts
│   │
│   └── orchestrator/
│       ├── orchestrator.module.ts
│       ├── orchestrator.service.ts
│       ├── graph/
│       │   ├── state.ts
│       │   └── nodes/
│       └── agents/
│           └── mechanic/
│
├── dynamic/                   # MUTABLE - создаётся Механиком
│   ├── agents/
│   ├── tools/
│   ├── schema/
│   └── migrations/
│
└── shared/
    ├── config/
    ├── utils/
    └── types/
```

---

## Module 1: TelegramModule

### Ответственность
- Webhook endpoint для Telegram
- Парсинг и маршрутизация сообщений
- Emergency команды (bypass AI)
- Auth guard (whitelist user IDs)

### Компоненты

```typescript
// telegram.controller.ts
@Controller('telegram')
export class TelegramController {
  @Post('webhook')
  async handleWebhook(@Body() update: Update) {}
}

// telegram.service.ts
export class TelegramService {
  async sendMessage(chatId: number, text: string): Promise<void> {}
  async sendWithKeyboard(chatId: number, text: string, keyboard: InlineKeyboard): Promise<void> {}
}

// guards/auth.guard.ts
export class TelegramAuthGuard implements CanActivate {
  // Check if user ID is in whitelist
}

// handlers/emergency.handler.ts
export class EmergencyHandler {
  // /rollback, /status, /reset - bypass AI
}
```

### Emergency Commands (Hardcoded)

| Команда | Действие | Bypass AI |
|---------|----------|-----------|
| `/status` | Диагностика системы | ✅ |
| `/rollback <hash>` | Git revert + push | ✅ |
| `/reset` | Сброс контекста агента | ✅ |
| `/abort` | Удаление текущей feature branch | ✅ |
| `/deploy` | Merge feature branch → main | ✅ |

---

## Module 2: GitOpsModule

### Ответственность
- Обёртка над `simple-git`
- Все операции с Git
- Атомарность операций

### Interface

```typescript
export interface IGitOpsService {
  // Branch operations
  createBranch(name: string): Promise<void>;
  checkoutBranch(name: string): Promise<void>;
  deleteBranch(name: string): Promise<void>;
  getCurrentBranch(): Promise<string>;

  // Commit operations
  stageFiles(files: string[]): Promise<void>;
  commit(message: string): Promise<string>; // returns commit hash
  push(branch?: string): Promise<void>;

  // History
  getDiff(from?: string, to?: string): Promise<string>;
  getLog(limit?: number): Promise<Commit[]>;

  // Recovery
  revert(commitHash: string): Promise<void>;
  reset(mode: 'soft' | 'hard', ref: string): Promise<void>;
}
```

### Важные детали
- **Lock mechanism**: Только один git-процесс одновременно
- **Retry logic**: При network errors
- **Logging**: Все операции логируются

---

## Module 3: CoderModule

### Ответственность
- Запуск Aider как subprocess
- Управление контекстом (файлы в scope)
- Инъекция шаблонов
- Timeout и error handling

### Interface

```typescript
export interface ICoderService {
  // Main execution
  runTask(options: CoderTaskOptions): Promise<CoderResult>;

  // Context management
  setContextFiles(files: string[]): void;
  addContextFile(file: string): void;
  clearContext(): void;

  // Templates
  injectTemplate(templateName: string, targetPath: string): Promise<void>;
}

interface CoderTaskOptions {
  instruction: string;
  files: string[];          // Files to edit
  readOnlyFiles?: string[]; // Files for context only
  maxRetries?: number;
  timeout?: number;
}

interface CoderResult {
  success: boolean;
  filesChanged: string[];
  output: string;
  errors?: string[];
}
```

### Aider Integration

```typescript
// Запуск Aider
const aiderProcess = spawn('aider', [
  '--yes-always',           // Auto-accept changes (???)
  '--model', 'openrouter/anthropic/claude-3-opus',
  '--no-git',               // Git управляется нами
  '--message', instruction,
  ...files
], {
  cwd: '/workspace',
  env: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  }
});
```

---

## Module 4: DatabaseModule

### Ответственность
- Connection pool к Postgres
- Dynamic schema loading
- Drizzle ORM instance

### Drizzle Setup

```typescript
// drizzle.provider.ts
export const DrizzleProvider = {
  provide: 'DRIZZLE',
  useFactory: async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);
    return db;
  }
};

// schema-loader.ts
export async function loadDynamicSchemas() {
  const schemaFiles = await glob('src/dynamic/schema/*.ts');
  const schemas = {};
  for (const file of schemaFiles) {
    const schema = await import(file);
    Object.assign(schemas, schema);
  }
  return schemas;
}
```

### Core Tables

| Таблица | Назначение |
|---------|------------|
| `conversations` | История диалогов |
| `langgraph_checkpoints` | State persistence для LangGraph |
| `agents` | Registry динамических агентов |
| `tools` | Registry динамических tools |
| `audit_log` | Лог всех изменений кода |

---

## Module 5: AgentOrchestratorModule (LangGraph)

### Ответственность
- Управление графом агентов
- State management
- Маршрутизация сообщений
- Persistence через Postgres Checkpointer

### Graph Structure

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Classifier │
                    │    Node     │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Writer  │    │ Mechanic │    │ Dynamic  │
    │  Agent   │    │  Agent   │    │  Agent   │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         └───────────────┴───────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   Response  │
                  │  Formatter  │
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │    END      │
                  └─────────────┘
```

### State Schema

```typescript
interface OrchestratorState {
  // User context
  userId: number;
  chatId: number;

  // Conversation
  messages: Message[];

  // Agent context
  activeAgent: 'orchestrator' | 'mechanic' | 'writer' | string;
  agentMemory: Record<string, any>;

  // Mechanic specific
  currentBranch?: string;
  pendingChanges?: string[];

  // Meta
  lastActivity: Date;
  errorCount: number;
}
```

---

## Вопросы по Core Modules

### Критические

1. **Grammy vs nestjs-telegraf**:
   - Grammy более современный, но nestjs-telegraf лучше интегрируется
   - Какой выбрать?

2. **Aider flags**:
   - `--yes-always` — автоматически принимать все изменения?
   - Или нужен intermediate review?

3. **LangGraph persistence**:
   - PostgresSaver из `@langchain/langgraph-checkpoint-postgres`?
   - Или custom checkpointer?

4. **Hot reload**:
   - Как перезагружать dynamic schemas без рестарта?
   - Dynamic import достаточно?

### Важные

5. **Error handling strategy**:
   - Retry policy для AI calls?
   - Circuit breaker?

6. **Logging format**:
   - JSON structured logs?
   - Какой уровень детализации?

7. **Rate limiting**:
   - Нужен ли rate limit для Telegram?
   - Лимиты на AI API calls?

8. **Health checks**:
   - Какие checks нужны? DB, Git, Aider?

---

## Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^10.x",
    "@nestjs/core": "^10.x",
    "@nestjs/platform-express": "^10.x",
    "grammy": "^1.x",
    "drizzle-orm": "^0.29.x",
    "@langchain/langgraph": "^0.x",
    "@langchain/core": "^0.x",
    "simple-git": "^3.x",
    "zod": "^3.x",
    "pg": "^8.x",
    "@deepgram/sdk": "^3.x"
  }
}
```

---

## Definition of Done

- [ ] Все 5 core modules созданы и работают
- [ ] Telegram webhook принимает сообщения
- [ ] Emergency commands работают
- [ ] GitOps операции работают
- [ ] Aider запускается и выполняет простую задачу
- [ ] LangGraph state persistence работает
- [ ] Dynamic schema loading работает
- [ ] Unit tests для core modules (coverage > 80%)
