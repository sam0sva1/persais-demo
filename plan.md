# Plan - Текущий план работы

> **Инструкция по использованию:**
> 1. Перед началом каждой секции работы - описать план в этом файле
> 2. Указать цель секции и список конкретных задач
> 3. По мере выполнения - отмечать задачи как выполненные [x]
> 4. После завершения секции - делать git commit
> 5. Очищать/архивировать выполненные секции по необходимости

---

## Текущая секция: Ожидание подтверждения

TelegramModule реализован. Ожидается подтверждение пользователя для перехода к следующей секции.

### Следующие секции (по плану):
1. Реализация OrchestratorModule (Intent Classifier + Routing)
2. Реализация Message Aggregator (Smart Batching)
3. Реализация bootstrap() function

---

## История выполненных секций

### ✅ TelegramModule (Grammy) (завершено)

**Создано:**
- telegram.module.ts - forRoot/forRootAsync
- telegram.service.ts - sendMessage, editMessage, progress updates
- telegram.controller.ts - webhook endpoint
- telegram-auth.guard.ts - whitelist + admin
- emergency-command.handler.ts - /status, /reset
- telegram.types.ts - все типы

### ✅ DatabaseModule (Drizzle + Neon) (завершено)

**Схемы созданы:**
- conversations.ts - с messages как JSONB
- agent-states.ts - LangGraph checkpoints
- llm-configs.ts, audit-log.ts
- agents-registry.ts, tools-registry.ts

**Сервисы:**
- DatabaseService - connection pool
- ConversationRepository, AuditRepository

**Модуль:**
- DatabaseModule.forRoot() / forRootAsync()
- drizzle.config.ts для миграций

### ✅ NestJS skeleton + docker-compose (завершено)

**Создано в persais/:**
- package.json (зависимость file:../persais-core)
- docker-compose.yml (PostgreSQL 16)
- tsconfig.json
- src/main.ts, src/app.module.ts
- .env.example, .gitignore
- Директории src/agents/, src/tools/, src/schemas/

### ✅ Создание структуры persais-core/ (завершено)

**Цель:** Создать базовую структуру директорий и файлов для ядра проекта.

**Создано 31 файл:**
- package.json, tsconfig.json, .gitignore
- src/index.ts, src/bootstrap.ts
- src/core/ - модули telegram, database, orchestrator, gitops, coder
- src/agents/ - base.ts, master/, mechanic/
- src/shared/ - types/, utils/
- templates/ - 4 шаблона для Механика

### ✅ Обновление документации (завершено)
- Заменены все упоминания "demiurge" на "persais"
- Удалены все ссылки на Redis/Upstash/BullMQ
- Обновлена архитектура Message Aggregator на In-Memory + Postgres
