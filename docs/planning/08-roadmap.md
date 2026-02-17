# Секция 8: Roadmap

## Scope
Последовательность реализации проекта, зависимости между этапами, критерии завершения.

---

## Обзор этапов

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROADMAP                                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 0: Prerequisites                                    │   │
│  │  - Repository setup                                       │   │
│  │  - External services                                      │   │
│  │  - Development environment                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 1: Foundation (Infrastructure)                      │   │
│  │  - Dockerfile                                             │   │
│  │  - docker-compose.yml                                     │   │
│  │  - Fly.io deployment                                      │   │
│  │  - Aider verification                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 2: Core Logic                                       │   │
│  │  - NestJS skeleton                                        │   │
│  │  - TelegramModule                                         │   │
│  │  - DatabaseModule                                         │   │
│  │  - Basic Orchestrator                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 3: Mechanic Logic                                   │   │
│  │  - CoderModule                                            │   │
│  │  - GitOpsModule                                           │   │
│  │  - Templates system                                       │   │
│  │  - Mechanic agent                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 4: First Evolution                                  │   │
│  │  - Create "Echo" agent via chat                           │   │
│  │  - Validate full workflow                                 │   │
│  │  - 🎯 Mission Accomplished                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 5+: Production Hardening                            │   │
│  │  - Monitoring                                             │   │
│  │  - Error recovery                                         │   │
│  │  - Multi-user support                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 0: Prerequisites

### External Services Setup

| Service | Action | Status |
|---------|--------|--------|
| GitHub | Create repository | ⬜ |
| Fly.io | Create account, install flyctl | ⬜ |
| PostgreSQL | **Neon** (managed PostgreSQL) | ⬜ |
| OpenRouter | Create account, get API key | ⬜ |
| Telegram | Create bot via @BotFather | ⬜ |
| Deepgram | Create account, get API key (for voice) | ⬜ |

### Development Environment

```bash
# Required tools
node --version  # >= 20.x
npm --version   # >= 10.x
docker --version
python3 --version  # >= 3.11 for Aider
aider --version

# Clone repos
git clone git@github.com:USER/persais-core.git
git clone git@github.com:USER/persais.git
cd persais

# Environment variables
cp .env.example .env
# Fill in all values
```

### Repository Structure

```
~/WORK/code/
├── persais-core/          # Ядро (будущий NPM пакет)
│   ├── src/
│   │   ├── core/          # Core modules
│   │   ├── agents/        # Master, Mechanic
│   │   └── shared/
│   ├── templates/
│   └── package.json       # name: "persais-core"
│
└── persais/               # Целевой проект (user code)
    ├── src/
    │   ├── main.ts        # Entry point
    │   ├── agents/        # Dynamic agents
    │   ├── tools/         # Dynamic tools
    │   └── schemas/       # Dynamic schemas
    ├── Dockerfile
    ├── fly.toml
    ├── docker-compose.yml
    └── package.json       # depends on persais-core
```

### Deliverables

- [ ] Repository created with basic structure
- [ ] All external services accounts created
- [ ] API keys obtained and documented
- [ ] Development environment verified
- [ ] Team access configured

---

## Step 1: Foundation (Infrastructure)

### Tasks

#### 1.1 Dockerfile

```dockerfile
# Create multi-stage Dockerfile
# - Stage 1: Node.js builder
# - Stage 2: Python + Node runtime
# - Include: git, aider-chat
```

#### 1.2 docker-compose.yml

```yaml
# Local development setup
# - app (NestJS)
# - postgres (with pgvector)
# - volumes for persistence
# Note: No Redis needed - using In-Memory + Postgres state
```

#### 1.3 Fly.io Configuration

```toml
# fly.toml
# - App name
# - Region
# - Resources (memory, CPU)
# - Health checks
# - Secrets reference
```

#### 1.4 CI/CD Pipeline

```yaml
# .github/workflows/fly-deploy.yml
# - Trigger on push to main
# - Run tests
# - Deploy to Fly.io
```

