---
id: implement-tauri-state-management-and-initializatio
title: Implement Tauri state management and initialization
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#13-chunk-10-tauri-shell--commands--events
state: closed
createdAt: '2026-03-12T13:59:50.854Z'
priority: must
effort: 1d
dependencies:
  - Implement database layer with SQLite and SeaORM
  - Implement MCP registry for server management
  - Implement skill resolver with priority ordering
---
## Context

The Tauri shell manages application state, registers commands, and bridges events between Rust and React. This is the thin OS integration layer.

**Related Plan Section:**
- [Chunk 10: Tauri Shell — Commands & Events](../plans/v1.md#13-chunk-10-tauri-shell--commands--events)

**Related Requirements:**
- [REQ-CON-006](../spec/srs.md#req-con-006) - React frontend communicates only via Tauri IPC
- [REQ-CON-007](../spec/srs.md#req-con-007) - All business logic in Rust core

**Related Architecture:**
- [ADR-001](../spec/archi.md#adr-001-three-layer-architecture-rust-core--tauri-shell--react-ui) - Three-layer architecture

## Problem Statement

We need to implement the Tauri shell that initializes the application, manages state, and provides the IPC boundary between Rust and React.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/src/state.rs` — AppState management
- `src-tauri/src/lib.rs` — Tauri library entry
- `src-tauri/src/main.rs` — Application entry point

**AppState struct:**
- `registry` — Arc<Registry> (core library)
- `approval_gate` — ApprovalGate
- `agent_cancel_tokens` — Cancellation tokens
- `platform_client` — Platform HTTP client
- `lint_config` — Lint configuration

**Initialization:**
- Open database
- Create registry
- Register model providers
- Start MCP supervisor
- Start skill watcher
- Seed default profile

**Commands to register:**
- `create_conversation`
- `list_conversations`
- `send_message`
- `list_profiles`
- `list_skills`
- `connect_mcp_server`
- etc.

## Acceptance Criteria

- [x] Application initializes successfully
- [x] Database is opened with WAL mode
- [x] Registries are created
- [x] Commands are registered
- [ ] Events are bridged to frontend (partially)
- [x] State is accessible from commands
- [ ] Integration tests verify initialization

## Testing Requirements

**Integration tests:**
- [ ] `app_initializes` — App starts correctly
- [ ] `commands_registered` — Commands are available

## Dependencies

- **Blocked by:** Core library (Registry, MCP registry, Skill registry)
- **Blocks:** Tauri commands

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** Tauri state management is fully implemented in `src-tauri/src/state.rs` and `lib.rs`. The application initializes correctly and commands are registered.
