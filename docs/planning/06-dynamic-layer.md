# Секция 6: Dynamic Layer

## Scope
Всё что создаётся и модифицируется Механиком: agents, tools, schemas, migrations.

---

## Структура папок

```
src/
└── dynamic/                    # ВСЁ ЗДЕСЬ управляется Механиком
    ├── agents/                 # Конфигурации динамических агентов
    │   ├── .gitkeep
    │   └── echo.agent.ts       # Example dynamic agent
    │
    ├── tools/                  # Динамические инструменты
    │   ├── .gitkeep
    │   └── add_character.ts    # Example tool
    │
    ├── schema/                 # Drizzle схемы новых таблиц
    │   ├── .gitkeep
    │   └── characters.ts       # Example schema
    │
    └── migrations/             # Сгенерированные SQL миграции
        ├── .gitkeep
        └── 0001_add_characters.sql

tests/
└── dynamic/                    # Тесты для динамического кода
    ├── .gitkeep
    └── add_character.test.ts

_templates/                     # Шаблоны (НЕ редактируются Механиком)
├── schema.ts.tpl
├── tool.ts.tpl
├── agent.ts.tpl
└── test.ts.tpl
```

---

## Templates

### schema.ts.tpl

```typescript
// Template for Drizzle schema
// DO NOT MODIFY - Used by Mechanic

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  bigint,
  jsonb,
} from 'drizzle-orm/pg-core';

/**
 * {{entityName}} Schema
 * Created by Mechanic on {{date}}
 *
 * TODO: Fill in the custom fields below
 */
export const {{tableName}} = pgTable('{{tableName}}', {
  // === BASE FIELDS (Required) ===
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').default(false),
  createdBy: bigint('created_by', { mode: 'number' }),

  // === CUSTOM FIELDS ===
  // TODO: Add entity-specific fields here
  // Example:
  // name: varchar('name', { length: 200 }).notNull(),
  // description: text('description'),
  // count: integer('count').default(0),
});

// TypeScript type inference
export type {{entityName}} = typeof {{tableName}}.$inferSelect;
export type New{{entityName}} = typeof {{tableName}}.$inferInsert;
```

### tool.ts.tpl

```typescript
// Template for Dynamic Tool
// DO NOT MODIFY - Used by Mechanic

import { z } from 'zod';
import { DynamicTool, ToolExecutionContext } from '@/core/tools/base';
import { db } from '@/core/database';
import { {{tableName}} } from '@/dynamic/schema/{{tableName}}';

/**
 * {{toolName}} Tool
 * Created by Mechanic on {{date}}
 *
 * Description: TODO: Add description
 */

// Input validation schema
const inputSchema = z.object({
  // TODO: Define input fields
  // Example:
  // name: z.string().min(1).max(200),
  // role: z.string().optional(),
  // age: z.number().int().positive().optional(),
});

type Input = z.infer<typeof inputSchema>;

// Output type
interface Output {
  success: boolean;
  id?: string;
  error?: string;
}

export class {{ToolClass}} extends DynamicTool<Input, Output> {
  name = '{{toolName}}';
  description = 'TODO: Add description';
  schema = inputSchema;

  async execute(input: Input, context: ToolExecutionContext): Promise<Output> {
    try {
      // TODO: Implement tool logic
      // Example:
      // const [result] = await db.insert({{tableName}}).values({
      //   ...input,
      //   createdBy: context.userId,
      // }).returning();
      //
      // return { success: true, id: result.id };

      throw new Error('Not implemented');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export instance for tool registry
export default new {{ToolClass}}();
```

### agent.ts.tpl

```typescript
// Template for Dynamic Agent
// DO NOT MODIFY - Used by Mechanic

import { BaseAgent, AgentConfig, AgentResponse } from '@/core/agents/base';
import { Message } from '@/shared/types';

/**
 * {{agentName}} Agent
 * Created by Mechanic on {{date}}
 *
 * Purpose: TODO: Add purpose
 */

export const config: AgentConfig = {
  name: '{{agentName}}',
  description: 'TODO: Add description',
  systemPrompt: `
    You are {{agentName}}, a specialized agent.

    TODO: Add detailed instructions
  `,
  tools: [
    // TODO: List tool names this agent can use
    // 'add_character',
    // 'search_characters',
  ],
  maxTurns: 10,
};

export class {{AgentClass}} extends BaseAgent {
  config = config;

  async processMessage(message: Message): Promise<AgentResponse> {
    // TODO: Implement custom message processing if needed
    // Default behavior: use LLM with configured tools

    return this.runWithTools(message);
  }
}

export default new {{AgentClass}}();
```

### test.ts.tpl

