# Persais — Self-Evolving Agentic Platform

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Start the database
npm run docker:up

# 4. Reset / initialize the database
npm run db:reset

# 5. Start the app
npm run start:dev
```

## Database Scripts

| Command | Description |
|---|---|
| `npm run db:reset` | Drop everything, re-apply core migrations |
| `npm run db:migrate` | Apply pending user migrations |
| `npm run db:rollback` | Roll back last user migration |
| `npm run db:status` | Show core + user migration status |

## GitOps — GitHub App Permissions

When creating a GitHub App for GitOps integration, configure the following **repository permissions**:

| Permission | Access | Purpose |
|---|---|---|
| **Metadata** | Read *(required)* | Basic repository access |
| **Contents** | **Read & Write** | Commits, branches, push/pull, merge, revert |
| **Pull requests** | **Read & Write** | Create/manage PRs from agent |
| **Commit statuses** | **Read & Write** | Mark commit status (deploy, tests) |
| **Webhooks** | Read & Write | React to push/PR events |

> **Minimum viable:** only **Metadata (Read)** + **Contents (Read & Write)** are required for basic GitOps operations.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram Bot API token |
| `APP_BASE_URL` | ✅ | Public base URL (e.g. https://app.fly.dev) |
| `REGISTRATION_SECRET` | ✅ | Secret key for chat registration |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter LLM API key |
| `DEEPGRAM_API_KEY` | | Deepgram voice transcription key |
| `WEB_ACCESS_API_KEYS` | | Web search API keys (comma-separated for multi-key rotation) |
| `WEB_ACCESS_MONTHLY_LIMIT` | | Per-key monthly credit limit (default: 995) |
