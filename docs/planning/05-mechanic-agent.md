# Секция 5: Агент "Механик" (The Architect)

## Scope
Специализированный агент LangGraph, который планирует и делегирует задачи Aider'у для саморазвития системы.

---

## Архитектура Механика

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mechanic Agent (LangGraph Node)              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Planner LLM                           │  │
│  │  - Анализирует запрос пользователя                        │  │
│  │  - Разбивает на подзадачи                                 │  │
│  │  - Выбирает шаблоны                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          ▼                   ▼                   ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ scaffold_    │   │ run_coder_   │   │ system_      │        │
│  │ feature      │   │ task         │   │ check        │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   GitOps Integration                       │  │
│  │  - createBranch → commit → push                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Skills (Tools)

### 1. scaffold_feature

Создаёт файлы-скелеты по шаблонам.

```typescript
interface ScaffoldInput {
  featureName: string;        // 'characters'
  entityName: string;         // 'Character'
  fields?: FieldDefinition[]; // [{ name: 'age', type: 'integer' }]
  generateTool?: boolean;     // true
  generateTest?: boolean;     // true
}

interface ScaffoldOutput {
  filesCreated: string[];
  // ['src/dynamic/schema/characters.ts',
  //  'src/dynamic/tools/add_character.ts',
  //  'tests/dynamic/add_character.test.ts']
}

async function scaffoldFeature(input: ScaffoldInput): Promise<ScaffoldOutput> {
  const files: string[] = [];

  // 1. Copy schema template
  const schemaPath = `src/dynamic/schema/${input.featureName}.ts`;
  await copyTemplate('schema.ts.tpl', schemaPath, {
    entityName: input.entityName,
    tableName: input.featureName,
  });
  files.push(schemaPath);

  // 2. Copy tool template
  if (input.generateTool) {
    const toolPath = `src/dynamic/tools/add_${input.featureName.slice(0, -1)}.ts`;
    await copyTemplate('tool.ts.tpl', toolPath, {
      entityName: input.entityName,
      toolName: `add_${input.featureName.slice(0, -1)}`,
    });
    files.push(toolPath);
  }

  // 3. Copy test template
  if (input.generateTest) {
    const testPath = `tests/dynamic/add_${input.featureName.slice(0, -1)}.test.ts`;
    await copyTemplate('test.ts.tpl', testPath, {
      toolName: `add_${input.featureName.slice(0, -1)}`,
    });
    files.push(testPath);
  }

  return { filesCreated: files };
}
```

### 2. run_coder_task

Запускает Aider для написания/модификации кода.

```typescript
interface CoderTaskInput {
  instruction: string;
  files: string[];          // Files to edit
  readOnlyFiles?: string[]; // Context files (not edited)
  maxRetries?: number;      // Default: 3
  timeout?: number;         // Default: 120000 ms
}

interface CoderTaskOutput {
  success: boolean;
  filesChanged: string[];
  diff: string;
  aiderOutput: string;
  errors?: string[];
}

async function runCoderTask(input: CoderTaskInput): Promise<CoderTaskOutput> {
  const aider = spawn('aider', [
    '--yes-always',
    '--model', process.env.AIDER_MODEL || 'openrouter/anthropic/claude-3-opus',
    '--no-git',
    '--no-auto-commits',
    '--message', input.instruction,
    ...input.files,
    ...(input.readOnlyFiles?.map(f => `--read ${f}`) || []),
  ], {
    cwd: '/workspace',
    timeout: input.timeout || 120000,
  });

  // Capture output
  let output = '';
  aider.stdout.on('data', (data) => output += data.toString());
  aider.stderr.on('data', (data) => output += data.toString());

  const exitCode = await new Promise<number>((resolve) => {
    aider.on('close', resolve);
  });

  return {
    success: exitCode === 0,
    filesChanged: parseChangedFiles(output),
    diff: await getDiff(),
    aiderOutput: output,
    errors: exitCode !== 0 ? [output] : undefined,
  };
}
```

### 3. system_check

Запускает проверки кода.

```typescript
interface SystemCheckInput {
  checks: ('typecheck' | 'test' | 'lint')[];
}

interface SystemCheckOutput {
  allPassed: boolean;
  results: {
    check: string;
    passed: boolean;
    output: string;
  }[];
}

async function systemCheck(input: SystemCheckInput): Promise<SystemCheckOutput> {
  const results = [];

  for (const check of input.checks) {
    const cmd = {
      typecheck: 'npm run typecheck',
      test: 'npm test',
      lint: 'npm run lint',
    }[check];

    const { exitCode, output } = await runCommand(cmd);

    results.push({
      check,
      passed: exitCode === 0,
      output,
    });
  }

  return {
    allPassed: results.every(r => r.passed),
    results,
  };
}
```

### 4. manage_git

Git операции.

