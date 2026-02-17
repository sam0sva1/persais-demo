# Секция 7: Безопасность

## Scope
Ограничения для Aider, GitOps rollback, audit trail, access control.

---

## Уровни защиты

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Layers                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Layer 1: Telegram Auth                                      ││
│  │  - Whitelist user IDs                                       ││
│  │  - Admin vs Regular user                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Layer 2: Aider Scope Restrictions                          ││
│  │  - Only src/dynamic/ and tests/dynamic/                     ││
│  │  - No npm install without approval                          ││
│  │  - Template enforcement                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Layer 3: Code Validation                                   ││
│  │  - TypeScript strict mode                                   ││
│  │  - Required tests                                           ││
│  │  - Schema validation                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Layer 4: GitOps Safety                                     ││
│  │  - Branch isolation                                         ││
│  │  - Review before merge                                      ││
│  │  - Instant rollback                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Layer 5: Audit Trail                                       ││
│  │  - All changes logged                                       ││
│  │  - User attribution                                         ││
│  │  - Full history                                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Telegram Authentication

### Whitelist Configuration

```typescript
// config/security.ts

export interface SecurityConfig {
  // Allowed users (can use bot)
  allowedUserIds: number[];

  // Admins (can deploy, rollback)
  adminUserIds: number[];

  // Emergency contacts (notified on critical errors)
  emergencyContacts: number[];
}

export const securityConfig: SecurityConfig = {
  allowedUserIds: process.env.TELEGRAM_ALLOWED_USER_IDS
    ?.split(',').map(Number) || [],

  adminUserIds: process.env.TELEGRAM_ADMIN_IDS
    ?.split(',').map(Number) || [],

  emergencyContacts: process.env.TELEGRAM_EMERGENCY_CONTACTS
    ?.split(',').map(Number) || [],
};
```

### Permission Levels

| Action | Regular User | Admin |
|--------|-------------|-------|
| Chat with bot | ✅ | ✅ |
| Request features | ✅ | ✅ |
| View PRs | ✅ | ✅ |
| /status | ✅ | ✅ |
| /reset | ✅ | ✅ |
| /abort | ✅ | ✅ |
| /deploy | ❌ | ✅ |
| /rollback | ❌ | ✅ |
| Direct DB access | ❌ | ❌ |

---

## Layer 2: Aider Scope Restrictions

### .aider.conf.yml

```yaml
# Aider configuration - SAFETY RULES
# This file is in repository root

# Model configuration
model: openrouter/anthropic/claude-3-opus
edit-format: diff

# Auto-accept changes (Mechanic controls the workflow)
auto-commits: false
auto-lint: false

# CRITICAL: Scope restrictions
# These are enforced by file permissions, not just config
```

### File System Restrictions

```typescript
// core/coder/file-guard.ts

const ALLOWED_PATHS = [
  'src/dynamic/',
  'tests/dynamic/',
];

const FORBIDDEN_PATHS = [
  'src/core/',
  'src/app.module.ts',
  'src/main.ts',
  '.env',
  '.aider.conf.yml',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'drizzle.config.ts',
  '_templates/',
];

export function isPathAllowed(filePath: string): boolean {
  // Check if in allowed paths
  const inAllowed = ALLOWED_PATHS.some(p => filePath.startsWith(p));

  // Check if not in forbidden paths
  const inForbidden = FORBIDDEN_PATHS.some(p =>
    filePath.startsWith(p) || filePath === p
  );

  return inAllowed && !inForbidden;
}

export function validateAiderFiles(files: string[]): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const file of files) {
    if (!isPathAllowed(file)) {
      violations.push(file);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
```

### Pre-Aider Hook

