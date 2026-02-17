# Секция 9: Дистрибуция (Backlog)

## Статус: 📋 BACKLOG (после MVP)

Этот документ описывает план по упаковке проекта для переиспользования другими. Реализация после стабилизации MVP.

---

## Концепция: "Core as a Dependency"

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTION MODEL                            │
│                                                                  │
│   ┌──────────────────────┐      ┌──────────────────────────┐   │
│   │   persais-core       │      │   persais-starter        │   │
│   │   (NPM Package)      │      │   (Template Repo)        │   │
│   │                      │      │                          │   │
│   │  - AgentOrchestrator │      │  - package.json          │   │
│   │  - TelegramService   │      │  - fly.toml              │   │
│   │  - AiderWrapper      │      │  - Dockerfile            │   │
│   │  - IntentClassifier  │      │  - .env.example          │   │
│   │  - MessageAggregator │      │  - src/                  │   │
│   │  - Base migrations   │      │    ├── main.ts           │   │
│   │                      │      │    ├── agents/           │   │
│   │  bootstrap(config)   │      │    └── tools/            │   │
│   └──────────────────────┘      └──────────────────────────┘   │
│              │                              │                    │
│              └──────────────┬───────────────┘                   │
│                             │                                    │
│                             ▼                                    │
│              ┌──────────────────────────────┐                   │
│              │   npx create-persais-app     │                   │
│              │        (CLI Wizard)          │                   │
│              └──────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Фазы развёртывания

### Фаза 1: Local Development (ТЕКУЩАЯ)
```
persais-core/ + persais/ → npm link → npm run dev
```
- Два репозитория рядом
- npm link для связывания
- Docker Compose для Postgres
- Быстрая итерация

### Фаза 2: Container Deployment
```
docker build (с обоими репо) → fly deploy
```
- Упаковка в Docker контейнер
- Деплой на Fly.io
- Managed database (Neon)

### Фаза 3: Distribution
```
npx create-persais-app my-bot
```
- NPM пакет с ядром (persais-core)
- Template repo для пользователей
- CLI wizard для быстрого старта

---

## Архитектура для дистрибуции

### Два репозитория

#### 1. `persais-core` (NPM Package)

```
persais-core/
├── src/
│   ├── index.ts              # Main exports
│   ├── bootstrap.ts          # bootstrap(config) function
│   │
│   ├── core/
│   │   ├── telegram/
│   │   ├── orchestrator/
│   │   ├── database/
│   │   ├── gitops/
│   │   └── coder/
│   │
│   ├── agents/
│   │   ├── master/           # Orchestrator agent
│   │   └── mechanic/         # Mechanic agent
│   │
│   └── shared/
│       ├── types/
│       └── utils/
│
├── migrations/               # Base migrations
├── templates/                # Code templates for Mechanic
│
├── package.json
└── tsconfig.json
```

**Exports:**
```typescript
// index.ts
export { bootstrap } from './bootstrap';
export { BaseAgent, AgentConfig } from './agents/base';
export { DynamicTool, ToolExecutionContext } from './core/tools/base';
export * from './shared/types';
```

**Bootstrap API:**
```typescript
// bootstrap.ts
interface PersaisConfig {
  // Required
  telegram: {
    token: string;
    webhookUrl?: string;
    allowedUserIds: number[];
  };
  database: {
    url: string;
  };
  openRouter: {
    apiKey: string;
  };

  // Optional
  deepgram?: {
    apiKey: string;
  };
  git?: {
    remoteUrl: string;
    accessToken: string;
  };

  // Custom extensions
  agentsDir?: string;     // default: './src/agents'
  toolsDir?: string;      // default: './src/tools'
  schemasDir?: string;    // default: './src/schemas'
}

export async function bootstrap(config: PersaisConfig): Promise<INestApplication> {
  // 1. Create NestJS app
  // 2. Load dynamic agents/tools from specified dirs
  // 3. Start Telegram webhook
  // 4. Return app instance
}
```

#### 2. `persais-starter` (Template Repo)

```
persais-starter/
├── src/
│   ├── main.ts               # Entry point
│   ├── agents/               # User's custom agents
│   │   └── .gitkeep
│   ├── tools/                # User's custom tools
│   │   └── .gitkeep
│   └── schemas/              # User's custom schemas
│       └── .gitkeep
│
├── package.json              # { "persais-core": "^1.0.0" }
├── tsconfig.json
├── Dockerfile
├── fly.toml
├── docker-compose.yml        # For local dev
├── .env.example
└── README.md
```

**Entry point (main.ts):**
```typescript
import { bootstrap } from 'persais-core';
import * as path from 'path';

async function main() {
  const app = await bootstrap({
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN!,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      allowedUserIds: process.env.TELEGRAM_ALLOWED_USER_IDS!.split(',').map(Number),
    },
    database: {
      url: process.env.DATABASE_URL!,
    },
    openRouter: {
      apiKey: process.env.OPENROUTER_API_KEY!,
    },
    deepgram: process.env.DEEPGRAM_API_KEY ? {
      apiKey: process.env.DEEPGRAM_API_KEY,
    } : undefined,

    // Point to local directories
    agentsDir: path.join(__dirname, 'agents'),
    toolsDir: path.join(__dirname, 'tools'),
    schemasDir: path.join(__dirname, 'schemas'),
  });

  await app.listen(process.env.PORT || 3000);
}

main();
```

