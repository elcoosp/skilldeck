---
id: implement-tauri-event-definitions-and-bridging
title: Implement Tauri event definitions and bridging
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:small'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#13-chunk-10-tauri-shell--commands--events
state: closed
createdAt: '2026-03-12T13:59:50.857Z'
priority: must
effort: 0.5d
dependencies:
  - Implement agent loop with streaming and debouncing
  - Implement MCP supervisor with exponential backoff
  - Implement workflow executor with pattern runners
---
## Context

Events are the primary mechanism for real-time communication from Rust to React. We need to define event types and implement event emission.

**Related Plan Section:**
- [Chunk 10: Tauri Shell — Commands & Events](../plans/v1.md#13-chunk-10-tauri-shell--commands--events)

**Related Requirements:**
- [REQ-FUNC-012](../spec/srs.md#req-func-012) - Stream tokens with < 100ms latency
- [REQ-FUNC-076](../spec/srs.md#req-func-076) - Display approval card

## Problem Statement

We need to define all event types for agent events, MCP events, and workflow events, and implement event emission to the frontend.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/src/events.rs` — Event definitions
- `src-tauri/skilldeck-core/src/events.rs` — Core event types

**AgentEvent enum:**
- `Started { conversation_id }`
- `Token { delta }`
- `ToolCall { tool_call }`
- `ToolResult { tool_call_id, result }`
- `Done { input_tokens, output_tokens }`
- `Error { message }`

**McpEvent enum:**
- `ServerConnected { name }`
- `ServerDisconnected { name }`
- `ToolDiscovered { server, tool }`

**WorkflowEvent enum:**
- `Started { id }`
- `StepStarted { workflow_id, step_id }`
- `StepCompleted { workflow_id, step_id, result }`
- `Completed { id }`

**Event bridging:**
- Use `app.emit()` to send events to frontend
- Serialize events as JSON
- Frontend subscribes via `listen()`

## Acceptance Criteria

- [x] All event types are defined (AgentEvent in core/events.rs, WorkflowEvent in workflow/types.rs)
- [x] Events serialize to JSON correctly
- [x] Events are emitted from agent loop
- [x] Events are emitted from MCP supervisor
- [x] Events are emitted from workflow executor
- [x] Frontend can subscribe to events (via `events.ts` listeners)

## Dependencies

- **Blocked by:** Agent loop, MCP supervisor, Workflow executor
- **Blocks:** Frontend event handling

## Effort Estimate

- **Complexity:** Low
- **Effort:** 0.5d

**Completion Note:** Event types are fully defined and bridged. Agent loop events are emitted in `messages.rs`. MCP events are emitted from the supervisor and from the MCP commands. Workflow events are emitted from the `run_workflow_definition` command. Frontend listeners are implemented in `events.ts`.
