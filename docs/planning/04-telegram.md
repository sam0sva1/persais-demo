# Секция 4: Telegram Interface

## Scope
Всё что связано с Telegram: бот, webhook, команды, UX, inline keyboards.

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        Telegram API                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Webhook POST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TelegramController                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  POST /telegram/webhook                                      ││
│  │       │                                                      ││
│  │       ▼                                                      ││
│  │  ┌──────────────┐                                           ││
│  │  │  AuthGuard   │──► Whitelist Check                        ││
│  │  └──────┬───────┘                                           ││
│  │         │                                                    ││
│  │         ▼                                                    ││
│  │  ┌──────────────────────────────────────────────────────┐   ││
│  │  │           Message Router                              │   ││
│  │  │  ┌────────────────┐  ┌────────────────────────────┐  │   ││
│  │  │  │ Emergency Cmds │  │    AI Orchestrator         │  │   ││
│  │  │  │ (/status, etc) │  │    (LangGraph)             │  │   ││
│  │  │  └────────────────┘  └────────────────────────────┘  │   ││
│  │  └──────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Grammy Setup

### Bot Initialization

```typescript
// telegram.module.ts
import { Bot } from 'grammy';

@Module({
  providers: [
    {
      provide: 'TELEGRAM_BOT',
      useFactory: () => {
        const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
        return bot;
      },
    },
    TelegramService,
  ],
  exports: ['TELEGRAM_BOT', TelegramService],
})
export class TelegramModule {}
```

### Webhook Controller

```typescript
// telegram.controller.ts
@Controller('telegram')
export class TelegramController {
  constructor(
    @Inject('TELEGRAM_BOT') private bot: Bot,
    private orchestrator: OrchestratorService,
    private emergencyHandler: EmergencyHandler,
    private telegramService: TelegramService,
  ) {}

  @Post('webhook')
  @UseGuards(TelegramAuthGuard)
  async handleWebhook(@Body() update: Update) {
    // Check for emergency commands first
    if (this.isEmergencyCommand(update)) {
      return this.emergencyHandler.handle(update);
    }

    // Pass to AI orchestrator
    return this.orchestrator.processMessage(update);
  }

  private isEmergencyCommand(update: Update): boolean {
    const text = update.message?.text || '';
    return ['/status', '/rollback', '/reset', '/abort', '/deploy']
      .some(cmd => text.startsWith(cmd));
  }
}
```

---

## Commands

### Emergency Commands (Bypass AI)

| Команда | Описание | Доступ |
|---------|----------|--------|
| `/status` | Диагностика системы (DB, Git) | All whitelisted |
| `/rollback <hash>` | Git revert + redeploy | Admin only |
| `/reset` | Сброс контекста текущего агента | All whitelisted |
| `/abort` | Удалить текущую feature branch | All whitelisted |
| `/deploy` | Merge feature branch → main | Admin only |

### Context Commands (AI-Routed)

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + help |
| `/mechanic` | Переключиться на агента Механика |
| `/write` | Переключиться на писательского помощника |
| `/help` | Показать доступные команды |

---

## User Context Management

### Shared State (Postgres)

Состояние хранится в таблице `agent_state` (см. [02a-agent-architecture.md](./02a-agent-architecture.md)):
- `active_agent` — текущий активный агент
- `messages[]` — история сообщений (последние 10)
- `agent_memory` — per-agent состояние
- `current_branch` — текущая feature branch (для Mechanic)

### Context Service

```typescript
@Injectable()
export class UserContextService {
  constructor(@Inject('DRIZZLE') private db: DrizzleDB) {}

  async getActiveAgent(userId: number): Promise<string> {
    const state = await this.db.query.agentState.findFirst({
      where: eq(agentState.userId, userId),
    });
    return state?.activeAgent || 'master';
  }

  async setActiveAgent(userId: number, agent: string): Promise<void> {
    await this.db.update(agentState)
      .set({ activeAgent: agent, updatedAt: new Date() })
      .where(eq(agentState.userId, userId));
  }

  async getCurrentBranch(userId: number): Promise<string | null> {
    const state = await this.db.query.agentState.findFirst({
      where: eq(agentState.userId, userId),
    });
    return state?.agentMemory?.currentBranch || null;
  }

  async setCurrentBranch(userId: number, branch: string | null): Promise<void> {
    const state = await this.db.query.agentState.findFirst({
      where: eq(agentState.userId, userId),
    });
    const memory = { ...state?.agentMemory, currentBranch: branch };
    await this.db.update(agentState)
      .set({ agentMemory: memory, updatedAt: new Date() })
      .where(eq(agentState.userId, userId));
  }
}
```

---

## Response Formatting

### Message Types

```typescript
// Plain text
await bot.api.sendMessage(chatId, 'Hello!');

// Markdown
await bot.api.sendMessage(chatId, '*Bold* and _italic_', {
  parse_mode: 'MarkdownV2',
});

// Code block
await bot.api.sendMessage(chatId, '```typescript\nconst x = 1;\n```', {
  parse_mode: 'MarkdownV2',
});

// With inline keyboard
await bot.api.sendMessage(chatId, 'Choose action:', {
  reply_markup: {
    inline_keyboard: [
      [{ text: '✅ Approve', callback_data: 'approve' }],
      [{ text: '❌ Cancel', callback_data: 'cancel' }],
    ],
  },
});
```

### Status Response Format

```
🔍 System Status

📦 Database: ✅ Connected (pool: 8/10)
📝 Git: ✅ Connected
   Branch: main
   Last commit: abc1234 - "feat: add character tool"

🤖 Agent: Orchestrator
🕐 Uptime: 2h 34m
```

---

## Inline Keyboards

