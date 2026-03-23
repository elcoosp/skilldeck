---
id: implement-mcp-sse-transport
title: Implement MCP SSE transport
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#9-chunk-6-mcp-client--supervision
state: closed
createdAt: '2026-03-12T13:53:55.311Z'
priority: should
effort: 1d
dependencies:
  - Implement MCP types and JSON-RPC protocol
---
## Context

The SSE transport enables communication with remote MCP servers via HTTP POST requests and Server-Sent Events for responses.

**Related Plan Section:**
- [Chunk 6: MCP Client & Supervision](../plans/v1.md#9-chunk-6-mcp-client--supervision)

**Related Requirements:**
- [REQ-FUNC-065](../spec/srs.md#req-func-065) - Connect to MCP server
- [REQ-FUNC-066](../spec/srs.md#req-func-066) - Discover tools on connect

## Problem Statement

We need to implement the SSE transport that connects to HTTP-based MCP servers, sends requests via POST, and receives responses via Server-Sent Events.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/mcp/sse_transport.rs` — SseTransport implementation

**Key features:**
- HTTP POST for requests
- SSE (Server-Sent Events) for responses
- Initialize handshake
- Tool discovery
- Tool execution
- Timeout handling

**SseSessionInner:**
- Holds HTTP client and base URL
- Sends POST requests to /mcp endpoint
- Parses SSE data lines
- Implements McpSessionInner trait

## Acceptance Criteria

- [x] Sends HTTP POST requests
- [x] Parses SSE responses
- [x] Performs initialize handshake
- [x] Lists tools after initialization
- [x] Executes tool calls
- [x] Handles connection errors
- [x] Unit tests verify URL parsing
- [x] Unit tests verify supports check

## Testing Requirements

**Unit tests:**
- [x] `parse_url` — URL parsing works
- [x] `parse_url_missing` — Missing URL returns error
- [x] `supports_sse` — Supports check works

## Dependencies

- **Blocked by:** MCP types
- **Blocks:** MCP registry

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** SSE transport is implemented. Code review noted that the entire SSE body is buffered, which could be improved for large responses.
