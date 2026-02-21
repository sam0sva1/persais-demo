# 08 — Mechanic Task System

**Status: IMPLEMENTED (Session 2)**

---

## Problem

The Mechanic agent loses workflow context when:
1. The LLM call after Aider completes times out (Aider runs as a subprocess and is awaited correctly, but the summary call can fail)
2. The conversation is reset
3. The user restarts the service

Without persistent state, Mechanic has no way to resume — it loses track of what steps were done and what's next.

## Solution: Task Files

Mechanic writes a structured markdown file at the start of each feature and updates it as work progresses. Task files are the source of truth for multi-step workflows.

### Directory Structure

```
persais/src/tasks/
├── active/          ← tasks in progress
│   ├── .gitkeep
│   └── 2026-02-20-romantic-agent.md
└── done/            ← completed tasks (archived in git)
    └── .gitkeep
```

**Naming convention:** `YYYY-MM-DD-feature-name.md`

**DO NOT delete files from `active/`** — only move them via `manage_task(close, ...)`.
Both directories are committed to git so task history is preserved.

### Task File Structure

See [task.md.tpl](../../persais-core/templates/task.md.tpl) for the full template.

Key sections:
- **[MECHANIC] Preparation** — Mechanic's pre-work (git, scaffold, fill in Aider details)
- **[AIDER] Implementation** — What Aider needs to implement (read-only for Aider)
  - **[COMPONENTS]** — Files to create/modify (for new agents/tools)
  - **[SKILLS]** — Tools to add to existing agent
  - **[MIGRATION]** — SQL migration (if new schema)
  - **[TESTS]** — Test files
- **[MECHANIC] Acceptance** — Post-Aider verification and commit

### manage_task Tool

Available to Mechanic agent. Actions:

| Action | Description |
|--------|-------------|
| `list_active` | List all active task names |
| `read(name)` | Read a task file's content |
| `create(name, content)` | Create a new task file |
| `update(name, content)` | Overwrite task file (mark steps done) |
| `close(name)` | Move from `active/` to `done/` |

### How Aider Uses Task Files

When Mechanic calls `run_coder_task`, it adds the task file to `readOnlyFiles`:
```
readOnlyFiles: ['src/tasks/active/2026-02-20-feature.md', ...]
```

Aider reads the `[AIDER] Implementation Details` section and follows it exactly.
The task file is **read-only for Aider** — Mechanic updates it, not Aider.

## Mechanic Activation Flow

```
User activates Mechanic
  ↓
manage_task(list_active)
  ↓ active tasks exist?
YES → read task file → resume from last incomplete step
NO  → ask user for new work
```

## Complete Feature Workflow

```
Step 0: manage_task(list_active)         ← ALWAYS first
Step 1: Clarify requirements with user
Step 2: manage_task(create, name, tpl)   ← create task file
Step 2: manage_git(create_branch)        ← version branch
Step 3: scaffold_feature(...)            ← create skeleton files
Step 3: manage_task(update, ...)         ← fill in Aider details
Step 4: run_coder_task(..., readOnlyFiles=[task-file]) ← Aider implements
Step 5: system_check(typecheck)          ← verify (up to 3 retries)
Step 5: manage_task(update, ...)         ← mark Aider steps done
Step 6: Notify user, wait for confirmation
Step 6: manage_git(commit)
Step 6: manage_task(close, ...)          ← move to done/
```

## Relationship to LLM Failures

The task file survives LLM failures because:
- It's written to disk (not in LLM memory)
- It's committed to git via version branches
- On next activation, Mechanic reads it via `manage_task(list_active)` + `read`

This is the key resilience mechanism for multi-step workflows.

## Future: Per-Agent Settings

See [07-agent-settings.md](07-agent-settings.md) for a related planned feature — per-agent user settings that are also persistent but stored in the database (not as markdown files).
