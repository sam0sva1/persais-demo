# Plan - Текущий план работы

> **Инструкция по использованию:**
> 1. Перед началом каждой секции работы - описать план в этом файле
> 2. Указать цель секции и список конкретных задач
> 3. По мере выполнения - отмечать задачи как выполненные [x]
> 4. После завершения секции - делать git commit
> 5. Очищать/архивировать выполненные секции по необходимости

---

## Текущая секция: Завершено - Step 3 (Mechanic Logic)

Все модули Step 3 реализованы:
- ✅ GitOpsModule
- ✅ CoderModule (Aider)
- ✅ Mechanic Agent + MechanicService

### Следующий этап (Step 4):
1. First Evolution Test - создать Echo агента через чат

---

## История выполненных секций

### ✅ Step 3: Mechanic Logic (завершено)

**GitOpsModule:**
- gitops.service.ts - полный функционал simple-git
- Branch management (create, delete, checkout)
- Commit, push, pull операции
- Diff и status информация
- Abort feature helper

**CoderModule (Aider):**
- coder.service.ts - управление Aider subprocess
- Retry mechanism с error loop detection
- System checks (typecheck, test, lint)
- Changed files parsing

**Mechanic Agent:**
- mechanic.agent.ts - обработка feature requests
- mechanic.service.ts - полный workflow:
  - Feature scaffolding из шаблонов
  - Code generation с Aider
  - Git workflow management
  - System verification
  - Per-user state management

### ✅ Step 2: Core Logic (завершено)

**Message Aggregator + bootstrap():**
- aggregator-state.ts - схема для Postgres recovery
- message-aggregator.service.ts - smart batching с debounce
- bootstrap.ts - полная реализация с NestFactory
- Интеграция aggregator в TelegramController

**OrchestratorModule:**
- openrouter.client.ts - wrapper для OpenRouter API
- llm-client.factory.ts - создание клиентов с кэшированием
- intent-classifier.service.ts - classify (keep_current/uncertain/switch)
- agent-registry.service.ts - реестр агентов (master, mechanic)
- orchestrator.service.ts - роутинг и agent switching
- orchestrator.module.ts - forRoot/forRootAsync

**TelegramModule (Grammy):**
- telegram.module.ts - forRoot/forRootAsync
- telegram.service.ts - sendMessage, editMessage, progress updates
- telegram.controller.ts - webhook endpoint
- telegram-auth.guard.ts - whitelist + admin
- emergency-command.handler.ts - /status, /reset
- telegram.types.ts - все типы

**DatabaseModule (Drizzle + Neon):**
- Схемы: conversations, agent-states, llm-configs, audit-log, registries, aggregator-state
- Сервисы: DatabaseService, ConversationRepository, AuditRepository
- Модуль: forRoot() / forRootAsync()

### ✅ Step 1: Infrastructure (завершено)

**persais/:**
- package.json (зависимость file:../persais-core)
- docker-compose.yml (PostgreSQL 16)
- tsconfig.json
- src/main.ts, src/app.module.ts
- .env.example, .gitignore
- Директории src/agents/, src/tools/, src/schemas/

**persais-core/:**
- package.json, tsconfig.json, .gitignore
- src/index.ts, src/bootstrap.ts
- src/core/ - модули telegram, database, orchestrator, gitops, coder
- src/agents/ - base.ts, master/, mechanic/
- src/shared/ - types/, utils/
- templates/ - 4 шаблона для Механика

### ✅ Step 0: Prerequisites (завершено)
- Обновлена документация (demiurge → persais)
- Удалены ссылки на Redis/Upstash/BullMQ
- Архитектура Message Aggregator на In-Memory + Postgres
