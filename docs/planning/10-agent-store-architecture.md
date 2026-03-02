# 10. Agent Store Architecture

## Overview

Система управления агентами по модели "приложения на телефоне": установить, настроить, удалить. Магазин шаблонов позволяет быстро добавлять агентов. Система ориентирована на обычных пользователей — Mechanic адаптирует коммуникацию под уровень пользователя.

## Agent Classification: 2x2 Model

```
                Без/простые данные       С развитыми данными
Лёгкие         L1 (промпт + tools)      L2 (+ agent_memory / agent_knowledge)
Тяжёлые        H1 (scaffold, пустой)    H2 (полный код + схема)
```

Граница между классами — **наличие кастомного кода**:
- **Лёгкие (L1, L2):** Декларативные. Манифест в БД. Без кода, без рестарта.
- **Тяжёлые (H1, H2):** Кодовые. TypeScript-файлы + Drizzle-схемы. Создаются/улучшаются Mechanic'ом. Требуют рестарт.

Вторая граница — **L2 vs H2** — проходит по **надёжности**:
- **L2:** Поведение описано промптом. LLM следует инструкциям, но может забыть/ошибиться.
- **H2:** Поведение гарантировано кодом. Детерминированные хуки, валидация, трансформации.

Чем больше generic tools доступно L2-агентам (scheduler, http_request, agent_knowledge), тем дальше отодвигается граница L2→H2. Каждый новый tool расширяет возможности L2.

### L1 — Лёгкий без данных

- Только промпт + набор существующих tools (глобальные + запрошенные через `tools[]` в манифесте)
- Примеры: переводчик, объяснитель терминов, мотивационный коуч
- Установка: мгновенная, без рестарта
- Данные: не хранит ничего между сессиями

### L2 — Лёгкий с данными

- L1 + tool `agent_memory` для структурированных данных (key-value JSONB)
- L1 + tool `agent_knowledge` для текстовых знаний с semantic search (pgvector) — *planned*
- Каждый агент получает свою персональную таблицу `agent_<name>_store` (JSONB)
- Примеры: трекер привычек, список покупок, простые заметки, книга рецептов
- Установка: мгновенная (CREATE TABLE в runtime)

### H1 — Тяжёлый пустой

- Scaffold кодового агента: файлы + схема + tools, но без данных
- Естественное состояние: после установки из стора или после upgrade из L2
- Также промежуточное состояние при разработке нового агента Mechanic'ом

### H2 — Тяжёлый полноценный

- Полный код: custom tools, Drizzle-схемы, кастомная логика
- Примеры: финансовый аналитик с отчётами, CRM, сложный планировщик
- Создаётся и улучшается Mechanic'ом через Aider

## Transitions Between Levels

### Внутри класса (просто, предсказуемо)

**L1 → L2:** Пользователь просит "запомни это". Система добавляет agent_memory tool и создаёт таблицу. Без рестарта. Реализовано через `manage_agents({ action: 'upgrade_to_l2' })`.

**H1 → H2:** Mechanic добавляет tools, схему, код. Обычный рабочий процесс. Рестарт.

### Между классами (upgrade через Mechanic)

**L1 → H1:** Пользователь хочет больше возможностей. Mechanic scaffold'ит кодового агента на основе текущего промпта. Рестарт. Данных нет — мигрировать нечего.

**L2 → H:** Самый сложный переход. Mechanic:
1. Читает манифест + содержимое agent_memory (понимает структуру данных)
2. Scaffold'ит кодового агента с proper Drizzle-схемой
3. Мигрирует данные из JSONB в типизированные таблицы
4. Создаёт tools для новой схемы
5. Удаляет лёгкого агента, регистрирует тяжёлого. Рестарт.

Это не плавный upgrade, а **пересоздание с переносом данных**. Для пользователя выглядит прозрачно: "Хочу фильтровать по рейтингу" → Mechanic: "Окей, улучшу агента. Пару минут и перезапуск. Все данные сохранятся."

**H → L:** Не поддерживается. Нет реального use case для downgrade.

### Когда нужен upgrade L2 → H2?

Триггер: пользователь требует **гарантированное** поведение, которое LLM может забыть.

Примеры:
- "Каждая заметка должна синхронизироваться на мой сервер" — L2 может (через http_request tool + промпт), но LLM может забыть POST. H2 с кодом делает это детерминированно.
- "Мне нужна сложная фильтрация с рейтингами" — L2 не справится, нужны кастомные tools с SQL.

Правило: **начни с L2, перейди на H2 когда ненадёжность станет проблемой**.

## User Experience

Пользователь **не знает** о типах агентов. Для него это просто "агент". Система сама определяет нужный уровень:

- "Установи агента для рецептов" → L1
- "Запомни этот рецепт" → автоматически L2
- "Хочу чтобы заметки синхронизировались на сервер" → L2 (если http_request доступен)
- "Он ненадёжно синхронизирует" → Mechanic предлагает upgrade до H2

