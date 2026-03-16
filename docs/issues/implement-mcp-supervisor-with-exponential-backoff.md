---
id: implement-mcp-supervisor-with-exponential-backoff
title: Implement MCP supervisor with exponential backoff
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#9-chunk-6-mcp-client--supervision
state: in-progress
createdAt: '2026-03-12T13:53:55.313Z'
priority: must
effort: 1d
dependencies:
  - Implement MCP registry for server management
---
## Context

The MCP supervisor monitors connected MCP servers for health, restarts failed servers with exponential backoff, and manages the supervision lifecycle.

**Related Plan Section:**
- [Chunk 6: MCP Client & Supervision](../plans/v1.md#9-chunk-6-mcp-client--supervision)

**Related Requirements:**
- [REQ-FUNC-070](../spec/srs.md#req-func-070) - Monitor MCP server health
- [REQ-FUNC-071](../spec/srs.md#req-func-071) - Restart with backoff
- [REQ-FUNC-072](../spec/srs.md#req-func-072) - Mark failed after max retries
- [REQ-FUNC-073](../spec/srs.md#req-func-073) - Manual reconnect
- [REQ-REL-004](../spec/srs.md#req-rel-004) - MCP supervision
- [BR-005](../spec/bsr.md#br-005) - MCP servers are supervised

**Related Architecture:**
- [ADR-008](../spec/archi.md#adr-008-mcp-server-supervision-with-exponential-backoff) - MCP server supervision

## Problem Statement

We need to implement the MCP supervisor that monitors server health, restarts failed servers with exponential backoff, and provides manual reconnection.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/mcp/supervisor.rs` — Supervisor implementation

**Key features:**
- Health check loop (configurable interval)
- Exponential backoff restart (1s → 2s → 4s → 8s...)
- Maximum restart attempts (default: 5)
- Maximum delay cap (default: 60s)
- Manual restart command
- Reset restart counter on successful connection

**SupervisorConfig:**
- `check_interval` — Health check interval
- `initial_delay` — Initial restart delay
- `max_delay` — Maximum delay
- `multiplier` — Backoff multiplier
- `max_attempts` — Maximum restart attempts

**SupervisorCommand:**
- `Stop` — Stop supervision
- `Restart(server_id)` — Manual restart
- `Reset(server_id)` — Reset restart counter

## Acceptance Criteria

- [x] Monitors server health at configurable interval (structure exists)
- [ ] Restarts failed servers with exponential backoff (logic present but actual reconnect deferred)
- [x] Caps maximum delay
- [x] Limits maximum restart attempts
- [x] Allows manual restart
- [x] Resets counter on successful connection
- [x] Unit tests verify backoff timing
- [x] Unit tests verify max attempts

## Testing Requirements

**Unit tests:**
- [x] `restart_state_backoff` — Backoff timing is correct
- [x] `restart_state_max_delay` — Max delay is capped
- [x] `restart_state_reset` — Counter resets on success

**BDD scenarios:**
- [ ] [SC-FUNC-017](../spec/test-verification.md#sc-func-017) - MCP server supervision

## Dependencies

- **Blocked by:** MCP registry
- **Blocks:** Agent loop

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** Supervisor structure is implemented, but the actual reconnection logic is commented out ("Actual reconnect would be: registry.connect(...)"). Health check runs but doesn't trigger reconnects.
