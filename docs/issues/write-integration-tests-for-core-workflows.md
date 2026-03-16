---
id: write-integration-tests-for-core-workflows
title: Write integration tests for core workflows
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
  - Write unit tests for Rust core modules
---
## Context

Integration tests verify that multiple modules work together correctly. We need tests for agent loop, skill resolution, MCP client, and workflow executor.

**Related Plan Section:**
- [Chunk 13: Tests — Unit & Integration](../plans/v1.md#16-chunk-13-tests--unit--integration)

## Problem Statement

We need to write integration tests that verify end-to-end workflows including agent loop execution, skill resolution, MCP client communication, and workflow execution.

## Solution Approach

### Implementation Details

**Test files to create:**
- `tests/integration/agent_loop.rs` — Agent loop integration tests
- `tests/integration/skill_resolver.rs` — Skill resolution integration tests
- `tests/integration/mcp_client.rs` — MCP client integration tests
- `tests/integration/workflow_executor.rs` — Workflow executor integration tests

**Agent loop integration tests:**
- Full message exchange flow
- Tool call handling
- Error recovery
- Cancellation

**Skill resolution integration tests:**
- Full resolution flow
- Priority ordering
- Shadow detection
- Hot reload

**MCP client integration tests:**
- Connection lifecycle
- Tool discovery
- Tool execution
- Supervision restart

**Workflow executor integration tests:**
- Sequential execution
- Parallel execution
- Evaluator-optimizer
- Subagent spawning

## Acceptance Criteria

- [ ] Agent loop integration tests pass (some exist but not comprehensive)
- [ ] Skill resolution integration tests pass (unit tests exist, integration missing)
- [ ] MCP client integration tests pass (missing)
- [ ] Workflow executor integration tests pass (some exist with placeholder sleeps)
- [ ] Tests use mock servers/providers
- [ ] Tests are deterministic

## Testing Requirements

**Integration tests:**
- `agent_loop_processes_message` — Message processed correctly (stub)
- `agent_loop_handles_tool_call` — Tool call handled (stub)
- `skill_resolution_priority` — Priority order correct (unit)
- `mcp_client_connects` — Client connects (missing)
- `mcp_client_discovers_tools` — Tools discovered (missing)
- `workflow_sequential` — Sequential workflow executes (stub)
- `workflow_parallel` — Parallel workflow executes (stub)

## Dependencies

- **Blocked by:** Unit tests
- **Blocks:** E2E tests

## Effort Estimate

- **Complexity:** High
- **Effort:** 3d

**Completion Note:** Some integration tests exist (e.g., `agent_loop_tests.rs`, `skill_loader_tests.rs`, `workflow_executor_tests.rs`) but are not comprehensive. Many are stubs or use placeholder sleeps. MCP client tests are missing.