```typescript
interface GitOperation {
  action: 'create_branch' | 'commit' | 'push' | 'delete_branch';
  branchName?: string;
  commitMessage?: string;
  files?: string[];
}

async function manageGit(op: GitOperation): Promise<{ success: boolean; message: string }> {
  switch (op.action) {
    case 'create_branch':
      await git.checkoutLocalBranch(op.branchName!);
      break;
    case 'commit':
      await git.add(op.files || '.');
      await git.commit(op.commitMessage!);
      break;
    case 'push':
      await git.push('origin', op.branchName, ['--set-upstream']);
      break;
    case 'delete_branch':
      await git.deleteLocalBranch(op.branchName!, true);
      break;
  }
  return { success: true, message: `${op.action} completed` };
}
```

### 5. apply_migration

Применяет миграции БД.

```typescript
interface MigrationInput {
  action: 'generate' | 'apply' | 'rollback';
}

async function applyMigration(input: MigrationInput): Promise<{ success: boolean; output: string }> {
  const cmd = {
    generate: 'npx drizzle-kit generate',
    apply: 'npx drizzle-kit migrate',
    rollback: 'npx drizzle-kit drop',
  }[input.action];

  const { exitCode, output } = await runCommand(cmd);

  return {
    success: exitCode === 0,
    output,
  };
}
```

---

## Workflow: Создание новой фичи

```
┌─────────────────────────────────────────────────────────────────┐
│  User: "Хочу сохранять идеи персонажей: имя, роль, возраст"     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Planning (Mechanic LLM)                                 │
│  - Parse request → entity: Character, fields: name, role, age   │
│  - Decide: need schema + tool + test                            │
│  - Generate branch name: feat/add-characters-v1                 │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Create Branch                                           │
│  manage_git({ action: 'create_branch', branchName: '...' })     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Scaffold                                                │
│  scaffold_feature({                                              │
│    featureName: 'characters',                                    │
│    entityName: 'Character',                                      │
│    generateTool: true,                                           │
│    generateTest: true                                            │
│  })                                                              │
│  → Creates skeleton files from templates                         │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Code Generation (Loop)                                  │
│                                                                  │
│  4a. run_coder_task({                                           │
│    instruction: "Fill characters.ts with fields: name (string), │
│                  role (string), age (integer). Use Drizzle.",   │
│    files: ['src/dynamic/schema/characters.ts'],                 │
│    readOnlyFiles: ['templates/schema.ts.tpl']                   │
│  })                                                              │
│                                                                  │
│  4b. run_coder_task({                                           │
│    instruction: "Implement add_character tool using db.insert", │
│    files: ['src/dynamic/tools/add_character.ts'],               │
│    readOnlyFiles: ['src/dynamic/schema/characters.ts']          │
│  })                                                              │
│                                                                  │
│  4c. apply_migration({ action: 'generate' })                    │
│                                                                  │
│  4d. run_coder_task({                                           │
│    instruction: "Write tests for add_character tool",           │
│    files: ['tests/dynamic/add_character.test.ts']               │
│  })                                                              │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Verification                                            │
│  system_check({ checks: ['typecheck', 'test'] })                │
│                                                                  │
│  If FAIL:                                                        │
│    → Extract errors                                              │
│    → run_coder_task with error context                          │
│    → Retry (max 3 times)                                        │
│                                                                  │
│  If STILL FAIL after 3 retries:                                 │
│    → Report to user: "Не справился, смотри логи"                │
│    → Abort branch                                                │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: Delivery                                                │
│                                                                  │
│  manage_git({                                                    │
│    action: 'commit',                                             │
│    commitMessage: 'feat: add characters entity and tool',       │
│    files: ['src/dynamic/', 'tests/dynamic/']                    │
│  })                                                              │
│                                                                  │
│  manage_git({ action: 'push', branchName: '...' })              │
│                                                                  │
│  → Send PR link to user via Telegram                            │
│  → Show [Deploy] [Abort] buttons                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mechanic Prompts

### System Prompt

```markdown
You are Mechanic, a specialized AI agent responsible for evolving the Persais system.

## Your Capabilities
You can create new features by:
1. Creating schema files (Drizzle ORM)
2. Creating tool files (LangGraph tools)
3. Running Aider to fill in implementation details
4. Running tests and type checks
5. Managing Git operations

## Your Constraints
- You can ONLY modify files in src/dynamic/ and tests/dynamic/
- You MUST use provided templates as base
- You MUST pass typecheck and tests before pushing
- You have a maximum of 3 retries for fixing errors
- You CANNOT install new npm packages

## Your Output
Always respond with:
1. What you understood from the request
2. Your plan (numbered steps)
3. Progress updates as you execute
4. Final result (success/failure + PR link or error details)

## Current State
Branch: {{currentBranch}}
Pending files: {{pendingFiles}}
Last error: {{lastError}}
```

### Planning Prompt

```markdown
Analyze this user request and create a plan:

User request: {{userRequest}}