#### 1.5 Aider Verification

```bash
# Inside container, verify:
aider --version
aider --model openrouter/anthropic/claude-3-opus --message "Say hello" test.py
```

### Dependencies
- External services from Step 0

### Deliverables

- [ ] `docker build` succeeds
- [ ] `docker-compose up` starts all services
- [ ] Fly.io deployment works
- [ ] Aider runs inside container
- [ ] Git operations work from container
- [ ] Health check endpoint responds

### Verification

```bash
# Local
docker-compose up -d
curl http://localhost:3000/health

# Production
flyctl deploy
curl https://APP.fly.dev/health
```

---

## Step 2: Core Logic

### Tasks

#### 2.1 NestJS Skeleton

```
src/
├── app.module.ts
├── main.ts
└── shared/
    ├── config/
    │   └── configuration.ts
    └── types/
        └── index.ts
```

#### 2.2 DatabaseModule

- Drizzle ORM setup
- Connection pool
- Core schema tables
- Migration runner
- Health check

#### 2.3 TelegramModule

- Grammy bot setup
- Webhook controller
- Auth guard (whitelist)
- Emergency commands (/status, /rollback)
- Basic message handling

#### 2.4 Basic Orchestrator

- LangGraph setup
- Simple classifier node
- Postgres checkpointer
- Single test agent (echo)

### Dependencies
- Step 1 complete
- PostgreSQL accessible (Neon)
- Telegram bot created

### Deliverables

- [ ] NestJS app starts without errors
- [ ] Database connection works
- [ ] Core tables migrated
- [ ] Telegram webhook receives messages
- [ ] Auth guard filters unauthorized users
- [ ] /status command works
- [ ] LangGraph processes simple message
- [ ] State persists across restarts

### Verification

```bash
# Send to Telegram bot
/status
# Should respond with system status

# Send normal message
Hello
# Should respond via LangGraph
```

---

## Step 3: Mechanic Logic

### Tasks

#### 3.1 GitOpsModule

- simple-git wrapper
- Branch operations
- Commit/push operations
- Revert operation
- Lock mechanism

#### 3.2 CoderModule

- Aider subprocess management
- Context file management
- Template injection
- Timeout handling
- Error capture

#### 3.3 Templates System

```
_templates/
├── schema.ts.tpl
├── tool.ts.tpl
├── agent.ts.tpl
└── test.ts.tpl
```

#### 3.4 Mechanic Agent

- LangGraph node
- Planning logic
- Tool implementations:
  - scaffold_feature
  - run_coder_task
  - system_check
  - manage_git
  - apply_migration
- Error recovery (3 retries)
- State machine

#### 3.5 Security Layer

- File path validation
- Import validation
- Pre/post Aider hooks
- Audit logging

### Dependencies
- Step 2 complete
- OpenRouter API working
- Git SSH/HTTPS configured

### Deliverables

- [ ] GitOps operations work
- [ ] Aider executes tasks
- [ ] Templates copy correctly
- [ ] Mechanic processes requests
- [ ] Code validation runs
- [ ] Audit log records events
- [ ] Error recovery works
- [ ] /abort cleans up correctly

### Verification

```bash
# Switch to Mechanic
/mechanic

# Request simple change
Add a comment to schema/characters.ts

# Should:
# 1. Create branch
# 2. Run Aider
# 3. Validate
# 4. Commit
# 5. Push
# 6. Show PR link
```

---

## Step 4: First Evolution

### The Test

Ask Mechanic to create a simple "Echo" agent that:
1. Receives user message
2. Returns the same message prefixed with "Echo: "

### Expected Workflow

