# 07 — Per-Agent Settings (Future Feature)

**Status: PLANNED — not implemented yet**

---

## Problem

Global user memory (facts from `FactExtractionService`) is shared across all agents. But users often want agent-specific behavior: "always respond formally to the Mechanic", "give me bullet points when using the Master agent", etc. These preferences shouldn't leak between agents.

## Proposed Solution

Each agent gets a user-configurable settings block injected into its system prompt. The user can update these settings by talking to the agent: "remember to always respond in English to me".

### Database Schema

```sql
CREATE TABLE core.agent_settings (
  id         uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    bigint    NOT NULL,
  agent_name varchar(100) NOT NULL,
  content    text,        -- free-form text injected into system prompt
  updated_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(user_id, agent_name)
);
```

- `content` is a freeform text block written by the user (via the agent's `manage_agent_settings` tool)
- Injected verbatim into the agent's system prompt as a `[User Settings for this Agent]` section
- Allows agent-specific behavior customization without touching global facts

### New Tool: `manage_agent_settings`

Available to agents that opt in (not all agents need this):

```typescript
action: 'read' | 'update'
content?: string  // for 'update' action
```

- `read`: returns current settings for the calling agent + user
- `update`: overwrites with new content

### Prompt Injection

`AgentSettingsContextProvider` reads settings for `(agentName, userId)` pair and injects:

```
## Your Settings for This User
[content from agent_settings table]
```

Agent uses these as persistent behavioral instructions that override defaults.

### Mechanic Workflow

When user says "always respond in bullet points", Mechanic calls:
```
manage_agent_settings(action: 'update', content: 'Always use bullet points in responses.')
```

This persists immediately. Next activation, the setting is injected into the system prompt.

## Implementation Steps (when ready)

1. `persais-core/src/core/database/schema/agent-settings.ts` — Drizzle table definition
2. `persais-core/src/core/database/repositories/agent-settings.repository.ts` — CRUD
3. Create migration in `persais-core/src/core/database/migrations/`
4. `persais-core/src/core/tools/manage-agent-settings.tool.ts` — new core tool
5. `persais-core/src/core/orchestrator/prompt/agent-settings-context.provider.ts`
6. Register in `OrchestratorModule`, export from `ToolsModule`
7. Add `manage_agent_settings` to agents that should support it

## Notes

- Global facts (from FactExtractionService) describe who the user IS
- Agent settings describe how the user wants THIS SPECIFIC AGENT to behave
- Two separate concerns, intentionally kept separate