Respond with a JSON plan:
{
  "understood": "brief summary of what user wants",
  "entities": [
    {
      "name": "Character",
      "tableName": "characters",
      "fields": [
        { "name": "name", "type": "varchar", "length": 200, "nullable": false },
        { "name": "role", "type": "varchar", "length": 100, "nullable": true },
        { "name": "age", "type": "integer", "nullable": true }
      ]
    }
  ],
  "tools": [
    {
      "name": "add_character",
      "description": "Adds a new character to the database",
      "inputSchema": "{ name: string, role?: string, age?: number }"
    }
  ],
  "branchName": "feat/add-characters-v1",
  "steps": [
    "Create branch",
    "Scaffold schema and tool files",
    "Implement schema with Aider",
    "Implement tool with Aider",
    "Generate migration",
    "Run tests",
    "Commit and push"
  ]
}
```

---

## Error Recovery

### Aider Loop Detection

```typescript
const MAX_RETRIES = 3;
const SIMILAR_ERROR_THRESHOLD = 0.9;

async function runWithRetry(task: CoderTaskInput): Promise<CoderTaskOutput> {
  const errors: string[] = [];

  for (let i = 0; i < MAX_RETRIES; i++) {
    const result = await runCoderTask(task);

    if (result.success) {
      return result;
    }

    // Check if we're in a loop (same error)
    const lastError = errors[errors.length - 1];
    if (lastError && similarity(lastError, result.errors![0]) > SIMILAR_ERROR_THRESHOLD) {
      throw new Error('Aider stuck in error loop');
    }

    errors.push(result.errors![0]);

    // Append error context to instruction for next try
    task.instruction = `
      Previous attempt failed with error:
      ${result.errors![0]}

      Original task: ${task.instruction}

      Please fix the error and try again.
    `;
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}
```

### Abort Mechanism

```typescript
async function abortFeature(branchName: string): Promise<void> {
  // 1. Checkout main
  await git.checkout('main');

  // 2. Delete feature branch locally
  await git.deleteLocalBranch(branchName, true);

  // 3. Delete from remote (if pushed)
  try {
    await git.push('origin', `:${branchName}`);
  } catch {
    // Branch might not exist on remote yet
  }

  // 4. Clean up migrations that weren't applied
  await cleanupPendingMigrations();

  // 5. Clear user context
  await userContext.setCurrentBranch(userId, null);
}
```

---

## Вопросы по Механику

### Критические

1. **Aider model selection**:
   - Claude 3 Opus через OpenRouter?
   - Или другая модель (GPT-4, Claude Sonnet)?
   - Budget considerations?

2. **Aider mode**:
   - `--yes-always` для полной автономии?
   - Или `--yes` только для code changes, но confirm для commits?

3. **Scope expansion**:
   - Что если пользователь попросит изменить core module?
   - Жёсткий reject или escalation?

4. **Parallel features**:
   - Может ли быть несколько feature branches одновременно?
   - Как управлять конфликтами?

### Важные

5. **Timeout for Aider**:
   - 2 минуты достаточно?
   - Что делать если timeout?

6. **Commit message style**:
   - Conventional commits?
   - Включать ли user request в commit?

7. **Migration safety**:
   - Как откатить неудачную миграцию?
   - Staging environment?

8. **Audit trail**:
   - Сохранять ли все Aider outputs?
   - Как связать с audit_log?

---

## State Machine

```
┌──────────────┐
│    IDLE      │
└──────┬───────┘
       │ user_request
       ▼
┌──────────────┐
│   PLANNING   │
└──────┬───────┘
       │ plan_ready
       ▼
┌──────────────┐
│  SCAFFOLDING │
└──────┬───────┘
       │ files_created
       ▼
┌──────────────┐     error (retry < 3)
│   CODING     │◄────────────────────┐
└──────┬───────┘                     │
       │                             │
       ├─────────────────────────────┘
       │ code_complete
       ▼
┌──────────────┐
│  VERIFYING   │
└──────┬───────┘
       │ tests_passed
       ▼
┌──────────────┐
│  DELIVERING  │
└──────┬───────┘
       │ pr_created
       ▼
┌──────────────┐
│ AWAITING_    │
│ APPROVAL     │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
DEPLOYED  ABORTED
   │       │
   └───┬───┘
       ▼
┌──────────────┐
│    IDLE      │
└──────────────┘
```

---

## Definition of Done

- [ ] Mechanic LangGraph node работает
- [ ] scaffold_feature создаёт файлы из шаблонов
- [ ] run_coder_task запускает Aider и получает результат
- [ ] system_check запускает typecheck и tests
- [ ] manage_git выполняет все git операции
- [ ] apply_migration генерирует и применяет миграции
- [ ] Error recovery с 3 retries работает
- [ ] Abort mechanism очищает всё корректно
- [ ] Audit log записывает все операции
- [ ] User получает PR ссылку и кнопки