### PR Review Flow

```typescript
// When Mechanic creates a PR
const keyboard = new InlineKeyboard()
  .text('✅ Deploy', 'deploy:feat/add-characters-v1')
  .text('❌ Abort', 'abort:feat/add-characters-v1')
  .row()
  .url('📝 View PR', 'https://github.com/user/repo/pull/123');

await bot.api.sendMessage(chatId,
  '🔧 Механик создал PR:\n\n' +
  '*feat/add-characters-v1*\n' +
  'Добавлена таблица characters и тул add_character\n\n' +
  'Files changed: 4\n' +
  '✅ Tests passed\n' +
  '✅ TypeCheck passed',
  {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard,
  }
);
```

### Callback Handling

```typescript
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith('deploy:')) {
    const branch = data.replace('deploy:', '');
    await this.gitOps.mergeBranch(branch);
    await ctx.answerCallbackQuery({ text: 'Deploying...' });
    await ctx.editMessageText('🚀 Deployed successfully!');
  }

  if (data.startsWith('abort:')) {
    const branch = data.replace('abort:', '');
    await this.gitOps.deleteBranch(branch);
    await ctx.answerCallbackQuery({ text: 'Aborted' });
    await ctx.editMessageText('❌ Branch deleted');
  }
});
```

---

## Auth Guard

```typescript
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private allowedUserIds: number[];
  private adminUserIds: number[];

  constructor(private configService: ConfigService) {
    this.allowedUserIds = configService.get('TELEGRAM_ALLOWED_USER_IDS')
      .split(',').map(Number);
    this.adminUserIds = configService.get('TELEGRAM_ADMIN_IDS')
      .split(',').map(Number);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const update = request.body as Update;
    const userId = update.message?.from?.id ||
                   update.callback_query?.from?.id;

    if (!userId) return false;

    // Store isAdmin for later use
    request.isAdmin = this.adminUserIds.includes(userId);

    return this.allowedUserIds.includes(userId);
  }
}
```

---

## Error Handling

```typescript
// Global error handler for Telegram
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  console.error(err.error);

  // Try to notify user
  try {
    ctx.reply('❌ Произошла ошибка. Попробуйте /reset для сброса контекста.');
  } catch (e) {
    console.error('Failed to send error message:', e);
  }
});
```

---

## Long-Running Tasks

### Progress Updates

```typescript
// For long tasks like Aider running
async function runWithProgress(chatId: number, task: () => Promise<void>) {
  const msg = await bot.api.sendMessage(chatId, '⏳ Обрабатываю...');

  const progressInterval = setInterval(async () => {
    const dots = '.'.repeat((Date.now() / 500) % 4);
    await bot.api.editMessageText(
      chatId,
      msg.message_id,
      `⏳ Обрабатываю${dots}`
    );
  }, 2000);

  try {
    await task();
    clearInterval(progressInterval);
    await bot.api.editMessageText(chatId, msg.message_id, '✅ Готово!');
  } catch (error) {
    clearInterval(progressInterval);
    await bot.api.editMessageText(chatId, msg.message_id, '❌ Ошибка');
    throw error;
  }
}
```

---

## Вопросы по Telegram

### Критические

1. **Webhook URL**:
   - Fly.io даёт stable URL?
   - Нужен ли custom domain?

2. **Multi-user**:
   - Система для одного пользователя или нескольких?
   - Если несколько - как изолировать контексты?

3. **Grammy vs nestjs-telegraf**:
   - Grammy более активно развивается
   - nestjs-telegraf лучше интегрируется с NestJS
   - Какой выбрать?

### Важные

4. **Rate limiting**:
   - Нужен ли rate limit на сообщения?
   - Telegram сам лимитирует бота?

5. **Media handling**:
   - Нужно ли обрабатывать голосовые сообщения?
   - Изображения? Документы?

6. **History**:
   - Сколько сообщений хранить в контексте?
   - Truncation strategy?

7. **Typing indicator**:
   - Показывать "typing..." при долгих операциях?

8. **Группы**:
   - Бот работает только в личных чатах?
   - Или поддержка групп нужна?

---

## UX Flows

### Flow 1: Normal Conversation

```
User: Привет
  │
  ▼
AuthGuard ──► Check whitelist
  │
  ▼
Router ──► Not emergency command
  │
  ▼
Orchestrator ──► Process with LangGraph
  │
  ▼
Bot: Привет! Я Persais, ваш AI-помощник...
```

### Flow 2: Feature Request to Mechanic

```
User: /mechanic
Bot: 🔧 Режим Механика активирован

User: Хочу сохранять идеи персонажей
  │
  ▼
Mechanic Agent
  │
  ├──► Planning (LLM thinking)
  │
  ├──► Bot: Понял. Создам таблицу characters...
  │
  ├──► Aider (subprocess)
  │
  ├──► Bot: ⏳ Кодирую...
  │
  ├──► Tests + TypeCheck
  │
  └──► Bot: ✅ PR готов! [Deploy] [Abort]
```

### Flow 3: Emergency Rollback

```
User: /rollback abc1234
  │
  ▼
EmergencyHandler (bypass AI)
  │
  ├──► git revert abc1234
  ├──► git push
  │
  └──► Bot: ✅ Rollback complete. Fly.io redeploying...
```

---

## Definition of Done

- [ ] Telegram bot создан и токен получен
- [ ] Webhook настроен и работает
- [ ] AuthGuard фильтрует неавторизованных
- [ ] Emergency commands работают
- [ ] Context switching работает (/mechanic, /write)
- [ ] Inline keyboards работают
- [ ] Error handling не крашит бота
- [ ] Long-running tasks показывают прогресс
- [ ] /status показывает реальную диагностику
