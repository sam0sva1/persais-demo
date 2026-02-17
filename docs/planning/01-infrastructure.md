# Секция 1: Инфраструктура

## Scope
Всё что касается контейнеризации, деплоя, окружения и CI/CD.

---

## Компоненты

### 1.1 Docker Container (Single Container Architecture)

```
┌─────────────────────────────────────────────────┐
│              Docker Container                    │
│  ┌───────────────────────────────────────────┐  │
│  │         Node.js Runtime                    │  │
│  │         (NestJS Application)               │  │
│  │         Port: 3000                         │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │         Python Environment                 │  │
│  │         (aider-chat)                       │  │
│  │         - Runs as subprocess               │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │         Git CLI                            │  │
│  │         - Connected to Remote Repo         │  │
│  │         - SSH keys / HTTPS token           │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 1.2 External Services

| Сервис | Назначение | Managed/Self-hosted |
|--------|------------|---------------------|
| PostgreSQL + pgvector | Основная БД + векторный поиск | Neon |
| GitHub/GitLab | Remote repository | External |
| OpenRouter | AI API для Aider | External |
| Telegram API | Интерфейс пользователя | External |

### 1.3 Fly.io Deployment

- **Trigger**: Push в ветку `main`
- **Build**: Docker image
- **Secrets**: Fly.io Secrets (env vars)
- **Scaling**: Single instance (MVP)

---

## Файлы для создания

| Файл | Описание |
|------|----------|
| `Dockerfile` | Multi-stage build (Node + Python) |
| `docker-compose.yml` | Local development |
| `fly.toml` | Fly.io configuration |
| `.dockerignore` | Exclude unnecessary files |
| `.env.example` | Template для environment variables |

---

## Dockerfile (Draft Structure)

```dockerfile
# Stage 1: Node.js Builder
FROM node:20-alpine AS node-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Python + Node Runtime
FROM python:3.11-slim

# Install Node.js
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    git \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Install aider
RUN pip install aider-chat

# Copy built application
WORKDIR /app
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./

# Git configuration
RUN git config --global user.email "mechanic@persais.ai"
RUN git config --global user.name "Mechanic"

# Setup workspace for code evolution
WORKDIR /workspace
# ... clone repo or mount

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

## Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/persais

# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_WEBHOOK_URL=https://app.fly.dev/telegram/webhook
TELEGRAM_ADMIN_IDS=123456,789012

# AI / OpenRouter
OPENROUTER_API_KEY=xxx
AIDER_MODEL=anthropic/claude-3-opus  # ???

# Git
GIT_REMOTE_URL=https://github.com/user/repo.git
GIT_ACCESS_TOKEN=xxx

# Security
ALLOWED_USER_IDS=123456,789012
```

---

## Вопросы по инфраструктуре

### Критические (блокируют начало работы)

1. **PostgreSQL hosting**: **Решено - Neon**
   - Managed PostgreSQL с pgvector
   - Бесплатный tier для начала

2. **Очереди**: **Решено - In-Memory + Postgres**
   - Без Redis
   - State persistence в Postgres
   - In-memory очереди для простоты

3. **Git внутри контейнера**:
   - Репозиторий клонируется при старте контейнера?
   - Или persistent volume с репозиторием?
   - SSH ключи или HTTPS token для push?

4. **Aider workspace**:
   - Aider работает с копией репозитория внутри контейнера?
   - Как синхронизируется с remote?

### Важные (нужно решить до MVP)

5. **Cold start time**:
   - Сколько времени занимает клонирование репо?
   - Нужен ли warm-up период?

6. **Secrets rotation**:
   - Как обновлять API ключи без downtime?

7. **Logs & Monitoring**:
   - Fly.io logs достаточно?
   - Нужен ли Sentry/Datadog?

8. **Backup strategy**:
   - Как бэкапить Postgres?
   - State LangGraph восстановится из БД?

### Nice-to-have (после MVP)

9. **Multi-region**:
   - Один регион достаточно для начала?

10. **Auto-scaling**:
    - Нужно ли масштабирование или single instance OK?

---

## Риски

| Риск | Вероятность | Impact | Mitigation |
|------|------------|--------|------------|
| Fly.io downtime | Low | High | Backup deployment target |
| Container OOM | Medium | High | Memory limits, monitoring |
| Git conflicts | Medium | Medium | Lock mechanism |
| Aider subprocess hang | Medium | High | Timeout + kill |
| Cold start > 30s | High | Medium | Health checks, keep-alive |

---

## Definition of Done

- [ ] Dockerfile builds successfully
- [ ] docker-compose.yml работает локально
- [ ] Fly.io deployment проходит
- [ ] Health check endpoint отвечает
- [ ] Git clone/push работает из контейнера
- [ ] Aider запускается и отвечает на простую команду
- [ ] Postgres connection pool работает
- [ ] Secrets правильно инжектятся
