---
id: implement-subagent-session-management
title: Implement subagent session management
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#11-chunk-8-workflow-engine
state: open
createdAt: '2026-03-12T13:56:20.465Z'
priority: should
effort: 1d
dependencies:
  - Implement agent loop with streaming and debouncing
---
## Context

Subagents are spawned by workflows to handle specialized tasks. Each subagent has its own message history and can be merged or discarded after completion.

**Related Plan Section:**
- [Chunk 8: Workflow Engine](../plans/v1.md#11-chunk-8-workflow-engine)

**Related Requirements:**
- [REQ-FUNC-095](../spec/srs.md#req-func-095) - Spawn subagent for step
- [REQ-FUNC-096](../spec/srs.md#req-func-096) - Display subagent result card
- [REQ-FUNC-097](../spec/srs.md#req-func-097) - Merge subagent result
- [REQ-FUNC-098](../spec/srs.md#req-func-098) - Discard subagent result
- [REQ-FUNC-099](../spec/srs.md#req-func-099) - Display subagent error

## Problem Statement

We need to implement subagent session management that creates isolated agent sessions for workflow steps, tracks their state, and handles merge/discard operations.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/agent/subagent.rs` — SubagentSession implementation

**SubagentSession:**
- `id` — Session UUID
- `parent_conversation_id` — Parent conversation
- `parent_message_id` — Parent message
- `workflow_step_id` — Associated workflow step
- `task_description` — Task description
- `status` — Session status
- `result_summary` — Result summary
- `created_at` — Creation timestamp
- `completed_at` — Completion timestamp

**SubagentStatus:**
- `Running` — Currently executing
- `Done` — Completed successfully
- `Merged` — Merged into parent
- `Discarded` — Discarded
- `Error` — Failed

**SubagentManager:**
- `spawn(parent_conversation, parent_message, task)` — Create new subagent
- `get(session_id)` — Get session by ID
- `complete(session_id, result)` — Mark as complete
- `merge(session_id)` — Merge into parent
- `discard(session_id)` — Discard result

## Acceptance Criteria

- [ ] Spawns subagent with isolated message history
- [ ] Tracks subagent status
- [ ] Displays subagent result card
- [ ] Supports merge operation
- [ ] Supports discard operation
- [ ] Handles subagent errors
- [ ] Preserves session for audit
- [ ] Unit tests verify lifecycle

## Testing Requirements

**Unit tests:**
- `subagent_spawn` — Subagent is spawned
- `subagent_complete` — Subagent completes
- `subagent_merge` — Result is merged
- `subagent_discard` — Result is discarded

**BDD scenarios:**
- [SC-FUNC-024](../spec/test-verification.md#sc-func-024) - Subagent lifecycle

## Dependencies

- **Blocked by:** Agent loop
- **Blocks:** Workflow executor

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
