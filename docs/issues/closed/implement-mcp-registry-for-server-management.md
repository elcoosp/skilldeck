---
id: implement-mcp-registry-for-server-management
title: Implement MCP registry for server management
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#9-chunk-6-mcp-client--supervision
state: closed
createdAt: '2026-03-12T13:53:55.312Z'
priority: must
effort: 1d
dependencies:
  - Implement MCP stdio transport
  - Implement MCP SSE transport
---
## Context

The MCP registry manages all connected MCP servers, tracks their status, and provides tool discovery across all servers.

**Related Plan Section:**
- [Chunk 6: MCP Client & Supervision](../plans/v1.md#9-chunk-6-mcp-client--supervision)

**Related Requirements:**
- [REQ-FUNC-065](../spec/srs.md#req-func-065) - Connect to MCP server
- [REQ-FUNC-066](../spec/srs.md#req-func-066) - Discover tools on connect
- [REQ-FUNC-070](../spec/srs.md#req-func-070) - Monitor MCP server health

## Problem Statement

We need to implement the MCP registry that stores connected servers, tracks their status, and aggregates tools from all servers.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/mcp/registry.rs` — McpRegistry implementation

**Key structures:**
- `McpRegistry` — Registry holding all servers
- `LiveServer` — Server with status and session
- `ServerStatus` — Enum: Disconnected, Connecting, Connected, Error, Failed

**Key functions:**
- `add_server(name, config)` — Add server to registry
- `connect(id, config)` — Connect to server
- `disconnect(id)` — Disconnect server
- `get(id)` — Get server by ID
- `list()` — List all servers
- `all_tools()` — Get all tools from connected servers
- `call_tool(server_name, tool_name, arguments)` — Execute tool

**DashMap usage:**
- Thread-safe concurrent access
- Stores LiveServer by UUID

## Acceptance Criteria

- [x] Adds servers to registry
- [x] Connects servers via transport
- [x] Tracks server status
- [x] Aggregates tools from all servers
- [x] Executes tool calls
- [x] Handles disconnection
- [x] Unit tests verify server management
- [x] Unit tests verify tool aggregation

## Testing Requirements

**Unit tests:**
- [x] `add_server` — Server is added
- [x] `list_servers` — All servers listed
- [x] `all_tools_empty_when_disconnected` — No tools when disconnected

## Dependencies

- **Blocked by:** MCP transports
- **Blocks:** MCP supervisor

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** Registry is fully implemented with unit tests. The `connect` method is present and uses transports.