```typescript
// Template for Tool Test
// DO NOT MODIFY - Used by Mechanic

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/core/database';
import {{ToolClass}} from '@/dynamic/tools/{{toolName}}';

describe('{{toolName}}', () => {
  const testContext = {
    userId: 123456,
    chatId: 123456,
    conversationId: 'test-conv-id',
  };

  beforeAll(async () => {
    // Setup: clean test data
  });

  afterAll(async () => {
    // Cleanup: remove test data
  });

  it('should be defined', () => {
    expect({{ToolClass}}).toBeDefined();
    expect({{ToolClass}}.name).toBe('{{toolName}}');
  });

  it('should have valid schema', () => {
    expect({{ToolClass}}.schema).toBeDefined();
  });

  // TODO: Add specific test cases
  // Example:
  // it('should create a new record', async () => {
  //   const result = await {{ToolClass}}.execute(
  //     { name: 'Test', role: 'Hero' },
  //     testContext
  //   );
  //   expect(result.success).toBe(true);
  //   expect(result.id).toBeDefined();
  // });

  it('should handle invalid input', async () => {
    const result = await {{ToolClass}}.execute(
      {} as any,
      testContext
    );
    expect(result.success).toBe(false);
  });
});
```

---

## Dynamic Loading

### Schema Loader

```typescript
// core/database/schema-loader.ts

import { glob } from 'glob';
import * as path from 'path';

interface DynamicSchema {
  tableName: string;
  schema: any;
  types: {
    select: any;
    insert: any;
  };
}

export async function loadDynamicSchemas(): Promise<Map<string, DynamicSchema>> {
  const schemas = new Map<string, DynamicSchema>();

  const schemaFiles = await glob('src/dynamic/schema/*.ts', {
    ignore: ['**/*.tpl', '**/.gitkeep'],
  });

  for (const file of schemaFiles) {
    try {
      const module = await import(path.resolve(file));

      // Find exported table
      for (const [key, value] of Object.entries(module)) {
        if (value && typeof value === 'object' && '_' in value) {
          // This is likely a Drizzle table
          const tableName = key;
          schemas.set(tableName, {
            tableName,
            schema: value,
            types: {
              select: module[`${key.charAt(0).toUpperCase() + key.slice(1)}`],
              insert: module[`New${key.charAt(0).toUpperCase() + key.slice(1)}`],
            },
          });
        }
      }
    } catch (error) {
      console.error(`Failed to load schema from ${file}:`, error);
    }
  }

  return schemas;
}
```

### Tool Registry

```typescript
// core/tools/registry.ts

import { glob } from 'glob';
import * as path from 'path';
import { DynamicTool } from './base';

class ToolRegistry {
  private tools = new Map<string, DynamicTool<any, any>>();

  async loadDynamicTools(): Promise<void> {
    const toolFiles = await glob('src/dynamic/tools/*.ts', {
      ignore: ['**/*.tpl', '**/.gitkeep'],
    });

    for (const file of toolFiles) {
      try {
        const module = await import(path.resolve(file));
        const tool = module.default as DynamicTool<any, any>;

        if (tool && tool.name) {
          this.register(tool);
        }
      } catch (error) {
        console.error(`Failed to load tool from ${file}:`, error);
      }
    }
  }

  register(tool: DynamicTool<any, any>): void {
    this.tools.set(tool.name, tool);
    console.log(`Registered tool: ${tool.name}`);
  }

  get(name: string): DynamicTool<any, any> | undefined {
    return this.tools.get(name);
  }

  getAll(): DynamicTool<any, any>[] {
    return Array.from(this.tools.values());
  }

  // For LangGraph
  getToolsForAgent(toolNames: string[]): DynamicTool<any, any>[] {
    return toolNames
      .map(name => this.get(name))
      .filter((t): t is DynamicTool<any, any> => t !== undefined);
  }
}

export const toolRegistry = new ToolRegistry();
```

### Agent Registry

```typescript
// core/agents/registry.ts

import { glob } from 'glob';
import * as path from 'path';
import { BaseAgent, AgentConfig } from './base';
import { db } from '../database';
import { agents } from '../schema/agents';
import { eq } from 'drizzle-orm';

class AgentRegistry {
  private agents = new Map<string, BaseAgent>();

  async loadDynamicAgents(): Promise<void> {
    // Load from files
    const agentFiles = await glob('src/dynamic/agents/*.ts', {
      ignore: ['**/*.tpl', '**/.gitkeep'],
    });

    for (const file of agentFiles) {
      try {
        const module = await import(path.resolve(file));
        const agent = module.default as BaseAgent;

        if (agent && agent.config?.name) {
          this.register(agent);
        }
      } catch (error) {
        console.error(`Failed to load agent from ${file}:`, error);
      }
    }

    // Sync with database
    await this.syncWithDatabase();
  }

  private async syncWithDatabase(): Promise<void> {
    for (const [name, agent] of this.agents) {
      const existing = await db.query.agents.findFirst({
        where: eq(agents.name, name),
      });

      if (!existing) {
        await db.insert(agents).values({
          name,
          description: agent.config.description,
          configPath: `src/dynamic/agents/${name}.ts`,
          isActive: true,
        });
      }
    }
  }

  register(agent: BaseAgent): void {
    this.agents.set(agent.config.name, agent);
    console.log(`Registered agent: ${agent.config.name}`);
  }

  get(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }
}

export const agentRegistry = new AgentRegistry();
```

