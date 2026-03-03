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

## Documentation

- [Setup & Environment](docs/setup.md) — prerequisites, env variables, project structure
- [Creating Agents](docs/creating-agents.md) — manifest, prompt, handler, tools, hooks, endpoints

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
