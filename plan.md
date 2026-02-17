# Plan - Текущий план работы

> **Инструкция по использованию:**
> 1. Перед началом каждой секции работы - описать план в этом файле
> 2. Указать цель секции и список конкретных задач
> 3. По мере выполнения - отмечать задачи как выполненные [x]
> 4. После завершения секции - делать git commit
> 5. Очищать/архивировать выполненные секции по необходимости

---

## Текущая секция: Реализация TelegramModule (Grammy)

### Цель
Создать TelegramModule для обработки webhook запросов от Telegram с Grammy.

### Зачем
- Grammy - современная библиотека для Telegram ботов с хорошей типизацией
- Webhook более эффективен чем polling для production
- AuthGuard обеспечивает whitelist доступ

### Задачи

**Core:**
- [x] telegram.module.ts - NestJS модуль с Bot factory (forRoot/forRootAsync)
- [x] telegram.service.ts - отправка сообщений, форматирование, progress updates
- [x] telegram.controller.ts - webhook endpoint с роутингом

**Guards & Handlers:**
- [x] telegram-auth.guard.ts - whitelist + admin проверка
- [x] emergency-command.handler.ts - /status, /reset (abort/rollback/deploy - TODO GitOps)

**Types:**
- [x] telegram.types.ts - типы для сообщений, callback, options
- [x] index.ts - экспорт модуля
- [x] Экспорт из главного index.ts

---

## История выполненных секций

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
