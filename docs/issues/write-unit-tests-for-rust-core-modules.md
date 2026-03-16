---
id: write-unit-tests-for-rust-core-modules
title: Write unit tests for Rust core modules
labels:
  - testing
  - 'priority:must'
  - 'type:test'
  - 'size:large'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#16-chunk-13-tests--unit--integration
state: in-progress
createdAt: '2026-03-12T13:59:50.862Z'
priority: must
effort: 3d
dependencies:
  - Implement workflow executor with pattern runners
  - Implement agent loop with streaming and debouncing
  - Implement MCP stdio transport
  - Implement filesystem skill loader
  - Implement database layer with SQLite and SeaORM
---
## Context

Unit tests verify individual functions and modules in isolation. We need comprehensive unit tests for the Rust core library.

**Related Plan Section:**
- [Chunk 13: Tests — Unit & Integration](../plans/v1.md#16-chunk-13-tests--unit--integration)

**Related Requirements:**
- [REQ-MAIN-001](../spec/srs.md#req-main-001) - Structured logging
- [REQ-MAIN-003](../spec/srs.md#req-main-003) - Business logic in Rust core

## Problem Statement

We need to write unit tests for all Rust core modules including error types, database layer, model providers, MCP client, skill system, agent loop, workflow executor, and workspace detection.

## Solution Approach
### Implementation Details

**Test files to create:**
- `src-tauri/skilldeck-core/tests/unit/core_error_tests.rs` — Error type tests
- `src-tauri/skilldeck-core/tests/unit/db_connection_tests.rs` — Database tests
- `src-tauri/skilldeck-core/tests/unit/provider_tests.rs` — Provider tests
- `src-tauri/skilldeck-core/tests/unit/mcp_types_tests.rs` — MCP types tests
- `src-tauri/skilldeck-core/tests/unit/skill_loader_tests.rs` — Skill loader tests
- `src-tauri/skilldeck-core/tests/unit/skill_resolver_tests.rs` — Skill resolver tests
- `src-tauri/skilldeck-core/tests/unit/agent_loop_tests.rs` — Agent loop tests
- `src-tauri/skilldeck-core/tests/unit/workflow_graph_tests.rs` — Workflow graph tests
- `src-tauri/skilldeck-core/tests/unit/workspace_detector_tests.rs` — Workspace detector tests

**Test coverage targets:**
- Line coverage ≥ 80%
- Branch coverage ≥ 70%
- All error variants tested
- All public functions tested

## Acceptance Criteria

- [x] Error type tests pass
- [ ] Database tests pass (some exist)
- [ ] Provider tests pass (some exist for Claude, OpenAI, Ollama)
- [x] MCP types tests pass
- [x] Skill loader tests pass
- [x] Skill resolver tests pass
- [ ] Agent loop tests pass (some exist)
- [x] Workflow graph tests pass
- [x] Workspace detector tests pass
- [ ] Line coverage ≥ 80%
- [ ] Branch coverage ≥ 70%

## Testing Requirements

**Unit tests:**
- `error_code_consistency` — Every error has unique code
- `retryable_classification` — Retryable errors identified
- `suggested_action_present_for_common_errors` — Common errors have actions
- `db_opens_in_memory` — Database opens
- `db_migration_runs` — Migrations run
- `db_integrity_check` — Integrity check passes
- `provider_id` — Provider returns correct ID
- `message_conversion` — Messages convert correctly
- `tool_conversion` — Tools convert correctly
- `skill_creation` — Skill creates correctly
- `skill_hash_computation` — Hash computed correctly
- `resolve_skills` — Skills resolve correctly
- `valid_graph` — Valid workflow creates graph
- `execution_order` — Topological order correct
- `cycle_detection` — Cycles detected
- `detect_rust` — Rust project detected
- `detect_node` — Node project detected

## Dependencies

- **Blocked by:** All Rust core modules
- **Blocks:** Integration tests

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 3d

**Completion Note:** Many unit tests exist for core modules, but coverage is incomplete. Some modules (like providers, database) lack comprehensive tests. Agent loop has only configuration tests.