```
User: /mechanic
Bot: 🔧 Режим Механика активирован

User: Создай агента "Echo", который повторяет сообщения пользователя

Bot: Понял задачу. Создам:
- src/dynamic/agents/echo.agent.ts
- tests/dynamic/echo.agent.test.ts

⏳ Работаю...

Bot: ✅ PR готов!
Branch: feat/add-echo-agent-v1
Files: 2 changed
Tests: ✅ Passed

[Deploy] [Abort] [View PR]

User: clicks [Deploy]

Bot: 🚀 Deployed! Fly.io redeploying...

(After redeploy)

User: /echo
Bot: 🎭 Режим Echo активирован

User: Hello World
Bot: Echo: Hello World

🎯 MISSION ACCOMPLISHED
```

### Success Criteria

- [ ] Mechanic understands the request
- [ ] Creates branch automatically
- [ ] Scaffolds correct files
- [ ] Aider fills in implementation
- [ ] TypeCheck passes
- [ ] Tests pass
- [ ] PR created and pushed
- [ ] Deploy via Telegram works
- [ ] Echo agent works after redeploy

### Deliverables

- [ ] Screenshot/video of full workflow
- [ ] Git history showing the auto-generated code
- [ ] Echo agent functional in production

---

## Step 5+: Production Hardening

### 5.1 Monitoring & Observability

- [ ] Structured logging (JSON)
- [ ] Log aggregation (Fly.io logs / external)
- [ ] Error tracking (Sentry optional)
- [ ] Uptime monitoring
- [ ] Performance metrics

### 5.2 Error Recovery

- [ ] Circuit breaker for Aider
- [ ] Graceful degradation
- [ ] Auto-recovery from crashes
- [ ] Dead letter queue for failed tasks

### 5.3 Multi-User Support (If needed)

- [ ] User isolation
- [ ] Per-user quotas
- [ ] Shared vs private code
- [ ] Billing/usage tracking

### 5.4 Advanced Features

- [ ] Vector search for semantic queries
- [ ] Voice message support
- [ ] Image understanding
- [ ] Multiple LLM providers
- [ ] A/B testing for prompts

### 5.5 Documentation

- [ ] API documentation
- [ ] User guide
- [ ] Admin playbook
- [ ] Incident response guide

---

## Timeline (Rough Estimates)

> Note: Actual timelines depend on complexity discoveries

| Step | Duration | Dependencies |
|------|----------|--------------|
| Step 0 | Day 1 | - |
| Step 1 | Days 2-3 | Step 0 |
| Step 2 | Days 4-6 | Step 1 |
| Step 3 | Days 7-10 | Step 2 |
| Step 4 | Day 11 | Step 3 |
| Step 5+ | Ongoing | Step 4 |

### MVP Target: Step 4 Complete

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Aider doesn't work in container | Test early in Step 1, have backup plan (local Aider via API) |
| LangGraph complexity | Start with simple graph, iterate |
| Fly.io cold start | Optimize image size, use keep-alive |
| OpenRouter rate limits | Implement backoff, monitor usage |
| Git conflicts | Single-user first, lock mechanism |

---

## Decision Log

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| ORM | Prisma, TypeORM, Drizzle | **Drizzle** | Best TS support, code-first schemas |
| Telegram lib | grammy, telegraf | **Grammy** | Более современный, активно развивается |
| Queue | BullMQ, In-Memory | **In-Memory + Postgres** | Без Redis, проще архитектура |
| Hosting | Vercel, Railway, Fly.io | **Fly.io** | Docker support, global |
| PostgreSQL | Supabase, Neon, Fly | **Neon** | Managed, pgvector, free tier |
| Voice STT | Whisper, Deepgram | **Deepgram** | Fast, accurate, simple API |

---

## Вопросы для обсуждения

1. **Timeline priority**:
   - Strict deadline для MVP?
   - Или quality over speed?

2. **Feature scope**:
   - Только Mechanic для MVP?
   - Или Writer agent тоже нужен?

3. **Multi-user**:
   - Single user достаточно для MVP?
   - Когда добавлять multi-user?

4. **Testing strategy**:
   - Full TDD или manual testing для MVP?
   - CI requirements?

5. **Documentation**:
   - Нужна ли документация для MVP?
   - README достаточно?