---

## CLI Wizard: `create-persais-app`

### Usage
```bash
npx create-persais-app my-bot
```

### Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                    create-persais-app                            │
│                                                                  │
│  1. "What's your bot name?" → my-bot                            │
│                                                                  │
│  2. Clone persais-starter → ./my-bot                            │
│                                                                  │
│  3. "Enter your API keys:"                                      │
│     - Telegram Bot Token: ****                                  │
│     - OpenRouter API Key: ****                                  │
│     - Deepgram API Key (optional): ****                         │
│                                                                  │
│  4. Generate .env file                                          │
│                                                                  │
│  5. "Deploy to Fly.io?" [Y/n]                                   │
│     │                                                           │
│     ├─► YES:                                                    │
│     │   - fly launch                                            │
│     │   - Configure Neon Postgres                               │
│     │   - fly secrets set ...                                   │
│     │   - fly deploy                                            │
│     │                                                           │
│     └─► NO:                                                     │
│         - npm install                                           │
│         - "Run 'npm run dev' to start locally"                  │
│                                                                  │
│  6. Done! "Your bot is running at https://my-bot.fly.dev"       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Обновления через GitOps

### Сценарий обновления ядра

```
1. Выпуск persais-core@1.1.0 (новая фича)
                    │
                    ▼
2. Механик видит обновление (через tool или notification)
                    │
                    ▼
3. Механик выполняет: npm install persais-core@latest
                    │
                    ▼
4. Механик коммитит: package.json, package-lock.json
                    │
                    ▼
5. Git push → Fly.io пересобирает контейнер
                    │
                    ▼
6. Новая версия ядра работает, код пользователя нетронут
```

### Важно: Изоляция кода

```
/my-bot
├── node_modules/
│   └── persais-core/    ← Обновляется через npm
│
└── src/
    ├── agents/           ← Код пользователя (не трогается)
    ├── tools/            ← Код пользователя (не трогается)
    └── schemas/          ← Код пользователя (не трогается)
```

---

## Влияние на текущую архитектуру

### Что учесть сейчас

1. **Модульность**
   - Все core modules должны быть независимыми
   - Конфигурация через DI, не через hardcoded paths

2. **Configurable paths**
   - `agentsDir`, `toolsDir`, `schemasDir` как параметры
   - Не хардкодить пути

3. **Clean exports**
   - Чёткий public API для ядра
   - Типы для пользовательских расширений

4. **Bootstrap function**
   - Единая точка входа
   - Принимает конфиг, возвращает app

5. **Base vs Custom**
   - Master + Mechanic = часть ядра
   - Dynamic agents = код пользователя

### Структура для MVP (с учётом дистрибуции)

```
~/WORK/code/
├── persais-core/             # Ядро
│   ├── src/
│   │   ├── core/
│   │   │   ├── telegram/
│   │   │   ├── orchestrator/
│   │   │   ├── database/
│   │   │   ├── gitops/
│   │   │   └── coder/
│   │   ├── agents/
│   │   │   ├── master/
│   │   │   └── mechanic/
│   │   └── shared/
│   ├── templates/
│   ├── bootstrap.ts
│   └── index.ts
│
└── persais/                  # Целевой проект
    ├── src/
    │   ├── main.ts           # Вызывает bootstrap из ядра
    │   ├── agents/           # Dynamic agents
    │   ├── tools/            # Dynamic tools
    │   └── schemas/          # Dynamic schemas
    ├── Dockerfile
    └── fly.toml
```

---

## Roadmap дистрибуции

### Step 5: Package Preparation
- [ ] Выделить core в persais-core/
- [ ] Создать bootstrap.ts с чистым API
- [ ] Определить public exports
- [ ] Написать типы для расширений

### Step 6: NPM Package
- [ ] Настроить сборку библиотеки
- [ ] Опубликовать persais-core
- [ ] Версионирование (semver)

### Step 7: Starter Template
- [ ] Создать persais-starter repo
- [ ] Минимальный main.ts
- [ ] Готовые Dockerfile, fly.toml
- [ ] Документация

### Step 8: CLI Wizard
- [ ] Создать create-persais-app
- [ ] Интерактивный setup
- [ ] Интеграция с Fly.io
- [ ] Опубликовать в npm

---

## Definition of Done (для дистрибуции)

- [ ] Ядро работает как npm пакет
- [ ] Starter template создаётся за 5 минут
- [ ] CLI wizard проводит через setup
- [ ] Обновление ядра через npm работает
- [ ] Код пользователя изолирован от ядра
- [ ] Документация для пользователей
