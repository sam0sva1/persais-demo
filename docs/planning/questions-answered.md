# Ответы на вопросы

Этот файл содержит все полученные ответы для проекта **Persais**.

---

## Решённые вопросы

### Инфраструктура

| # | Вопрос | Ответ |
|---|--------|-------|
| I1 | PostgreSQL hosting | **Neon** (Serverless Postgres + pgvector) |
| I2 | Queues | **In-Memory + Postgres state** (без Redis!) |
| I3 | Git authentication | *TBD - скорее всего HTTPS token* |
| I4 | Repository persistence | *TBD* |
| I5 | Структура репозиториев | **persais-core + persais** (два репо рядом) |
| I6 | Связывание репо | **npm link** |
| I7 | NPM package name | **persais-core** |

### AI / Aider

| # | Вопрос | Ответ |
|---|--------|-------|
| A1 | Модель для Aider | **Claude 3.5 Sonnet** (через OpenRouter) |
| A2 | Aider mode | **--yes-always** (полная автономия) |
| A3 | Бюджет на AI API | *Не обсуждалось* |

### Telegram

| # | Вопрос | Ответ |
|---|--------|-------|
| T1 | Telegram library | **Grammy** |
| T2 | Multi-user | **Single-user** |
| T3 | Telegram user ID | *TBD* |
| T4 | Custom domain | *TBD - скорее всего Fly.io default* |
| T5 | Голосовые сообщения | **Да, через Deepgram** |

### Voice Messages (Deepgram)

| # | Вопрос | Ответ |
|---|--------|-------|
| V1 | Speech-to-Text provider | **Deepgram** (nova-2 model) |
| V2 | Архитектура | **Простая** - получаем аудио → Deepgram API → транскрипт → сохраняем как текст |
| V3 | Streaming | **Нет** - batch запросы (синхронно) |
| V4 | Язык | **Русский** (ru) по умолчанию |

### Архитектура агентов

| # | Вопрос | Ответ |
|---|--------|-------|
| AG1 | Intent Classifier в MVP | **Да, сразу** (Haiku) |
| AG2 | Routing mode | **Sticky** (до явного переключения) |
| AG3 | Субагент сам возвращает управление | **Да** |
| AG4 | Agent topology | **Hub-spoke + explicit handoff** |
| AG5 | Контекст для Orchestrator | **Полный** (все сообщения) |
| AG6 | State storage | **Только Postgres** |
| AG7 | Лимит сообщений | **10** (настраиваемо через Mechanic) |
| AG8 | SGR для ключевых агентов | **Да** (classifier, master, mechanic) |
| AG9 | Разные LLM configs | **Да** (per-agent конфигурация) |
| AG10 | Mechanic меняет LLM configs | **Да** |

### Message Aggregator (Batching)

| # | Вопрос | Ответ |
|---|--------|-------|
| B1 | Подход к batching | **Smart Aggregator** (debounce + intent grouping) |
| B2 | Debounce timeout | **5 секунд** (настраиваемо через Mechanic) |
| B3 | Max batch size | **10 сообщений** |
| B4 | Max wait time | **30 секунд** |
| B5 | UX при получении | **Галочка ✓✓** (Telegram default read receipt) |
| B6 | UX при обработке | **typing...** (chat action) |
| B7 | Intent change behavior | **Flush текущий batch → wait → new batch** |

### MVP Scope

| # | Вопрос | Ответ |
|---|--------|-------|
| M1 | Writer в MVP | **Нет**, только Mechanic (но с полной архитектурой агентов) |
| M2 | Testing | **Critical paths only** |

### Distribution (Backlog)

| # | Вопрос | Ответ |
|---|--------|-------|
| D1 | Модель дистрибуции | **Core as Dependency** (persais-core + starter template) |
| D2 | Фазы развёртывания | **Local → Container → Distribution** |
| D3 | CLI wizard | **create-persais-app** (после MVP) |
| D4 | Архитектурный подход | **bootstrap(config)** + configurable paths |
| D5 | Изоляция кода | **Core (ядро) vs Dynamic (код пользователя)** |

---

## Финальная архитектура

