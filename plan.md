# Plan - Текущий план работы

> **Инструкция по использованию:**
> 1. Перед началом каждой секции работы - описать план в этом файле
> 2. Указать цель секции и список конкретных задач
> 3. По мере выполнения - отмечать задачи как выполненные [x]
> 4. После завершения секции - делать git commit
> 5. Очищать/архивировать выполненные секции по необходимости

---

## Текущая секция: Реализация DatabaseModule (Drizzle + Neon)

### Цель
Создать полноценный DatabaseModule с Drizzle ORM для работы с PostgreSQL (Neon в продакшене, локальный в dev).

### Зачем
- Основа для хранения состояния агентов, сообщений, конфигураций
- Drizzle - type-safe ORM с отличной поддержкой TypeScript
- Neon - serverless PostgreSQL с автоматическим масштабированием

### Задачи

**Схемы (в persais-core/src/core/database/schema/):**
- [x] conversations.ts - таблица conversations с messages как JSONB
- [x] agent-states.ts - состояние агентов (LangGraph checkpoints)
- [x] llm-configs.ts - конфигурации LLM для агентов
- [x] audit-log.ts - аудит действий
- [x] agents-registry.ts - реестр агентов
- [x] tools-registry.ts - реестр инструментов
- [x] index.ts - экспорт всех схем

**Сервисы:**
- [x] database.service.ts - основной сервис с Drizzle client
- [x] repositories/conversation.repository.ts - работа с conversations
- [x] repositories/audit.repository.ts - логирование действий
- [x] repositories/index.ts - экспорт репозиториев

**Модуль:**
- [x] database.module.ts - NestJS модуль с DI (forRoot/forRootAsync)
- [x] drizzle.config.ts - конфигурация для миграций
- [x] Экспорт из index.ts

---

## История выполненных секций

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