```typescript
// core/coder/pre-aider-hook.ts

export async function preAiderCheck(files: string[], instruction: string): Promise<void> {
  // 1. Validate file paths
  const fileCheck = validateAiderFiles(files);
  if (!fileCheck.valid) {
    throw new SecurityError(
      `Attempt to modify protected files: ${fileCheck.violations.join(', ')}`
    );
  }

  // 2. Check for dangerous patterns in instruction
  const dangerousPatterns = [
    /npm install/i,
    /require\s*\(['"]/,  // dynamic requires
    /eval\s*\(/,
    /Function\s*\(/,
    /child_process/,
    /exec\s*\(/,
    /spawn\s*\(/,
    /\.env/,
    /process\.env/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(instruction)) {
      throw new SecurityError(
        `Dangerous pattern detected in instruction: ${pattern.toString()}`
      );
    }
  }

  // 3. Log the attempt
  await auditLog.record({
    action: 'aider_invocation',
    details: { files, instruction },
  });
}
```

### Allowed Dependencies

```typescript
// core/coder/allowed-deps.ts

// Only these imports are allowed in dynamic code
export const ALLOWED_IMPORTS = [
  // From core
  '@/core/database',
  '@/core/tools/base',
  '@/core/agents/base',
  '@/shared/',

  // From dynamic (self-reference)
  '@/dynamic/',

  // Pre-approved npm packages
  'zod',
  'drizzle-orm',
  'date-fns',
  'lodash',
  'uuid',
];

export function validateImports(code: string): { valid: boolean; violations: string[] } {
  const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
  const violations: string[] = [];

  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];

    const isAllowed = ALLOWED_IMPORTS.some(allowed =>
      importPath.startsWith(allowed) || importPath === allowed
    );

    if (!isAllowed) {
      violations.push(importPath);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
```

---

## Layer 3: Code Validation

### TypeScript Strict Mode

```json
// tsconfig.json (excerpt)
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Post-Aider Validation

```typescript
// core/coder/post-aider-validation.ts

export interface ValidationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    output: string;
  }[];
}

export async function validateChanges(changedFiles: string[]): Promise<ValidationResult> {
  const checks = [];

  // 1. TypeScript compilation
  const typecheck = await runCommand('npm run typecheck');
  checks.push({
    name: 'typecheck',
    passed: typecheck.exitCode === 0,
    output: typecheck.output,
  });

  // 2. Import validation
  for (const file of changedFiles) {
    if (file.endsWith('.ts')) {
      const content = await fs.readFile(file, 'utf-8');
      const importCheck = validateImports(content);

      if (!importCheck.valid) {
        checks.push({
          name: `imports:${file}`,
          passed: false,
          output: `Invalid imports: ${importCheck.violations.join(', ')}`,
        });
      }
    }
  }

  // 3. Schema validation (if schema files changed)
  const schemaFiles = changedFiles.filter(f => f.includes('/schema/'));
  for (const file of schemaFiles) {
    const schema = await import(file);
    const schemaCheck = validateSchema(schema);

    checks.push({
      name: `schema:${file}`,
      passed: schemaCheck.valid,
      output: schemaCheck.errors.join(', '),
    });
  }

  // 4. Tests
  const tests = await runCommand('npm test');
  checks.push({
    name: 'tests',
    passed: tests.exitCode === 0,
    output: tests.output,
  });

  return {
    passed: checks.every(c => c.passed),
    checks,
  };
}
```

---

## Layer 4: GitOps Safety

### Branch Isolation

```typescript
// core/gitops/branch-policy.ts

export const BRANCH_POLICY = {
  // Protected branches
  protected: ['main', 'master', 'production'],

  // Feature branch naming
  featureBranchPattern: /^feat\/[a-z0-9-]+-v\d+$/,

  // Max branches per user
  maxBranchesPerUser: 3,
};

export function validateBranchName(name: string): boolean {
  if (BRANCH_POLICY.protected.includes(name)) {
    return false;
  }

  return BRANCH_POLICY.featureBranchPattern.test(name);
}
```

### Emergency Rollback

```typescript
// core/gitops/rollback.ts

