---
id: implement-core-error-types-and-error-taxonomy
title: Implement core error types and error taxonomy
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#4-chunk-1-core-error-types--utilities
state: closed
createdAt: '2026-03-12T13:51:42.843Z'
priority: must
effort: 1d
dependencies:
  - Set up project scaffolding and directory structure
---
## Context

The core error type is foundational to the entire Rust codebase. It provides a comprehensive taxonomy of all failure modes in the system, enabling meaningful error messages, recovery actions, and proper error propagation across the Tauri IPC boundary.

**Related Plan Section:**
- [Chunk 1: Core Error Types & Utilities](../plans/v1.md#4-chunk-1-core-error-types--utilities)

**Related Requirements:**
- [REQ-USA-002](../spec/srs.md#req-usa-002) - Error messages with clear description and suggested action

**Related Architecture:**
- [ADR-001](../spec/archi.md#adr-001-three-layer-architecture-rust-core--tauri-shell--react-ui) - Core library with zero Tauri dependencies

## Problem Statement

We need a comprehensive error type that covers all failure modes in the system: model provider errors, MCP errors, skill errors, workflow errors, database errors, workspace errors, and I/O errors. Each error variant must provide enough context for debugging and potential recovery actions.

## Solution Approach

### Implementation Details

**Files to create/modify:**
- `src-tauri/skilldeck-core/src/error.rs` — Core error type with all variants

**Error categories to implement:**
1. **Model Provider Errors** — Request rejected, rate limited, internal error, connection failed, invalid response, authentication failed, timeout
2. **MCP Errors** — Server not found, connection failed, disconnected, tool not found, tool execution failed, tool timeout, JSON-RPC error, max restarts exceeded
3. **Skill Errors** — Not found, parse failed, invalid YAML, not in registry, traversal not allowed, source not found
4. **Workflow Errors** — Cycle detected, step not found, execution failed, invalid definition, subagent spawn/execution failed, max depth exceeded
5. **Database Errors** — Connection failed, query failed, migration failed, entity not found, transaction failed
6. **Workspace Errors** — Not found, detection failed, context not found
7. **I/O Errors** — File operation failed, permission denied, directory operation failed
8. **Internal Errors** — Internal state error, cancelled, not implemented, invalid configuration, channel error, lock acquisition

**Key methods:**
- `is_retryable()` — Returns true for transient errors
- `retry_after_ms()` — Returns suggested retry delay
- `error_code()` — Returns user-friendly error code for frontend
- `suggested_action()` — Returns suggested action for user

**From implementations:**
- `From<std::io::Error>`
- `From<serde_json::Error>`
- `From<serde_yaml::Error>`
- `From<sea_orm::DbErr>`
- `From<tokio::task::JoinError>`

## Acceptance Criteria

- [x] All error variants have descriptive messages with context
- [x] `is_retryable()` correctly identifies transient errors
- [x] `error_code()` returns unique codes for each variant
- [x] `suggested_action()` provides actionable guidance for common errors
- [x] All `From` implementations convert external errors appropriately
- [x] Unit tests verify error code consistency
- [x] Unit tests verify retryable classification
- [x] Unit tests verify suggested actions for common errors

## Testing Requirements

**Unit tests:**
- [x] `error_code_consistency` — Every variant has a unique error code
- [x] `retryable_classification` — Retryable errors are correctly identified
- [x] `suggested_action_present_for_common_errors` — Common errors have suggested actions

## Dependencies

- **Blocked by:** Project scaffolding issue
- **Blocks:** Database layer, all core modules

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** Fully implemented with comprehensive error taxonomy and helper methods. Code review found no missing variants.
