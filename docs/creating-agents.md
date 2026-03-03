# Creating Agents

## Agent Structure

Every agent is a directory under `src/agents/{name}/` containing:

```
src/agents/
  my_agent/
    manifest.json    # Configuration (Zod-validated)
    prompt.md        # System prompt in Markdown
    handler.ts       # Optional — presence makes the agent "heavy"
```

- **Light agents** (no `handler.ts`): prompt-driven, declarative. Good for most use cases.
- **Heavy agents** (has `handler.ts` or `handler.js`): custom code and config overrides. Use when light agent behavior is unreliable.

**Important:** The directory name MUST match `manifest.name`. For example, `src/agents/notes/manifest.json` must have `"name": "notes"`.

## manifest.json

### Fields

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | Yes | `string` | Unique agent ID. Regex: `/^[a-z][a-z0-9_]*$/`. Must match directory name. Min 2, max 50 chars. |
| `description` | Yes | `string` | What the agent does — used by intent classifier for routing. Min 10, max 500 chars. |
| `keywords` | No | `string[]` | Keywords for intent classification. Max 20 items, each max 30 chars. Default: `[]` |
| `tools` | No | `string[]` | Capability tools the agent can access. Max 10. Default: `[]` |
| `maxIterations` | No | `number` | Max tool call iterations per turn. Range: 1–30. Default: `10` |
| `endpoints` | No | `Endpoint[]` | Pre-configured HTTP endpoints for `http_request` tool. Max 20. Default: `[]` |
| `hooks` | No | `Hook[]` | Automatic post-action triggers. Max 20. Default: `[]` |
| `templateId` | No | `string` | Marketplace template reference. Max 100 chars. |

### Minimal Example

```json
{
  "name": "translator",
  "description": "Translates text between languages on request"
}
```

### Full Example

```json
{
  "name": "notes",
  "description": "Stores and retrieves user notes with semantic search and tagging",
  "keywords": ["note", "remember", "save", "find", "search"],
  "tools": ["agent_knowledge"],
  "maxIterations": 15,
  "endpoints": [],
  "hooks": []
}
```

## prompt.md

The system prompt defines the agent's behavior. It's injected as-is into the LLM context. Tool descriptions are injected automatically — you don't need to list them.

### Recommended Structure

```markdown
You are [Name], a specialized AI agent for [purpose].

## Your Role
- Primary responsibility
- Secondary responsibilities

## Guidelines
- Behavioral constraint 1
- Behavioral constraint 2
- When uncertain, ask the user

## Returning Control
When your task is complete or the request is outside your domain:
switch_to_agent({ agentName: 'master', reason: 'task completed' })
```

### Tips

- Be specific about what the agent should and shouldn't do.
- Describe the expected data format if the agent stores structured data.
- Include a "Returning Control" section — agents should return to master when done.
- Keep it concise. The prompt is sent with every message, so shorter = cheaper.

## handler.ts (Heavy Agents)

Add `handler.ts` when you need runtime config overrides that can't be expressed in `manifest.json` alone (e.g., dynamic `maxIterations` based on environment).

```typescript
import type { RegisteredAgent } from 'persais-core';

export const config: Partial<RegisteredAgent> = {
  maxIterations: 20,
};
```

### What handler.ts CAN override (runtime fields)

- `tools` — add/change capability tools
- `maxIterations` — increase iteration limit
- `keywords` — extend keywords
- `hooks` — add/change hooks
- `endpoints` — add/change endpoints

### What handler.ts CANNOT override (identity fields)

- `name` — always from manifest.json
- `description` — always from manifest.json
- `systemPrompt` — always from prompt.md
- `isCore` — always `false` for dynamic agents
- `isActive` — always `true` when loaded

Both `handler.ts` (development) and `handler.js` (production) are supported. Handler content is included in the change detection hash.

Heavy agents automatically get `agent_memory` granted if it's not already in their `tools[]`.

## Tools

### Global Tools (available to ALL agents — do NOT add to tools[])

| Tool | Purpose |
|---|---|
| `switch_to_agent` | Route conversation to another agent |
| `send_message` | Send a message to the user |
| `spawn_agent` | Spawn a parallel agent for a subtask |

These are always available. Adding them to `tools[]` is unnecessary and will be ignored.

### Capability Tools (add to tools[] to enable)

| Tool | Env Var Required | What It Does |
|---|---|---|
| `agent_memory` | — | CRUD key-value storage. Creates `agent_{name}_store` table. |
| `agent_knowledge` | — | Semantic search with embeddings + tags. Creates `agent_{name}_knowledge` table. |
| `http_request` | — | HTTP requests: endpoint mode (uses manifest endpoints) or `get` mode (public URLs). |
| `web_search` | `WEB_ACCESS_API_KEYS` | Search the web for real-time information. |
| `web_extract` | `WEB_ACCESS_API_KEYS` | Extract and summarize content from a URL. |
| `manage_schedule` | `CRONOS_API_KEY` | Create/manage scheduled jobs (cron, one-time). |