### Кастомизация агентов из маркета

Путь пользователя:

```
Установка из маркета (L1/L2)
    ↓
Использование "из коробки"
    ↓
"Хочу изменить X" → Master: manage_agents(update) — меняет промпт/keywords
    ↓
"Хочу чтобы он ещё делал Y" → Master добавляет tool или дописывает промпт
    ↓
"Он ненадёжно делает Z" → Mechanic upgrade'ит в H2 (Phase 3)
```

Каждый шаг до последнего — это `manage_agents({ action: 'update' })`. Без кода, без рестарта.

## Store Concept

### Что это

Каталог шаблонов агентов (манифестов и код-пакетов). Позволяет:
- Просматривать доступных агентов с описаниями
- Устанавливать агента (целиком или как шаблон для кастомизации)
- Модерация контента (на первом этапе — только авторские агенты)

### Первые кандидаты для маркета

1. **Notes Agent (L2)** — заметки с semantic search через agent_knowledge. Первый шаблон, проверяет L2 + knowledge pipeline.
2. **Side Quests Agent (L1)** — ежедневные креативные задания через scheduler. Развлекательный, привлекает пользователей.

### Как работает для разных типов

- **Лёгкие шаблоны:** JSON-манифесты. Мгновенная установка.
- **Тяжёлые шаблоны:** Код-пакеты. Установка через Mechanic (копирование файлов, миграции, рестарт).

### Agent as template

Агент из стора — это шаблон, а не жёсткая копия. При установке:
1. Master/система читает манифест
2. Проверяет совместимость (нужные tools доступны?)
3. Устанавливает с возможностью кастомизации (промпт, настройки)

## Data Storage Strategy

### Лёгкие агенты — agent_memory (structured data)

Для структурированных данных (привычки, настройки, списки, рецепты).

Каждый L2 агент получает **персональную таблицу** `agent_<name>_store`:
```
agent_<name>_store(
  id serial,
  collection varchar,    -- логическая группа ("recipes", "preferences")
  "key" varchar,         -- идентификатор записи
  data jsonb,            -- содержимое
  user_id bigint,        -- для multi-user
  created_at, updated_at
)
```

API через tool `agent_memory`:
- `save(collection, key, data)` — upsert запись
- `get(collection, key)` — получить запись
- `list(collection, filter?, limit?)` — список записей, filter через JSONB containment (@>)
- `delete(collection, key)` — удалить запись
- `collections()` — список коллекций агента

Изоляция на уровне таблиц — никакого загрязнения общей таблицы.

### Лёгкие агенты — agent_knowledge (semantic search) — *planned*

Для текстовых знаний (заметки, идеи, цитаты), где нужен поиск по смыслу.

Отличия от agent_memory:
- Хранит текст + embedding (pgvector, 1536d)
- Поиск по cosine similarity, не по точному ключу
- Embedding вычисляется при save (API call к embedding model)
- Используется когда агент не знает точный ключ, а ищет "по смыслу"

Два tool'а разделены по назначению:
- `agent_memory` = **структурированные данные** (JSON, точные ключи, CRUD)
- `agent_knowledge` = **текстовые знания** (embedding, semantic search)

### Тяжёлые агенты (H1/H2)

Собственные Drizzle-схемы, собственные таблицы, кастомные tools для доступа. Полная свобода в структуре данных. Безопасность обеспечивается кодом tools (queries предопределены, не сырой SQL).

## Implementation Phases

### Phase 1: Light Agents (L1 + L2) — ✅ Done

Манифест в БД, runtime loader, agent_memory, управление через Master, интеграция с classifier.

**Реализовано:**
- Drizzle-схема `core.light_agents` + repository + миграция
- `LightAgentService` — install/uninstall/update/upgrade/restore-from-DB
- `agent_memory` tool — CRUD с параметризованными SQL-запросами, user_id изоляция
- `manage_agents` tool — для Master (list/install/uninstall/update/upgrade_to_l2/info)
- Fix `ToolRegistryService.registerForAgents([])` — пустой массив больше не делает tool глобальным
- Soft-delete с реактивацией при повторном install
- Defensive SQL injection prevention (regex-validated table names, parameterized queries)
- Startup restore: L2 agents idempotently create storage tables via `CREATE TABLE IF NOT EXISTS`

**Файлы:**
- `persais-core/src/core/database/schema/light-agents.ts`
- `persais-core/src/core/database/repositories/light-agents.repository.ts`
- `persais-core/src/core/orchestrator/light-agent.service.ts`
- `persais-core/src/core/tools/core/agent-memory.tool.ts`
- `persais-core/src/core/tools/core/manage-agents.tool.ts`
- `persais-core/migrations/0001_light_agents.sql`

