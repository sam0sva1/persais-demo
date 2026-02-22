# 03a — Migration System

## Why Two Separate Migration Tracks

Core (persais-core) and user (persais) code evolve independently. Core tables are infrastructure — they must be forward-only and auto-applied on every startup. User tables are feature-driven — they must support rollback for GitOps branch switching and iterative development.

Mixing them in one journal would mean either:
- No rollback for anything (unsafe for user development)
- Rollback for core tables (breaks infrastructure guarantees)

## Two PostgreSQL Schemas

| PG Schema | Owner | Purpose |
|-----------|-------|---------|
| `core` | persais-core | Infrastructure tables (journals, chat state, audit) |
| `public` | persais (user) | Feature tables (characters, items, etc.) |

## Dual Journal

Both journal tables live in the `core` schema:

- `core.__core_migrations` — forward-only, no rollback columns
- `core.__user_migrations` — stores `down_sql` for rollback, tracks `rolled_back_at`

**Why both journals in `core`?** The journal is infrastructure, not user data. If `public` schema gets dropped during a rollback, the journal must survive to record what happened.

## DownGenerator

Auto-generates reverse SQL from up.sql. Covers:
- `CREATE TABLE` → `DROP TABLE IF EXISTS ... CASCADE`
- `ALTER TABLE ADD COLUMN` → `ALTER TABLE DROP COLUMN IF EXISTS`
- `ALTER TABLE ADD CONSTRAINT` → `ALTER TABLE DROP CONSTRAINT IF EXISTS`
- `CREATE INDEX` → `DROP INDEX IF EXISTS`
- `CREATE SCHEMA` → `DROP SCHEMA IF EXISTS ... CASCADE`
- `CREATE TYPE` → `DROP TYPE IF EXISTS`

Unknown statements get a `-- TODO: reverse manually` comment (safe — won't break execution).

## syncWithBranch (GitOps Safety)

On startup, compares migration files on disk with journal entries:
1. If journal has a version that doesn't exist on disk → file was removed (branch switch)
2. Rolls back orphaned entries using stored `down_sql`
3. Then normal `applyUserMigrations` picks up any new files

This makes `git checkout feature-branch && restart` safe.

## Transactional Apply

Each user migration is applied inside a PostgreSQL transaction:
- DDL statements (CREATE TABLE, etc.) + journal INSERT are atomic
- If journal write fails, DDL is rolled back — no inconsistent state
- PostgreSQL supports transactional DDL (unlike MySQL)

Re-apply after rollback uses UPSERT (`ON CONFLICT DO UPDATE`) on the journal's `version` column — the same row is reused with updated `applied_at` and cleared `rolled_back_at`.

## Full Pipeline

```
schema.ts (Drizzle ORM)
    ↓
drizzle-kit generate  →  migrations/NNNN_name.sql
    ↓
MigrationRunner.applyUserMigrations()
    ├── reads .sql files from disk
    ├── auto-generates down_sql via DownGenerator (if not provided)
    ├── BEGIN transaction
    │   ├── executes up_sql
    │   └── UPSERT into core.__user_migrations (with down_sql)
    └── COMMIT
    ↓
Rollback via stored down_sql (no file needed)
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Apply pending user migrations |
| `npm run db:rollback` | Roll back last N user migrations |
| `npm run db:status` | Show migration status for both journals |
| `npm run db:reset` | Drop everything, re-run core migrations (dev only) |

## Dependency Model

drizzle-kit and drizzle-orm are **peerDependencies** of persais-core:

```jsonc
// persais-core/package.json
"peerDependencies": {
  "drizzle-orm": "^0.45.0",
  "drizzle-kit": ">=0.31.0"
}
```

**drizzle-kit** — user project installs it (satisfying peerDep), but never imports from it directly. Core provides `createDrizzleConfig()` that absorbs drizzle-kit's config API changes:

```typescript
// persais/drizzle.config.ts
import { createDrizzleConfig } from 'persais-core';
export default createDrizzleConfig();
```

When core upgrades drizzle-kit and the config API changes, the helper is updated in core — user code stays untouched.

**drizzle-orm** — user imports directly (`pgTable`, `text`, etc.) for writing schemas. This is intentional — drizzle-orm is the user's "schema language", wrapping it would break ecosystem compatibility (docs, examples, IDE support). peerDependency ensures version alignment.

## apply_migration Tool

The Mechanic agent uses the `apply_migration` tool:
- `generate` — runs `drizzle-kit generate` (creates .sql files)
- `apply` — runs through MigrationRunner (sync + apply, with auto down_sql)
- `push` — runs `drizzle-kit push` (prototyping, no migration files)