### Missing Env Vars

If a tool's required env var is not set, the tool is not registered at startup. Agents that request it still load — the tool is simply skipped with a warning in logs. This allows graceful degradation.

## Endpoints

Endpoints pre-configure HTTP targets so the agent doesn't see credentials directly. Used with the `http_request` tool in `endpoint` mode.

```json
{
  "endpoints": [
    {
      "name": "create_bond",
      "url": "https://api.example.com/bonds",
      "method": "POST",
      "headers": { "Authorization": "Bearer ${BOND_API_TOKEN}" },
      "description": "Create a bond record"
    }
  ]
}
```

### Endpoint Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique ID within agent. Regex: `/^[a-z][a-z0-9_]*$/`. Max 50 chars. |
| `url` | Yes | Target URL (must be valid URL). |
| `method` | Yes | HTTP method: `POST`, `PUT`, `DELETE`, or `PATCH`. |
| `headers` | No | Static headers (e.g., auth tokens). |
| `description` | No | What this endpoint does. Max 200 chars. |

**Note:** `GET` is not available as an endpoint method. For reading data via GET, the agent uses `http_request` tool directly in `get` mode — no endpoint needed.

## Hooks

Hooks fire automatically after a tool call completes. They enable reactive patterns like "notify user after saving data" or "sync to external service after update".

```json
{
  "hooks": [
    {
      "trigger": "after:agent_memory.save",
      "action": {
        "tool": "send_message",
        "input": { "message": "Data saved successfully" }
      },
      "inject": {
        "source": "result",
        "field": "body"
      }
    }
  ]
}
```

### Hook Fields

| Field | Description |
|---|---|
| `trigger` | When to fire. Format: `after:<tool>` or `after:<tool>.<operation>`. Regex: `/^after:[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$/` |
| `action.tool` | Tool to invoke when hook fires. |
| `action.input` | Input object for the tool. |
| `inject.source` | What to inject: `result` (tool output), `input` (tool input), or `full` (both). |
| `inject.field` | Field name where injected data is placed in `action.input`. |

### Trigger Examples

- `after:agent_memory` — fires after any `agent_memory` operation
- `after:agent_memory.save` — fires only after `agent_memory.save`
- `after:http_request` — fires after any `http_request` call

## Applying Changes

After creating or modifying agent files:

1. **Restart the app** — `AgentLoaderService` scans directories on startup.
2. **Or call `refresh_agents` tool** — syncs file changes without restart.

Changes are detected via SHA-256 hash of manifest + prompt + handler content. Only modified agents are re-registered.

## Examples

### Light Agent — Minimal (L1)

No storage, no tools. Pure prompt-driven.

```
src/agents/translator/
├── manifest.json
└── prompt.md
```

**manifest.json:**
```json
{
  "name": "translator",
  "description": "Translates text between languages on request",
  "keywords": ["translate", "перевод", "language"]
}
```

**prompt.md:**
```markdown
You are Translator, an AI agent that translates text between languages.

## Your Role
- Translate text to the requested language
- Auto-detect source language when not specified
- Preserve formatting and tone

## Guidelines
- If language is ambiguous, ask the user
- For technical terms, provide both translation and original in parentheses

## Returning Control
When translation is done:
switch_to_agent({ agentName: 'master', reason: 'translation complete' })
```

### Light Agent — With Storage (L2)

Uses `agent_knowledge` for semantic search across stored content.

```
src/agents/notes/
├── manifest.json
└── prompt.md
```

**manifest.json:**
```json
{
  "name": "notes",
  "description": "Stores and retrieves user notes with semantic search and tagging",
  "keywords": ["note", "remember", "save", "find"],
  "tools": ["agent_knowledge"]
}
```

**prompt.md:**
```markdown
You are Notes, an AI agent for storing and retrieving user notes.

## Your Role
- Store notes with meaningful tags
- Search notes by meaning (semantic search)
- List and filter notes by tags

## Returning Control
When done:
switch_to_agent({ agentName: 'master', reason: 'notes task done' })
```

### Heavy Agent — With Config Override

Uses `handler.ts` for custom `maxIterations` and multiple tools.

```
src/agents/writing_helper/
├── manifest.json
├── prompt.md
└── handler.ts
```

**manifest.json:**
```json
{
  "name": "writing_helper",
  "description": "Creative writing assistant that helps develop characters, plots, and worlds",
  "keywords": ["write", "story", "character", "plot"],
  "tools": ["agent_memory", "agent_knowledge", "web_search"]
}
```

**handler.ts:**
```typescript
import type { RegisteredAgent } from 'persais-core';

export const config: Partial<RegisteredAgent> = {
  maxIterations: 20,
};
```
