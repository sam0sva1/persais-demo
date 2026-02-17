# Секция 2b: Message Aggregator (Smart Batching)

## Scope
Умная агрегация сообщений пользователя для batch-обработки агентами.

---

## Проблема

```
Пользователь пишет быстро:
  [00:00:00] "Добавь персонажа"      → Writer intent
  [00:00:01] "С именем Алиса"        → Writer intent
  [00:00:02] "Ей 25 лет"             → Writer intent
  [00:00:06] "И создай для этого тул" → Mechanic intent

Без batching:
  - 4 отдельных вызова агентов
  - Дорого (4x API calls)
  - Потеря контекста между сообщениями

С batching:
  - Batch 1 [msg1-3] → Writer agent (один вызов)
  - Batch 2 [msg4] → Master → Mechanic (один вызов)
  - Экономия + лучший контекст
```

---

## Архитектура

```
┌────────────┐
│  Telegram  │
└─────┬──────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Message Aggregator                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Per-User State (Redis)                         │ │
│  │  {                                                          │ │
│  │    pending_messages: Message[],                             │ │
│  │    current_batch_intent: string | null,                     │ │
│  │    first_message_at: timestamp,                             │ │
│  │    last_message_at: timestamp,                              │ │
│  │    is_processing: boolean,                                  │ │
│  │    debounce_ms: 5000  // configurable                       │ │
│  │  }                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Flow                                   │ │
│  │                                                             │ │
│  │  1. Message received                                        │ │
│  │     └─► ✓ Read receipt (галочка в Telegram)                │ │
│  │                                                             │ │
│  │  2. Classify intent (Haiku)                                │ │
│  │                                                             │ │
│  │  3. Intent changed?                                         │ │
│  │     ├─► YES: Flush current batch → Wait → Start new batch  │ │
│  │     └─► NO: Add to current batch                           │ │
│  │                                                             │ │
│  │  4. Reset debounce timer (5 sec)                           │ │
│  │                                                             │ │
│  │  5. On timer expire OR max_batch_size OR max_wait_time:    │ │
│  │     └─► Set "typing..." → Process batch → Send response    │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Параметры (настраиваемые)

| Параметр | Default | Описание |
|----------|---------|----------|
| `debounce_ms` | 5000 | Время ожидания после последнего сообщения |
| `max_batch_size` | 10 | Максимум сообщений в batch |
| `max_wait_ms` | 30000 | Максимальное время сбора batch |

**Важно:** Mechanic может менять эти параметры через конфигурацию.

---

## User Experience

### 1. Получение сообщения
```
User: "Добавь персонажа"
Bot: ✓✓ (read receipt / галочка)
```

### 2. Сбор batch (ожидание)
```
User: "С именем Алиса"
Bot: ✓✓

User: "Ей 25 лет"
Bot: ✓✓

[5 секунд тишины...]
```

### 3. Обработка
```
Bot: typing... (chat action)

Bot: "Отлично! Создала персонажа:
      Имя: Алиса
      Возраст: 25 лет
      ..."
```

### 4. Смена интента (flush + new batch)
```
User: "Добавь персонажа"    → Writer
Bot: ✓✓

User: "С именем Алиса"      → Writer
Bot: ✓✓

User: "И создай тул"        → Mechanic (intent changed!)
Bot: ✓✓

[Система: flush Writer batch, wait for response]

Bot: typing...
Bot: "Создала персонажа Алиса..."

[Система: now process Mechanic batch]

Bot: typing...
Bot: "Понял, создаю тул для персонажей..."
```

---

## Реализация

### State Schema (In-Memory + Postgres)

```typescript
interface UserAggregatorState {
  userId: number;

  // Pending messages
  pendingMessages: AggregatedMessage[];

  // Current batch
  currentBatchIntent: string | null; // 'writer' | 'mechanic' | 'master' | null
  firstMessageAt: number;            // timestamp
  lastMessageAt: number;             // timestamp

  // Processing lock
  isProcessing: boolean;

  // Config (can be changed by Mechanic)
  config: {
    debounceMs: number;      // default: 5000
    maxBatchSize: number;    // default: 10
    maxWaitMs: number;       // default: 30000
  };
}

interface AggregatedMessage {
  id: string;
  content: string;
  intent: string;
  timestamp: number;
  telegramMessageId: number;
  metadata?: {
    isVoice?: boolean;
    originalTranscript?: string;
  };
}
```

### Service Implementation

```typescript
// core/telegram/message-aggregator.service.ts