### Phase 1.5: L2 Capabilities Expansion — ✅ Done

Расширение возможностей L2-агентов через generic tools. Позволяет покрыть больше кейсов без перехода на H2.

**Реализовано:**

**a) `agent_knowledge` tool — semantic search для L2 агентов**
- Per-agent таблица `agent_<name>_knowledge` с `text`, `embedding vector(1536)`, `metadata jsonb`, `tags`
- Операции: `store`, `search`, `delete`, `list`, `update` (с re-embedding при изменении текста)
- Embedding через `EmbeddingService` (setter injection), graceful degradation при сбое
- Cosine similarity search с threshold + tag-фильтрация

**b) `http_request` tool — generic HTTP client для агентов**
- Два режима: `endpoint` (pre-configured, credentials hidden from LLM) и `get` (public URLs)
- SSRF protection: DNS pre-resolve, private IP blocking (IPv4/IPv6/mapped), protocol whitelist
- Rate limiting: 30 req/min per agent:user pair (sliding window)
- Response processing: JSON truncation >10KB, binary metadata, 15s timeout

**c) Доступ L1/L2 к scheduler и web_access**
- Поддерживается через `tools[]` в манифесте агента
- Master при install указывает нужные tools: `tools: ['web_search', 'manage_schedule']`

**d) Mechanic + manage_agents**
- Mechanic получил доступ к manage_agents tool
- Mechanic сам решает: "достаточно L1/L2" → `manage_agents(install)`, "нужен код" → scaffold H1

**e) Hooks + Endpoints (дополнительно к плану)**
- `HookExecutionService`: post-action hooks (`after:<tool>`, `after:<tool>.<operation>`)
- Inject modes: `result`, `input`, `full` — гибкая передача данных между tools
- Chain depth = 1 (hooks не триггерят hooks), error isolation
- HTTP endpoints в манифесте агента — pre-configured API URLs с hidden credentials

**f) Тесты (161 тест, vitest)**
- Security-critical: isPrivateIp (28 IP cases), rate limit, PRIVILEGED_TOOLS exclusion, chain depth
- Main flow: ToolRegistryService, HookExecutionService, ManageAgentsTool, HttpRequestTool, AgentKnowledgeTool, AgentMemoryTool

**Файлы:**
- `persais-core/src/core/tools/core/agent-knowledge.tool.ts`
- `persais-core/src/core/tools/core/http-request.tool.ts`
- `persais-core/src/core/orchestrator/hook-execution.service.ts`
- `persais-core/src/core/memory/embedding.service.ts`
- `persais-core/vitest.config.ts` + 6 test files

### Phase 2: Heavy Agent Lifecycle (formalize H1/H2)
Формализация существующих агентов: понятие "пакет", clean install/uninstall, стандартизированная структура.
**Ценность:** Агенты становятся управляемыми единицами, основа для стора.

### Phase 3: Transitions (L → H)
Mechanic учится upgrade'ить лёгких агентов в тяжёлых с миграцией данных.
**Ценность:** Полный lifecycle, бесшовный рост агентов.

### Phase 4: Store
Каталог шаблонов, browse/install UX, модерация.
**Ценность:** Marketplace, sharing, масштабирование.

## Real-World Agent Cases (Reference)

Классификация реальных кейсов по 2x2 модели и необходимым capabilities:

| Кейс | Уровень | Tools | Capabilities |
|------|---------|-------|-------------|
| Переводчик | L1 | — | Reactive only |
| Объяснитель терминов | L1 | — | Reactive only |
| Мотивационный коуч | L1 | — | Reactive only |
| Side quests (утром) | L1/L2 | scheduler | Proactive (scheduled). L2 если хранит историю |
| Погода каждое утро | L1 | scheduler, web_access | Proactive + web |
| Мониторинг биржи | L1 | scheduler, web_access | Proactive + web |
| Проверка крипто | L1 | scheduler, web_access | Proactive + web |
| Трекер привычек | L2 | agent_memory | Reactive + structured storage |
| Список покупок | L2 | agent_memory | Reactive + structured storage |
| Книга рецептов | L2 | agent_memory | Reactive + structured storage |
| Заметки | L2 | agent_knowledge | Reactive + semantic search |
| Заметки + sync | L2 | agent_knowledge, http_request | Reactive + knowledge + external API |
| Финансовый аналитик | H2 | custom | Complex logic, reports, custom schema |
| CRM | H2 | custom | Complex relations, workflows |

**Паттерн:** Большинство пользовательских кейсов — комбинация трёх capabilities:
- **Reactive** (ответ на сообщение) — все агенты
- **Proactive** (по расписанию) — scheduler tool
- **Memory** (хранение данных) — agent_memory / agent_knowledge

## Key Design Decisions

