# Секция 3: База данных

## Scope
PostgreSQL + pgvector, Drizzle ORM, схемы, миграции, vector search.

---

## Архитектура данных

```
┌─────────────────────────────────────────────────────────────────┐
│                         PostgreSQL                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Core Schema (static)                      ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │ conversations│  │ checkpoints  │  │   audit_log      │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   ││
│  │  ┌──────────────┐  ┌──────────────┐                         ││
│  │  │    agents    │  │    tools     │                         ││
│  │  └──────────────┘  └──────────────┘                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Dynamic Schema (evolving)                  ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │  characters  │  │   projects   │  │  search_index    │   ││
│  │  └──────────────┘  └──────────────┘  │   (pgvector)     │   ││
│  │  ┌──────────────┐  ┌──────────────┐  └──────────────────┘   ││
│  │  │    ideas     │  │    notes     │                         ││
│  │  └──────────────┘  └──────────────┘                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Schema (Static)

### conversations

```typescript
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  messages: jsonb('messages').$type<Message[]>().default([]),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

### langgraph_checkpoints

```typescript
// LangGraph использует свою структуру, но нам нужна таблица
export const checkpoints = pgTable('langgraph_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: text('thread_id').notNull(),
  checkpointId: text('checkpoint_id').notNull(),
  parentId: text('parent_id'),
  checkpoint: jsonb('checkpoint').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  threadCheckpointIdx: index('thread_checkpoint_idx').on(table.threadId, table.checkpointId),
}));
```

### agents (Registry)

```typescript
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  configPath: text('config_path').notNull(), // path to config file
  isActive: boolean('is_active').default(true),
  version: integer('version').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: text('created_by').default('system'),
});
```

### tools (Registry)

```typescript
export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  modulePath: text('module_path').notNull(), // path to TS file
  schema: jsonb('schema').$type<ZodSchema>(), // input schema
  agentId: uuid('agent_id').references(() => agents.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### audit_log

```typescript
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: varchar('action', { length: 50 }).notNull(), // 'code_change', 'deploy', 'rollback'
  actor: varchar('actor', { length: 100 }).notNull(), // 'mechanic', 'user:123'
  details: jsonb('details').$type<AuditDetails>(),
  gitCommit: varchar('git_commit', { length: 40 }),
  gitBranch: varchar('git_branch', { length: 100 }),
  status: varchar('status', { length: 20 }).default('success'),
  createdAt: timestamp('created_at').defaultNow(),
});

interface AuditDetails {
  filesChanged?: string[];
  instruction?: string;
  error?: string;
}
```

---

## Dynamic Schema Template

### Base Fields (Обязательные для всех динамических таблиц)

```typescript
// Каждая динамическая таблица ДОЛЖНА содержать:
const baseFields = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').default(false),
  createdBy: bigint('created_by', { mode: 'number' }), // user_id
};
```

### Пример: characters (Dynamic)

```typescript
// src/dynamic/schema/characters.ts
import { pgTable, uuid, varchar, integer, text, timestamp, boolean, bigint } from 'drizzle-orm/pg-core';

export const characters = pgTable('characters', {
  // Base fields
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').default(false),
  createdBy: bigint('created_by', { mode: 'number' }),

  // Custom fields
  name: varchar('name', { length: 200 }).notNull(),
  role: varchar('role', { length: 100 }),
  age: integer('age'),
  backstory: text('backstory'),
  traits: jsonb('traits').$type<string[]>().default([]),
  projectId: uuid('project_id'), // FK to projects if exists
});
```

---

## Vector Search (pgvector)

### search_index Table

```typescript
export const searchIndex = pgTable('search_index', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Source reference
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'character', 'idea', 'note'
  entityId: uuid('entity_id').notNull(),

  // Content
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI ada-002 or 3072 for text-embedding-3-large

  // Metadata for filtering
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  userId: bigint('user_id', { mode: 'number' }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  embeddingIdx: index('embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  entityIdx: index('entity_idx').on(table.entityType, table.entityId),
}));
```

### Vector Search Query

```typescript
// Semantic search
async function semanticSearch(query: string, userId: number, limit = 10) {
  const queryEmbedding = await getEmbedding(query);

  const results = await db
    .select()
    .from(searchIndex)
    .where(eq(searchIndex.userId, userId))
    .orderBy(sql`embedding <=> ${queryEmbedding}`)
    .limit(limit);

  return results;
}
```

---

## Migrations Strategy

### Workflow

```
1. Механик изменяет схему в src/dynamic/schema/
                    │
                    ▼
2. Механик запускает: drizzle-kit generate
                    │
                    ▼
3. Создаётся SQL файл в src/dynamic/migrations/
                    │
                    ▼
4. Механик запускает: drizzle-kit migrate
                    │
                    ▼
5. Migration applied to database
                    │
                    ▼
6. Git commit + push
```

### Drizzle Kit Config

```typescript
// drizzle.config.ts
export default defineConfig({
  schema: [
    './src/core/schema/*.ts',
    './src/dynamic/schema/*.ts',
  ],
  out: './src/dynamic/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
});
```

### Migration Safety Rules

1. **Never DROP tables** — только `is_deleted = true`
2. **Always add columns as nullable** — или с default value
3. **Test migrations locally** — перед apply в production
4. **Backup before migration** — автоматический pg_dump

---

## Connection Management

### Connection Pool

```typescript
// drizzle.provider.ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool);
```

### Health Check

```typescript
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    return false;
  }
}
```

---

## Вопросы по базе данных

### Критические

1. **pgvector dimensions**:
   - 1536 (OpenAI ada-002) или 3072 (text-embedding-3-large)?
   - Или используем другой embedding provider?

2. **Hosting**:
   - Какой PostgreSQL hosting использовать?
   - Supabase (есть pgvector)? Neon? Fly.io Postgres?

3. **Embedding generation**:
   - Где генерируем embeddings? При создании записи?
   - Batch processing или realtime?

4. **Data ownership**:
   - Multi-tenant (разные пользователи)?
   - Или single-user система?

### Важные

5. **Backup strategy**:
   - Как часто бэкапить?
   - Где хранить бэкапы?

6. **Data retention**:
   - Сколько хранить conversation history?
   - Чистить старые checkpoints?

7. **Indexes**:
   - Какие дополнительные индексы нужны?
   - Performance requirements?

8. **Soft delete vs Hard delete**:
   - is_deleted везде? Или где-то hard delete OK?

---

## Files Structure

```
src/
├── core/
│   └── schema/
│       ├── conversations.ts
│       ├── checkpoints.ts
│       ├── agents.ts
│       ├── tools.ts
│       ├── audit-log.ts
│       └── index.ts
│
└── dynamic/
    ├── schema/
    │   ├── .gitkeep
    │   └── (created by Mechanic)
    │
    └── migrations/
        ├── .gitkeep
        └── (generated by drizzle-kit)
```

---

## Definition of Done

- [ ] PostgreSQL с pgvector настроен и работает
- [ ] Core schema создана и мигрирована
- [ ] Drizzle ORM подключен к NestJS
- [ ] Dynamic schema loader работает
- [ ] Migration workflow протестирован
- [ ] Vector search работает
- [ ] Connection pool настроен
- [ ] Health check endpoint для DB
- [ ] Audit log записывает события