@Injectable()
export class MessageAggregatorService {
  // In-memory state (fast access)
  private states = new Map<number, UserAggregatorState>();
  // Pending timers for debounce
  private timers = new Map<number, NodeJS.Timeout>();

  constructor(
    @Inject('DRIZZLE') private db: DrizzleDB,
    private classifier: IntentClassifierService,
    private orchestrator: OrchestratorService,
    private telegram: TelegramService,
  ) {}

  async handleMessage(ctx: Context, content: string): Promise<void> {
    const userId = ctx.from!.id;
    const chatId = ctx.chat!.id;

    // 1. Send read receipt
    await this.telegram.markAsRead(chatId, ctx.message!.message_id);

    // 2. Get current state
    const state = await this.getState(userId);

    // 3. Classify intent
    const intent = await this.classifier.classifyForAggregation(
      content,
      state.currentBatchIntent,
    );

    // 4. Check if intent changed (and we have pending messages)
    if (state.currentBatchIntent &&
        state.pendingMessages.length > 0 &&
        intent !== state.currentBatchIntent) {
      // Flush current batch first, then continue
      await this.flushBatch(userId, state);
      // Refresh state after flush
      state = await this.getState(userId);
    }

    // 5. Add message to pending
    const message: AggregatedMessage = {
      id: crypto.randomUUID(),
      content,
      intent,
      timestamp: Date.now(),
      telegramMessageId: ctx.message!.message_id,
    };

    state.pendingMessages.push(message);
    state.currentBatchIntent = intent;
    state.lastMessageAt = Date.now();

    if (state.pendingMessages.length === 1) {
      state.firstMessageAt = Date.now();
    }

    await this.setState(userId, state);

    // 6. Schedule processing
    await this.scheduleProcessing(userId, chatId, state);
  }

  private async scheduleProcessing(
    userId: number,
    chatId: number,
    state: UserAggregatorState,
  ): Promise<void> {
    // Cancel existing scheduled timer
    const existingTimer = this.timers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Check if should process immediately
    const shouldProcessNow =
      state.pendingMessages.length >= state.config.maxBatchSize ||
      (Date.now() - state.firstMessageAt) >= state.config.maxWaitMs;

    if (shouldProcessNow) {
      return this.processBatch(userId, chatId);
    }

    // Schedule debounced processing (in-memory setTimeout)
    const timer = setTimeout(
      () => this.processBatch(userId, chatId),
      state.config.debounceMs,
    );
    this.timers.set(userId, timer);
  }

  private async flushBatch(
    userId: number,
    state: UserAggregatorState,
  ): Promise<void> {
    if (state.isProcessing || state.pendingMessages.length === 0) {
      return;
    }

    const chatId = /* get from first message or state */;
    await this.processBatch(userId, chatId);
  }

  async processBatch(userId: number, chatId: number): Promise<void> {
    const state = await this.getState(userId);

    if (state.isProcessing || state.pendingMessages.length === 0) {
      return;
    }

    // Lock
    state.isProcessing = true;
    await this.setState(userId, state);

    try {
      // Show typing indicator
      await this.telegram.sendChatAction(chatId, 'typing');

      // Combine messages
      const combinedContent = state.pendingMessages
        .map((m, i) => state.pendingMessages.length > 1
          ? `[${i + 1}] ${m.content}`
          : m.content)
        .join('\n\n');

      // Process through orchestrator
      const response = await this.orchestrator.process({
        userId,
        chatId,
        content: combinedContent,
        intent: state.currentBatchIntent!,
        isBatch: state.pendingMessages.length > 1,
        originalMessages: state.pendingMessages,
      });

      // Send response
      await this.telegram.sendMessage(chatId, response);

      // Clear batch
      state.pendingMessages = [];
      state.currentBatchIntent = null;
      state.firstMessageAt = 0;
      state.lastMessageAt = 0;

    } finally {
      state.isProcessing = false;
      await this.setState(userId, state);
    }
  }

