---
id: implement-tool-dispatcher-with-approval-gates
title: Implement tool dispatcher with approval gates
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:large'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#10-chunk-7-agent-loop--tool-dispatcher
state: closed
createdAt: '2026-03-12T13:56:20.460Z'
priority: must
effort: 2d
dependencies:
  - Implement MCP registry for server management
  - 'Implement built-in tools (loadSkill, spawnSubagent, mergeSubagentResults)'
---
## Context

The tool dispatcher routes tool calls to either built-in tools or MCP servers. It implements the approval gate mechanism for external tool calls.

**Related Plan Section:**
- [Chunk 7: Agent Loop & Tool Dispatcher](../plans/v1.md#10-chunk-7-agent-loop--tool-dispatcher)

**Related Requirements:**
- [REQ-FUNC-075](../spec/srs.md#req-func-075) - Determine approval requirement
- [REQ-FUNC-076](../spec/srs.md#req-func-076) - Display approval card
- [REQ-FUNC-077](../spec/srs.md#req-func-077) - Execute approved tool
- [REQ-FUNC-078](../spec/srs.md#req-func-078) - Validate edited parameters
- [REQ-FUNC-079](../spec/srs.md#req-func-079) - Record denial and notify model
- [REQ-FUNC-081](../spec/srs.md#req-func-081) - Auto-approve configured categories
- [BR-003](../spec/bsr.md#br-003) - Tool approval gates

**Related Architecture:**
- [ASR-SEC-002](../spec/archi.md#asr-sec-002) - Tool approval gates
- [ADR-005](../spec/archi.md#adr-005-approval-gate-via-oneshot-channels) - Approval gate via oneshot channels

## Problem Statement

We need to implement the tool dispatcher that routes tool calls to the appropriate handler and manages approval gates for external tools.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs` — ToolDispatcher implementation
- `src-tauri/skilldeck-core/src/agent/approval_gate.rs` — ApprovalGate implementation

**ToolDispatcher:**
- `new(mcp_registry, approval_gate)` — Create dispatcher
- `dispatch(tool_call)` — Route and execute tool
- `dispatch_builtin(name, arguments)` — Handle built-in tools
- `dispatch_mcp(name, arguments)` — Handle MCP tools
- `needs_approval(tool_name)` — Check approval requirement

**ApprovalGate:**
- `new()` — Create gate
- `request_approval(tool_call_id, tool_name, input)` — Request approval
- `resolve(tool_call_id, result)` — Resolve approval
- `cancel_all()` — Cancel all pending

**ApprovalResult:**
- `Approved { edited_input }` — Approved with optional edited input
- `Denied { reason }` — Denied with reason
- `Cancelled` — Cancelled

**Approval categories:**
- `autoApproveReads` — File read operations
- `autoApproveWrites` — File write operations
- `autoApproveSelects` — Database SELECT queries
- `autoApproveMutations` — Database mutations
- `autoApproveHttpRequests` — HTTP requests
- `autoApproveShell` — Shell commands

## Acceptance Criteria

- [x] Routes built-in tools without approval
- [x] Routes MCP tools with approval check
- [x] Creates approval gate for external tools
- [x] Resolves approval from frontend (oneshot channel)
- [x] Supports edited parameters
- [x] Supports denial with reason
- [x] Supports cancellation
- [ ] Respects auto-approve configuration (not implemented)
- [x] Unit tests verify routing
- [x] Unit tests verify approval flow

## Testing Requirements

**Unit tests:**
- [x] `approval_gate_flow` — Approval gate works
- [x] `needs_approval` — Approval check works

**BDD scenarios:**
- [ ] [SC-FUNC-018](../spec/test-verification.md#sc-func-018) - Tool call request
- [ ] [SC-FUNC-019](../spec/test-verification.md#sc-func-019) - Tool approval gate
- [ ] [SC-FUNC-020](../spec/test-verification.md#sc-func-020) - Tool execution timeout

## Dependencies

- **Blocked by:** MCP registry, built-in tools
- **Blocks:** Agent loop

**Completion Note:** Tool dispatcher and approval gate are implemented with oneshot channels. Built-in tools are stubs, so dispatch_builtin returns dummy JSON. Auto-approve categories not implemented. The dispatcher is used by AgentLoop.