export async function emergencyRollback(
  commitHash: string,
  userId: number
): Promise<RollbackResult> {
  // 1. Verify user is admin
  if (!securityConfig.adminUserIds.includes(userId)) {
    throw new PermissionError('Only admins can perform rollback');
  }

  // 2. Log the rollback
  await auditLog.record({
    action: 'emergency_rollback',
    actor: `user:${userId}`,
    details: { targetCommit: commitHash },
  });

  // 3. Perform revert
  await git.checkout('main');
  await git.revert(commitHash, { '--no-commit': null });
  await git.commit(`Revert: Emergency rollback of ${commitHash.slice(0, 7)}`);

  // 4. Push (triggers Fly.io redeploy)
  await git.push('origin', 'main');

  // 5. Notify emergency contacts
  for (const contact of securityConfig.emergencyContacts) {
    await telegram.sendMessage(contact,
      `⚠️ Emergency rollback performed by user ${userId}\n` +
      `Target commit: ${commitHash}\n` +
      `Fly.io is redeploying...`
    );
  }

  return { success: true, revertCommit: await git.revparse(['HEAD']) };
}
```

### Merge Protection

```typescript
// core/gitops/merge.ts

export async function safeMerge(
  branchName: string,
  userId: number
): Promise<MergeResult> {
  // 1. Verify user is admin
  if (!securityConfig.adminUserIds.includes(userId)) {
    throw new PermissionError('Only admins can merge to main');
  }

  // 2. Verify branch exists and has passing checks
  const branchStatus = await getBranchStatus(branchName);

  if (!branchStatus.testsPass) {
    throw new ValidationError('Tests must pass before merge');
  }

  if (!branchStatus.typecheckPass) {
    throw new ValidationError('TypeCheck must pass before merge');
  }

  // 3. Create merge commit
  await git.checkout('main');
  await git.merge([branchName, '--no-ff', '-m',
    `Merge ${branchName}: Auto-merge by Persais`
  ]);

  // 4. Push
  await git.push('origin', 'main');

  // 5. Clean up feature branch
  await git.deleteLocalBranch(branchName);
  await git.push('origin', `:${branchName}`);

  // 6. Log
  await auditLog.record({
    action: 'merge',
    actor: `user:${userId}`,
    details: { branch: branchName },
  });

  return { success: true };
}
```

---

## Layer 5: Audit Trail

### Audit Log Schema

```typescript
// core/schema/audit-log.ts

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),

  // What happened
  action: varchar('action', { length: 50 }).notNull(),
  // 'aider_invocation', 'code_change', 'merge', 'rollback',
  // 'deploy', 'error', 'auth_failure'

  // Who did it
  actor: varchar('actor', { length: 100 }).notNull(),
  // 'mechanic', 'user:123456', 'system'

  // Details
  details: jsonb('details').$type<AuditDetails>(),

  // Git context
  gitCommit: varchar('git_commit', { length: 40 }),
  gitBranch: varchar('git_branch', { length: 100 }),

  // Outcome
  status: varchar('status', { length: 20 }).default('success'),
  // 'success', 'failure', 'pending'

  errorMessage: text('error_message'),

  // Timing
  createdAt: timestamp('created_at').defaultNow(),
  duration: integer('duration'), // milliseconds
});
```

### Audit Service

```typescript
// core/audit/audit.service.ts

@Injectable()
export class AuditService {
  constructor(
    @Inject('DRIZZLE') private db: DrizzleDB,
    private telegram: TelegramService,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      action: entry.action,
      actor: entry.actor,
      details: entry.details,
      gitCommit: entry.gitCommit,
      gitBranch: entry.gitBranch,
      status: entry.status || 'success',
      errorMessage: entry.error,
      duration: entry.duration,
    });

    // Alert on critical events
    if (this.isCritical(entry)) {
      await this.alertAdmins(entry);
    }
  }

  private isCritical(entry: AuditEntry): boolean {
    const criticalActions = [
      'emergency_rollback',
      'auth_failure',
      'security_violation',
    ];

    return (
      criticalActions.includes(entry.action) ||
      entry.status === 'failure'
    );
  }

  private async alertAdmins(entry: AuditEntry): Promise<void> {
    const message = `
🚨 Critical Audit Event

Action: ${entry.action}
Actor: ${entry.actor}
Status: ${entry.status}
${entry.error ? `Error: ${entry.error}` : ''}

Time: ${new Date().toISOString()}
    `.trim();

    for (const adminId of securityConfig.adminUserIds) {
      await this.telegram.sendMessage(adminId, message);
    }
  }

  async getHistory(options: {
    actor?: string;
    action?: string;
    since?: Date;
    limit?: number;
  }): Promise<AuditEntry[]> {
    let query = this.db.select().from(auditLog);

    if (options.actor) {
      query = query.where(eq(auditLog.actor, options.actor));
    }
    if (options.action) {
      query = query.where(eq(auditLog.action, options.action));
    }
    if (options.since) {
      query = query.where(gte(auditLog.createdAt, options.since));
    }

    return query
      .orderBy(desc(auditLog.createdAt))
      .limit(options.limit || 100);
  }
}
```

---

## Error Recovery

### Circuit Breaker

```typescript
// core/coder/circuit-breaker.ts

class CoderCircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  private readonly FAILURE_THRESHOLD = 3;
  private readonly RESET_TIMEOUT = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure!.getTime() > this.RESET_TIMEOUT) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError('Coder circuit is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.failures >= this.FAILURE_THRESHOLD) {
      this.state = 'open';
    }
  }
}
```

### Graceful Degradation

```typescript
// When Mechanic fails repeatedly

async function handleMechanicFailure(userId: number, error: Error): Promise<void> {
  // 1. Log the failure
  await auditLog.record({
    action: 'mechanic_failure',
    actor: 'mechanic',
    status: 'failure',
    error: error.message,
  });

  // 2. Notify user
  await telegram.sendMessage(userId, `
❌ Механик не справился с задачей.

Ошибка: ${error.message}

Рекомендации:
1. Попробуйте переформулировать запрос
2. Разбейте задачу на более мелкие части
3. Используйте /reset для сброса контекста
4. Свяжитесь с администратором

Вся история сохранена в audit log.
  `);

  // 3. Abort any pending changes
  const currentBranch = await userContext.getCurrentBranch(userId);
  if (currentBranch && currentBranch !== 'main') {
    await abortFeature(currentBranch);
  }

  // 4. Alert admin if pattern detected
  const recentFailures = await auditLog.getHistory({
    action: 'mechanic_failure',
    since: new Date(Date.now() - 3600000), // last hour
  });

  if (recentFailures.length >= 3) {
    for (const adminId of securityConfig.adminUserIds) {
      await telegram.sendMessage(adminId, `
⚠️ Multiple Mechanic failures detected

Failures in last hour: ${recentFailures.length}
Latest error: ${error.message}

Consider investigating the issue.
      `);
    }
  }
}
```

---

## Вопросы по безопасности

### Критические

1. **Aider sandboxing**:
   - Достаточно ли file-based restrictions?
   - Нужен ли Docker-in-Docker или chroot?

2. **Secrets in code**:
   - Как предотвратить утечку secrets в сгенерированном коде?
   - Нужен ли secret scanning?

3. **Multi-user isolation**:
   - Если несколько users - как изолировать их данные?
   - Shared code vs per-user code?

4. **Backup before merge**:
   - Автоматический backup перед merge?
   - Как быстро восстановить?

### Важные

5. **Rate limiting**:
   - Лимиты на Aider invocations?
   - Лимиты на git operations?

6. **Audit retention**:
   - Сколько хранить audit logs?
   - GDPR considerations?

7. **Vulnerability scanning**:
   - Сканировать сгенерированный код на уязвимости?
   - Какие инструменты?

8. **Incident response**:
   - Playbook для инцидентов?
   - Кто отвечает за расследование?

---

## Definition of Done

- [ ] Telegram auth guard работает (whitelist)
- [ ] Admin vs regular user permissions работают
- [ ] Aider scope restrictions enforced
- [ ] Pre-Aider validation catches violations
- [ ] Post-Aider validation runs all checks
- [ ] Import validation работает
- [ ] Emergency rollback работает
- [ ] Safe merge требует admin + passing checks
- [ ] Audit log записывает все события
- [ ] Admin alerts работают для critical events
- [ ] Circuit breaker для Aider
- [ ] Graceful degradation при failures
