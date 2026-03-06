# Setup Guide

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** with pgvector extension (local via Docker or [Neon](https://neon.tech) for production)
- **Telegram Bot** — create via [@BotFather](https://t.me/BotFather), copy the bot token
- **OpenRouter** API key — register at [openrouter.ai](https://openrouter.ai), create a key in [Keys](https://openrouter.ai/keys)

## Environment Variables

Copy `.env.example` and fill in the values:

```bash
cp .env.example .env
```

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token |
| `TELEGRAM_REGISTRATION_SECRET` | Secret for bot registration (any string you choose) |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM access |

### Models (all have defaults)

All models are specified as OpenRouter model IDs. Browse available models at [openrouter.ai/models](https://openrouter.ai/models).

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_MODEL` | `openai/gpt-5-mini` | Primary model for agents |
| `FALLBACK_MODEL` | `google/gemini-2.5-flash` | Fallback when primary fails |
| `CLASSIFIER_MODEL` | `google/gemini-2.5-flash-lite` | Fast, cheap model for intent classification |
| `CODER_MODEL` | *(uses DEFAULT_MODEL)* | Override for Mechanic/Aider |
| `OPENROUTER_PROVIDER_ORDER` | *(empty)* | Comma-separated provider priority (optional, see below) |
| `OPENROUTER_ALLOW_FALLBACKS` | `true` | Allow routing beyond ordered list |
| `MODEL_TIMEOUT` | `60000` | Request timeout in ms |

> **`OPENROUTER_PROVIDER_ORDER`** — pin specific providers for a model (e.g. `OpenAI,Together`). Useful when a model is hosted by multiple providers and you want to control latency/reliability. Leave empty to let OpenRouter decide.

### Optional Services

| Variable | Enables | Where to get | Description |
|---|---|---|---|
| `APP_BASE_URL` | Webhooks | — | Public URL (e.g. `https://app.fly.dev`). For local dev, use [ngrok](https://ngrok.com) |
| `SPEECH_API_KEY` | Voice | [deepgram.com](https://console.deepgram.com) | Speech processing (STT/TTS). Currently uses Deepgram |
| `WEB_ACCESS_API_KEYS` | `web_search`, `web_extract` | [tavily.com](https://app.tavily.com) | Comma-separated API keys (multi-key rotation, ~1000 free credits/key/month) |
| `WEB_ACCESS_MONTHLY_LIMIT` | — | — | Per-key monthly limit (default: 995) |
| `CRONOS_API_KEY` | `manage_schedule` | [cronos](https://cronos-for-ai-agents.fly.dev) | Scheduler service API key |
| `SCHEDULER_WEBHOOK_SECRET` | — | — | Required when CRONOS_API_KEY is set (any random string) |
| `GIT_REMOTE_URL` | GitOps | — | GitHub repo URL for Mechanic |
| `GIT_ACCESS_TOKEN` | GitOps | [GitHub Settings](https://github.com/settings/tokens) | Personal access token with repo scope |
| `PORT` | — | — | Server port (default: 3000) |

> If an optional service env var is missing, the corresponding tools are skipped at startup with a warning. Agents that request those tools still load — they just won't have access to them.

## Quick Start

```bash
# 1. Install dependencies (from workspace root)
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Start the database
npm run docker:up

# 4. Initialize the database (drops and re-creates all tables)
npm run db:reset

# 5. Start the app
npm run start:dev
```

## Project Structure

```
persais/
├── src/
│   ├── main.ts          # Entry point — calls start() from persais-core
│   ├── agents/          # Your custom agents (manifest.json + prompt.md per agent)
│   ├── tools/           # Custom tool definitions
│   ├── schemas/         # Custom Drizzle schemas
│   ├── tasks/           # Mechanic task files
│   └── migrations/      # User DB migrations
├── docs/                # Documentation
├── docker-compose.yml   # Local PostgreSQL + pgvector
├── .env                 # Environment variables (not committed)
└── .env.example         # Template for .env
```

## Database Scripts

| Command | Description |
|---|---|
| `npm run db:reset` | Drop everything, re-apply core migrations |
| `npm run db:migrate` | Apply pending user migrations |
| `npm run db:rollback` | Roll back last user migration |
| `npm run db:status` | Show core + user migration status |

## Useful Commands

```bash
npm run start:dev    # Start with hot-reload
npm run build        # Compile TypeScript
npm run typecheck    # Type-check without emitting
npm run docker:up    # Start local PostgreSQL
npm run docker:down  # Stop local PostgreSQL
```
