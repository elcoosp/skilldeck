---
id: implement-mcp-types-and-json-rpc-protocol
title: Implement MCP types and JSON-RPC protocol
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#9-chunk-6-mcp-client--supervision
state: open
createdAt: '2026-03-12T13:53:55.309Z'
priority: must
effort: 1d
dependencies:
  - Implement core error types and error taxonomy
---
## Context

MCP (Model Context Protocol) uses JSON-RPC 2.0 for communication. We need to define all protocol types for requests, responses, and events.

**Related Plan Section:**
- [Chunk 6: MCP Client & Supervision](../plans/v1.md#9-chunk-6-mcp-client--supervision)

**Related Requirements:**
- [REQ-FUNC-065](../spec/srs.md#req-func-065) - Connect to MCP server
- [REQ-FUNC-066](../spec/srs.md#req-func-066) - Discover tools on connect

## Problem Statement

We need to implement all MCP protocol types including JSON-RPC request/response structures, initialize parameters, tool definitions, and content types.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/mcp/mod.rs` — MCP module
- `src-tauri/skilldeck-core/src/mcp/types.rs` — Protocol types

**Types to implement:**

**JSON-RPC:**
- `JsonRpcRequest` — JSON-RPC 2.0 request
- `JsonRpcResponse` — JSON-RPC 2.0 response
- `JsonRpcError` — JSON-RPC error

**Initialize:**
- `InitializeParams` — Client capabilities
- `InitializeResult` — Server capabilities
- `ClientCapabilities` — Client feature flags
- `ServerCapabilities` — Server feature flags

**Tools:**
- `ListToolsParams` — Tool list request
- `ListToolsResult` — Tool list response
- `McpToolDefinition` — Tool definition
- `CallToolParams` — Tool call request
- `CallToolResult` — Tool call result

**Content:**
- `Content` — Content enum (Text, Image, Resource)
- `ResourceContents` — Resource data

## Acceptance Criteria

- [ ] All JSON-RPC types serialize/deserialize correctly
- [ ] Initialize handshake types are complete
- [ ] Tool types support all MCP features
- [ ] Content types handle text, image, and resource
- [ ] Unit tests verify serialization
- [ ] Unit tests verify deserialization

## Testing Requirements

**Unit tests:**
- `json_rpc_request_serialization` — Request serializes correctly
- `json_rpc_response_deserialization` — Response deserializes correctly
- `json_rpc_error_deserialization` — Error deserializes correctly
- `initialize_params_default` — Default params are valid
- `content_text_serialization` — Text content serializes
- `call_tool_params_serialization` — Tool call params serialize

## Dependencies

- **Blocked by:** Core error types
- **Blocks:** MCP transport implementations

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