### Технологический стек

```
Runtime:        Node.js (NestJS)
Language:       TypeScript (Strict Mode)
Database:       Neon (PostgreSQL + pgvector)
Queues:         In-Memory + Postgres state (БЕЗ Redis!)
ORM:            Drizzle
AI Gateway:     OpenRouter
AI Models:
  - Classifier: Claude 3 Haiku
  - Master:     Claude 3.5 Sonnet
  - Mechanic:   Claude 3.5 Sonnet
  - Aider:      Claude 3.5 Sonnet
Speech-to-Text: Deepgram (nova-2)
Telegram:       Grammy
Validation:     Zod
Deployment:     Fly.io
```

### Структура репозиториев

```
~/WORK/code/
├── persais-core/          # Ядро (будущий NPM пакет)
│   ├── src/
│   │   ├── core/          # Core modules
│   │   ├── agents/        # Master, Mechanic
│   │   └── shared/
│   ├── templates/         # Templates for Mechanic
│   ├── package.json       # name: "persais-core"
│   └── tsconfig.json
│
└── persais/               # Целевой проект (user code)
    ├── src/
    │   ├── main.ts        # Entry point
    │   ├── agents/        # Dynamic agents
    │   ├── tools/         # Dynamic tools
    │   └── schemas/       # Dynamic schemas
    ├── package.json       # depends on persais-core (via npm link)
    ├── Dockerfile
    ├── fly.toml
    └── docker-compose.yml
```

### Message Flow

```
┌────────────┐
│  Telegram  │
└─────┬──────┘
      │
      ▼
┌─────────────────┐     "keep_current" (high confidence)
│    Classifier   │────────────────────────────────────┐
│   (Haiku)       │                                    │
└─────┬───────────┘                                    │
      │ "uncertain"                                    │
      ▼                                                ▼
┌─────────────────┐                          ┌─────────────────┐
│  Orchestrator   │──── switch_to_agent ────►│  Active Agent   │
│  (Master)       │                          │  (from state)   │
│  (Sonnet)       │◄── return_to_master ─────│                 │
└─────────────────┘                          └─────────────────┘
                                                      │
                                             ┌────────┴────────┐
                                             │                 │
                                    ┌────────▼────┐    ┌───────▼──────┐
                                    │  Mechanic   │    │   Dynamic    │
                                    │  (CORE)     │    │   Agents     │
                                    └─────────────┘    └──────────────┘
```

### Shared State (Postgres)

```
agent_state
├── user_id (unique)
├── active_agent ('master' | 'mechanic' | ...)
├── messages[] (last 10)
├── agent_memory{} (per-agent state)
└── max_messages (configurable)

llm_configs
├── agent_name
├── model
├── temperature
├── max_tokens
├── use_structured_output
└── response_format (JSON schema)

job_queue (для In-Memory recovery)
├── job_id
├── job_type
├── payload
├── status
├── created_at
└── processed_at
```

### CORE (не изменяются Механиком)

- Intent Classifier
- Orchestrator (Master Agent)
- Mechanic Agent
- Routing logic
- LLM Client Factory
- Shared State management
- Emergency commands
- In-Memory Queue + Postgres recovery

### DYNAMIC (создаются Механиком)

- Новые субагенты (src/agents/)
- Tools для субагентов (src/tools/)
- DB Schemas (src/schemas/)
- LLM Configs (через update_agent_config tool)

---

## Открытые вопросы (не критичные)

1. **Git authentication** - SSH или HTTPS token?
2. **Repository persistence** - Clone on start или persistent volume?
3. **Telegram user ID** - Для whitelist
4. **Custom domain** - Нужен ли?
5. **Logs & Monitoring** - Fly.io logs достаточно?
6. **Backup strategy** - Neon handles automatically?

---

## Следующие шаги

1. ✅ Архитектура финализирована
2. ⬜ Создать структуру persais-core/
3. ⬜ Настроить npm link
4. ⬜ Создать docker-compose.yml
5. ⬜ Реализовать Step 1 (Infrastructure)
6. ⬜ Реализовать Step 2 (Core Logic)
