# 2026-03-05 notes: include id in responses

## Summary
Update the 'notes' agent so that when it creates, updates, or returns notes, it includes the unique identifier (ID) of the note in responses. When multiple matching notes are found, the agent should operate on and return the ID of the most recent version.

## Scope
- Modify the notes agent prompt/manifest so that all confirmations and note outputs include note ID.
- When adding tags and multiple matches exist, choose the most recently saved version and return its ID.
- Update examples in prompt if present. No new code handlers are required (light agent update via manage_agents.update).
- No tests required per user.

## Steps
- Update agent manifest/prompt — done
- Refresh agents — done
- Verify by interacting with the notes agent
- Update task status

## Files/Agents modified
- Agent: notes (manifest + prompt) — updated

## Status
ready_for_verification

## Notes
- Prompt updated to instruct the agent to include IDs in all confirmations, search results, and updates.
- Agent refreshed; no errors reported by refresh_agents.