  // State management (In-Memory with Postgres fallback)
  private async getState(userId: number): Promise<UserAggregatorState> {
    // Check in-memory first
    const cached = this.states.get(userId);
    if (cached) {
      return cached;
    }

    // Fallback to Postgres (for recovery after restart)
    const dbState = await this.db.query.aggregatorState.findFirst({
      where: eq(aggregatorState.userId, userId),
    });

    if (dbState?.state) {
      const state = dbState.state as UserAggregatorState;
      this.states.set(userId, state);
      return state;
    }

    // Default state
    const defaultState: UserAggregatorState = {
      userId,
      pendingMessages: [],
      currentBatchIntent: null,
      firstMessageAt: 0,
      lastMessageAt: 0,
      isProcessing: false,
      config: {
        debounceMs: 5000,
        maxBatchSize: 10,
        maxWaitMs: 30000,
      },
    };
    this.states.set(userId, defaultState);
    return defaultState;
  }

  private async setState(userId: number, state: UserAggregatorState): Promise<void> {
    // Update in-memory
    this.states.set(userId, state);

    // Persist to Postgres (for recovery)
    await this.db.insert(aggregatorState)
      .values({ userId, state, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: aggregatorState.userId,
        set: { state, updatedAt: new Date() },
      });
  }

  // Config update (called by Mechanic)
  async updateConfig(userId: number, config: Partial<UserAggregatorState['config']>): Promise<void> {
    const state = await this.getState(userId);
    state.config = { ...state.config, ...config };
    await this.setState(userId, state);
  }
}
```

### Recovery on Startup

```typescript
// При старте сервиса восстанавливаем pending batches из Postgres
async onModuleInit() {
  const pendingStates = await this.db.query.aggregatorState.findMany({
    where: gt(aggregatorState.updatedAt, new Date(Date.now() - 3600000)), // last hour
  });

  for (const dbState of pendingStates) {
    const state = dbState.state as UserAggregatorState;
    if (state.pendingMessages.length > 0 && !state.isProcessing) {
      // Re-schedule processing for pending batches
      this.states.set(state.userId, state);
      // Process immediately after restart
      setImmediate(() => this.processBatch(state.userId, state.pendingMessages[0]?.chatId));
    }
  }
}
```

---

## Edge Cases

### 1. Message during processing
```
Batch 1 processing...
User sends new message
→ Message goes to NEW pending batch
→ Will be processed after Batch 1 completes
```

### 2. Voice message in batch
```
User: "Добавь персонажа" (text)
User: [voice: "с именем Алиса"] → transcribed to text
User: "Ей 25 лет" (text)
→ All combined as one batch with metadata about voice
```

### 3. Very long pause mid-batch
```
User: "Добавь" [00:00]
[30 seconds pass - max_wait_ms reached]
→ Process partial batch
User: "персонажа" [00:30]
→ New batch
```

### 4. Rapid intent switching
```
User: "Добавь персонажа" (writer)
User: "Создай тул" (mechanic)
User: "Для персонажей" (mechanic)
→ Flush writer batch (1 msg) → Process
→ Collect mechanic batch (2 msgs) → Wait debounce → Process
```

---

## Telegram Read Receipt

Grammy позволяет показать "read" status через chat action или реакцию:

```typescript
// Вариант 1: Chat action (менее надёжно)
await ctx.api.sendChatAction(chatId, 'typing');

// Вариант 2: Reaction (если доступно в боте)
// Telegram API: setMessageReaction
await ctx.api.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: '👀' }]);

// Вариант 3: Просто не показывать ничего, пользователь видит ✓✓ от Telegram
```

**Решение для MVP:** Полагаемся на стандартные галочки Telegram (✓✓ при получении), а при начале обработки показываем `typing...`.

---

## Вопросы (решённые)

| Вопрос | Решение |
|--------|---------|
| Подход к batching | **Smart Aggregator** |
| Debounce timeout | **5 секунд** (настраиваемо) |
| UX при сборе | **Галочка ✓✓** (Telegram default) |
| UX при обработке | **typing...** |
| Mechanic может менять config | **Да** |

---

## Definition of Done

- [ ] MessageAggregatorService создан
- [ ] Per-user state хранится в памяти с Postgres fallback
- [ ] Debounce работает (5 sec default)
- [ ] Intent change триггерит flush
- [ ] Max batch size enforced
- [ ] Max wait time enforced
- [ ] setTimeout scheduling работает
- [ ] Recovery при перезапуске восстанавливает pending batches
- [ ] typing... показывается при обработке
- [ ] Config можно менять через Mechanic
- [ ] Voice messages интегрированы с aggregator
