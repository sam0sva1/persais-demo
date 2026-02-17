# CLAUDE.md - Project Instructions

## Project Overview

**Persais** - Self-Evolving Agentic Platform на базе NestJS, работающая в одном Docker-контейнере:
- Чат-бот (Telegram + Grammy)
- Оркестратор AI-агентов (LangGraph)
- Среда саморазвития (Aider + GitOps)

## Repository Structure

Проект состоит из двух репозиториев:
- `persais-core/` - ядро (будущий NPM пакет)
- `persais/` - целевой проект (user code)

```
~/WORK/code/
├── persais-core/          # Ядро
│   ├── src/
│   │   ├── core/          # Core modules (Telegram, Database, GitOps, Coder)
│   │   ├── agents/        # Master, Mechanic
│   │   └── shared/        # Types, utils
│   ├── templates/         # Templates for Mechanic
│   └── package.json
│
└── persais/               # Целевой проект
    ├── src/
    │   ├── main.ts        # Entry point (calls bootstrap from core)
    │   ├── agents/        # Dynamic agents
    │   ├── tools/         # Dynamic tools
    │   └── schemas/       # Dynamic schemas
    ├── docs/planning/     # Project documentation
    └── package.json
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ (NestJS) |
| Language | TypeScript (Strict Mode) |
| Database | PostgreSQL + pgvector (Neon) |
| ORM | Drizzle |
| Queues | **In-Memory + Postgres** (NO Redis!) |
| AI Gateway | OpenRouter |
| AI Models | Claude 3 Haiku (classifier), Claude 3.5 Sonnet (agents/aider) |
| Speech-to-Text | Deepgram (nova-2) |
| Telegram | Grammy |
| Validation | Zod |
| Deployment | Fly.io |

## Key Architectural Decisions

### No Redis
Очереди и state хранятся в памяти с Postgres fallback для recovery. Не использовать BullMQ, Upstash, ioredis.

### Two-Repository Model
`persais-core` содержит всё ядро и экспортирует `bootstrap(config)` функцию. `persais` содержит user code и вызывает bootstrap.

### Agent Architecture
```
Telegram → Intent Classifier (Haiku) → Current Agent или Orchestrator (Sonnet)
                                              ↓
                                    Master / Mechanic / Dynamic Agents
```

### Message Aggregator
Smart batching с 5s debounce, группировка по intent, In-Memory + Postgres state.

## Development Guidelines

### File Organization
- Core modules: `persais-core/src/core/`
- Base agents (Master, Mechanic): `persais-core/src/agents/`
- Dynamic agents/tools/schemas: `persais/src/agents|tools|schemas/`
- Templates for Mechanic: `persais-core/templates/`

### Naming Conventions
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Database tables: `snake_case`
- Tools: `snake_case` (e.g., `add_character`)

### Important Patterns
1. **DI через NestJS** - все сервисы инжектируются через конструктор
2. **Zod для валидации** - все input/output schemas через Zod
3. **Drizzle ORM** - code-first schemas, не Prisma
4. **Structured output** - SGR для classifier и planning

## Planning Workflow

Перед каждой секцией работы:
1. Обновить `plan.md` с описанием задач
2. Отмечать выполненные пункты
3. После завершения секции - делать коммит

## Documentation

Вся документация в `/docs/planning/`:
- [00-master-overview.md](docs/planning/00-master-overview.md) - общий обзор
- [questions-answered.md](docs/planning/questions-answered.md) - все решения

## Commands

```bash
# Development
npm run dev          # Start in dev mode
npm run build        # Build
npm run typecheck    # TypeScript check
npm test             # Run tests

# Database
npx drizzle-kit generate   # Generate migrations
npx drizzle-kit migrate    # Apply migrations

# Docker
docker-compose up -d       # Start local services
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_ALLOWED_USER_IDS=123456
OPENROUTER_API_KEY=xxx

# Optional
DEEPGRAM_API_KEY=xxx       # For voice messages
GIT_REMOTE_URL=xxx         # For GitOps
GIT_ACCESS_TOKEN=xxx
```
