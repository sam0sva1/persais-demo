# Plan - Текущий план работы

> **Инструкция по использованию:**
> 1. Перед началом каждой секции работы - описать план в этом файле
> 2. Указать цель секции и список конкретных задач
> 3. По мере выполнения - отмечать задачи как выполненные [x]
> 4. После завершения секции - делать git commit
> 5. Очищать/архивировать выполненные секции по необходимости

---

## Текущая секция: Реализация OrchestratorModule

### Цель
Создать OrchestratorModule для роутинга сообщений между агентами.

### Зачем
- Intent Classifier (Haiku) быстро определяет куда направить сообщение
- OrchestratorService управляет shared state и переключением агентов
- LLMClientFactory создаёт клиенты OpenRouter с правильными настройками

### Задачи

**Intent Classifier:**
- [x] intent-classifier.service.ts - classify messages (keep_current/uncertain/switch)

**LLM Client:**
- [x] llm-client.factory.ts - создание OpenRouter клиентов с кэшированием
- [x] openrouter.client.ts - wrapper для OpenRouter API

**Orchestrator:**
- [x] orchestrator.service.ts - роутинг, agent switching, conversation state
- [x] agent-registry.service.ts - реестр core агентов (master, mechanic)

**Tools:**
- [ ] switch-to-agent.tool.ts - TODO (будет в LangGraph интеграции)
- [ ] return-to-master.tool.ts - встроено в OrchestratorService

**Module:**
- [x] orchestrator.module.ts - forRoot/forRootAsync
- [x] index.ts - экспорт всех компонентов

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