---

## Hot Reload (Development)

```typescript
// core/dynamic/hot-reload.ts

import chokidar from 'chokidar';
import { toolRegistry } from '../tools/registry';
import { agentRegistry } from '../agents/registry';
import { loadDynamicSchemas } from '../database/schema-loader';

export function setupHotReload(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const watcher = chokidar.watch('src/dynamic/**/*.ts', {
    ignored: /node_modules/,
    persistent: true,
  });

  watcher.on('change', async (path) => {
    console.log(`File changed: ${path}`);

    // Clear require cache
    delete require.cache[require.resolve(path)];

    if (path.includes('/tools/')) {
      await toolRegistry.loadDynamicTools();
    } else if (path.includes('/agents/')) {
      await agentRegistry.loadDynamicAgents();
    } else if (path.includes('/schema/')) {
      await loadDynamicSchemas();
      console.log('Schemas reloaded. Note: migrations may be needed.');
    }
  });

  console.log('Hot reload enabled for src/dynamic/');
}
```

---

## Validation Rules

### Schema Validation

```typescript
// Механик должен проверять схемы перед commit

interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

function validateSchema(schema: any): SchemaValidationResult {
  const errors: string[] = [];

  // Required base fields
  const requiredFields = ['id', 'createdAt', 'updatedAt', 'isDeleted', 'createdBy'];

  for (const field of requiredFields) {
    if (!schema[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check id is UUID
  if (schema.id && !schema.id.toString().includes('uuid')) {
    errors.push('id must be UUID type');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### Tool Validation

```typescript
// Механик должен проверять tools перед commit

interface ToolValidationResult {
  valid: boolean;
  errors: string[];
}

function validateTool(tool: DynamicTool<any, any>): ToolValidationResult {
  const errors: string[] = [];

  if (!tool.name) {
    errors.push('Tool must have a name');
  }

  if (!tool.schema) {
    errors.push('Tool must have a Zod schema');
  }

  if (!tool.execute || typeof tool.execute !== 'function') {
    errors.push('Tool must have an execute method');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## Example: Complete Character Feature

### characters.ts (Schema)

```typescript
// src/dynamic/schema/characters.ts

import {
  pgTable, uuid, varchar, text, integer,
  boolean, timestamp, bigint, jsonb
} from 'drizzle-orm/pg-core';

export const characters = pgTable('characters', {
  // Base fields
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').default(false),
  createdBy: bigint('created_by', { mode: 'number' }),

  // Character fields
  name: varchar('name', { length: 200 }).notNull(),
  role: varchar('role', { length: 100 }),
  age: integer('age'),
  backstory: text('backstory'),
  traits: jsonb('traits').$type<string[]>().default([]),
  projectId: uuid('project_id'),
});

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
```

### add_character.ts (Tool)

```typescript
// src/dynamic/tools/add_character.ts

import { z } from 'zod';
import { DynamicTool, ToolExecutionContext } from '@/core/tools/base';
import { db } from '@/core/database';
import { characters } from '@/dynamic/schema/characters';

const inputSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(100).optional(),
  age: z.number().int().positive().max(1000).optional(),
  backstory: z.string().max(10000).optional(),
  traits: z.array(z.string()).max(20).optional(),
  projectId: z.string().uuid().optional(),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  character?: {
    id: string;
    name: string;
  };
  error?: string;
}

export class AddCharacterTool extends DynamicTool<Input, Output> {
  name = 'add_character';
  description = 'Adds a new character to the database';
  schema = inputSchema;

  async execute(input: Input, context: ToolExecutionContext): Promise<Output> {
    try {
      const [result] = await db.insert(characters).values({
        ...input,
        createdBy: context.userId,
      }).returning({ id: characters.id, name: characters.name });

      return {
        success: true,
        character: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new AddCharacterTool();
```

---

## Вопросы по Dynamic Layer

### Критические

1. **Hot reload в production**:
   - Нужен ли hot reload динамических модулей?
   - Или только после редеплоя?

2. **Dependency management**:
   - Если tool нужен новый npm package?
   - Механик может просить админа добавить?

3. **Inter-tool dependencies**:
   - Может ли один tool использовать другой?
   - Как это реализовать?

### Важные

4. **Naming conventions**:
   - snake_case для tool names?
   - PascalCase для class names?

5. **Versioning**:
   - Версионировать tools/schemas?
   - Или только через git history?

6. **Testing requirements**:
   - Минимальный test coverage для dynamic code?
   - Какие tests обязательны?

7. **Documentation**:
   - JSDoc обязателен?
   - README для каждой фичи?

---

## Definition of Done

- [ ] Все templates созданы и работают
- [ ] Schema loader загружает динамические схемы
- [ ] Tool registry загружает динамические tools
- [ ] Agent registry загружает динамических агентов
- [ ] Validation rules проверяют новый код
- [ ] Example feature (characters) полностью работает
- [ ] Tests для example feature проходят
- [ ] Hot reload работает в development