| Решение | Выбор | Обоснование |
|---------|-------|-------------|
| Классификация агентов | 2x2 (light/heavy x empty/data) | Чёткая граница по наличию кода |
| Данные лёгких агентов | Персональная JSONB-таблица на агента | Изоляция без загрязнения |
| Данные тяжёлых агентов | Drizzle-схемы + кастомные tools | Полная свобода + безопасность через код |
| Structured vs. knowledge | Два отдельных tool'а | Разные паттерны доступа, не смешивать |
| Auto-schema (CRUD из манифеста) | Отклонено | Промежуточный слой "ни просто, ни мощно" — лишняя сложность |
| Скиллы как отдельная сущность | Отложено | На данном этапе "скилл" = изменение промпта или добавление tool агенту |
| Версионирование агентов | Не нужно | Шаблон — образец, не пакет с версиями |
| Видимость типов для пользователя | Скрыта | Пользователь видит "агент", система решает тип |
| Граница L2/H2 | Надёжность поведения | L2 = "обычно делает". H2 = "гарантированно делает" |

## Phase 1 Implementation Details

### Manifest Format — колонки в таблице `core.light_agents`

```typescript
// Drizzle-схема (core.light_agents)
{
  id: uuid PK,
  name: varchar(50) UNIQUE,      // snake_case идентификатор
  description: text,              // для classifier и пользователя
  systemPrompt: text,             // инструкции агента
  level: varchar(2),              // 'L1' | 'L2'
  tools: jsonb DEFAULT [],        // имена запрошенных tools
  keywords: jsonb DEFAULT [],     // для fast routing в classifier
  maxIterations: integer DEFAULT 10,
  isActive: boolean DEFAULT true, // soft-delete
  installedBy: bigint,            // userId
  templateId: varchar(100),       // для будущего Store
  createdAt, updatedAt
}
```

Валидация через Zod при install. `name` уникален среди ВСЕХ агентов (core + heavy + light).

### Runtime Loader — LightAgentService

`LightAgentService` (Injectable, OnModuleInit) управляет lifecycle:
- **onModuleInit**: читает `light_agents` из БД, регистрирует через `AgentRegistryService.register()`. Для L2 — idempotently creates storage tables.
- **install(manifest, userId)**: validate → check name collision → INSERT (или реактивация soft-deleted) → register → если L2: CREATE TABLE + allowAgentForTool. Try/catch для unique constraint race condition.
- **uninstall(name)**: unregister → disallowAgentForTool → soft-delete. Storage table preserved.
- **update(name, partial)**: UPDATE → re-register
- **upgradeToL2(name)**: CREATE TABLE → UPDATE level → allowAgentForTool → re-register
- **getInfo/listInstalled**: read-only queries

Ключевая находка: `AgentRegistryService` — чистый in-memory Map. Register/unregister мгновенны.
Classifier, Router, SessionManager запрашивают Registry на каждый вызов, не кэшируют.
Поэтому новый агент появляется в роутинге **мгновенно** после register().

### Classifier Integration — ничего не менялось

`IntentClassifierService.classify()` получает `availableAgents` через `agentRegistry.getAgentInfoList()` на каждый вызов. Новый зарегистрированный агент автоматически попадает в классификацию.

### Telegram UX — через Master agent

Управление через tool `manage_agents` у Master'а:
- Пользователь говорит естественным языком: "установи агента для привычек"
- Master формирует манифест, вызывает manage_agents(install)
- Master сам решает L1 vs L2 при установке
- Никаких bot-commands — всё через диалог

### ToolRegistryService fix

`registerForAgents(tool, [], isCore)` больше не делает tool глобальным при пустом массиве. Tool регистрируется как non-global с пустым `allowedAgents`. Агенты добавляются позже через `allowAgentForTool()`. Это критично для `agent_memory` — он не должен быть доступен всем агентам.

### Multi-user — изоляция по user_id

`user_id` из `ToolExecutionContext` добавляется в каждый SQL-запрос agent_memory.
Enforcement на уровне SQL — агент не может увидеть данные другого пользователя.

## Phase 1 Decisions

| Вопрос | Решение | Обоснование |
|--------|---------|-------------|
| Лимит light agents | Нет лимита на Phase 1 | Нет данных для обоснования конкретного числа |
| Удаление при uninstall | Soft-delete + реактивация | `is_active=false`, таблица данных сохраняется. Повторный install реактивирует |
| Master видит данные light agents? | Нет | Только агент-владелец работает со своими данными |
| Порядок загрузки onModuleInit | ToolsModule (sub-module) → LightAgentService → OrchestratorService | NestJS init sub-modules first |
| SQL для agent_memory | Параметризованные запросы | `sql.raw()` только для table name (regex-validated). Все values через `sql``template` |
| registerForAgents([]) | НЕ делает global | Фикс: пустой массив = non-global, agents добавляются через allowAgentForTool |
