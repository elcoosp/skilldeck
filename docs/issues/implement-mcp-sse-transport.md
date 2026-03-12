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
state: open
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

- [ ] Sends HTTP POST requests
- [ ] Parses SSE responses
- [ ] Performs initialize handshake
- [ ] Lists tools after initialization
- [ ] Executes tool calls
- [ ] Handles connection errors
- [ ] Unit tests verify URL parsing
- [ ] Unit tests verify supports check

## Testing Requirements

**Unit tests:**
- `parse_url` — URL parsing works
- `parse_url_missing` — Missing URL returns error
- `supports_sse` — Supports check works

## Dependencies

- **Blocked by:** MCP types
- **Blocks:** MCP registry

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
