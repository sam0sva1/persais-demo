# 09 — Async Architecture (Future)

**Status: DOCUMENTED (not implemented)**

---

## Current Architecture

```
User Message → Aggregator → OrchestratorService.processMessage()
                               ↓
                          AgenticLoop.run()  ← synchronous, blocks until done
                               ↓
                          ONE response → TelegramService.sendMessage()
```

The agentic loop runs synchronously inside `processMessage()`. The user receives exactly one response when the loop finishes. During multi-step work (Mechanic running Aider, typecheck, etc.), the user sees nothing for 10+ minutes.

### Session 3 Fix: `send_message` Tool

As an interim solution, a global `send_message` tool was added (available to ALL agents). Agents can call it during the agentic loop to send progress updates. This works within the current synchronous architecture — the tool sends directly to Telegram mid-loop.

---

## Target Architecture (v2)

Three decoupled components:

```
Input Queue          Agent Loop           Output Queue
(exists)            (decoupled)           (new)
┌──────────┐      ┌──────────────┐      ┌──────────────┐
│ Telegram │─────→│  AgenticLoop │─────→│  MessageSink │─────→ Telegram
│ messages │      │  (per chat)  │      │  (batching?) │
│          │      │              │      │              │
│ Internal │─────→│ Tools call   │      └──────────────┘
│ events   │      │ send_message │──────────↑
└──────────┘      └──────────────┘
```

### Key Changes

1. **Decoupled Agent Loop**: `AgenticLoop.run()` doesn't block `processMessage()`. Instead, it runs in the background and pushes results to an output queue.

2. **Output Queue (MessageSink)**: Collects outgoing messages from agents and tools. Can batch, throttle, or prioritize messages. All agents write to it (via `send_message` or final response).

3. **Input Queue Feeds Running Loop**: New user messages can be injected into an already-running agentic loop. The loop sees them as new context on the next iteration, rather than waiting for the loop to finish and starting a new one.

4. **Multi-Agent Concurrency**: Multiple agents can run in parallel (e.g., Mechanic coding while Master handles a quick question). The orchestrator receives completion events through the same input channel as user messages — a multi-channel funnel.

### Benefits

- User sees progress immediately (output queue delivers as messages arrive)
- Incoming messages don't wait for loop completion
- Multiple agents can work simultaneously
- Orchestrator becomes an event-driven coordinator

### Implementation Notes

- No Redis — use in-memory queues with Postgres for persistence/recovery
- Per-chat event loop (each chat has its own agent loop)
- Agent loop emits events: `tool_started`, `tool_completed`, `message_ready`, `loop_finished`
- Orchestrator subscribes to events and routes accordingly

---

## Migration Path

1. **Session 3 (done)**: `send_message` tool — agents can send messages mid-loop
2. **Future**: Extract output queue from `send_message` (already the same pattern)
3. **Future**: Make `AgenticLoop.run()` return a stream/observable instead of a single result
4. **Future**: Add input injection to running loops
5. **Future**: Multi-agent scheduling
