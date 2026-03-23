---
id: implement-mcp-stdio-transport
title: Implement MCP stdio transport
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:large'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#9-chunk-6-mcp-client--supervision
state: closed
createdAt: '2026-03-12T13:53:55.310Z'
priority: must
effort: 2d
dependencies:
  - Implement MCP types and JSON-RPC protocol
---
## Context

The stdio transport is the primary mechanism for communicating with local MCP servers. It spawns subprocesses and communicates via stdin/stdout using JSON-RPC.

**Related Plan Section:**
- [Chunk 6: MCP Client & Supervision](../plans/v1.md#9-chunk-6-mcp-client--supervision)

**Related Requirements:**
- [REQ-FUNC-065](../spec/srs.md#req-func-065) - Connect to MCP server
- [REQ-FUNC-066](../spec/srs.md#req-func-066) - Discover tools on connect
- [REQ-FUNC-067](../spec/srs.md#req-func-067) - Display connection error
- [REQ-FUNC-068](../spec/srs.md#req-func-068) - Timeout after 30s

## Problem Statement

We need to implement the stdio transport that spawns MCP server processes, communicates via JSON-RPC over stdin/stdout, and handles the initialize handshake.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/mcp/stdio_transport.rs` — StdioTransport implementation

**Key features:**
- Spawn subprocess with configured command and args
- Write JSON-RPC requests to stdin
- Read JSON-RPC responses from stdout
- Initialize handshake with capabilities exchange
- Tool discovery via tools/list
- Tool execution via tools/call
- Process cleanup on drop

**StdioSessionInner:**
- Holds stdin/stdout handles
- Manages request ID counter
- Sends requests and reads responses
- Implements McpSessionInner trait

## Acceptance Criteria

- [x] Spawns subprocess correctly
- [x] Sends JSON-RPC requests via stdin
- [x] Reads JSON-RPC responses from stdout
- [x] Performs initialize handshake
- [x] Lists tools after initialization
- [x] Executes tool calls
- [x] Cleans up process on drop
- [x] Handles connection errors
- [x] Unit tests verify config parsing
- [ ] Integration tests verify full handshake (missing)

## Testing Requirements

**Unit tests:**
- [x] `parse_config` — Config parsing works
- [x] `parse_config_missing_command` — Missing command returns error
- [x] `supports_stdio` — Supports check works

**Integration tests:**
- [ ] Mock MCP server subprocess
- [ ] Full initialize handshake
- [ ] Tool listing
- [ ] Tool execution

## Dependencies

- **Blocked by:** MCP types
- **Blocks:** MCP registry

## Effort Estimate

- **Complexity:** High
- **Effort:** 2d

**Completion Note:** Stdio transport is implemented. Code review noted potential resource leak in drop and unwrap usage. Integration tests missing.
