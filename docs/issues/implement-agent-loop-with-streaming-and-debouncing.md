---
id: implement-agent-loop-with-streaming-and-debouncing
title: Implement agent loop with streaming and debouncing
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:large'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#10-chunk-7-agent-loop--tool-dispatcher
state: in-progress
createdAt: '2026-03-12T13:56:20.456Z'
priority: must
effort: 2d
dependencies:
  - Implement Claude model provider
  - Implement MCP registry for server management
  - Implement MCP supervisor with exponential backoff
---
## Context

The agent loop is the heart of the conversation engine. It receives user messages, builds context, calls the model provider, streams responses with debouncing, and handles tool calls.

**Related Plan Section:**
- [Chunk 7: Agent Loop & Tool Dispatcher](../plans/v1.md#10-chunk-7-agent-loop--tool-dispatcher)

**Related Requirements:**
- [REQ-FUNC-010](../spec/srs.md#req-func-010) - Send message triggers agent loop
- [REQ-FUNC-011](../spec/srs.md#req-func-011) - Build context and call provider
- [REQ-FUNC-012](../spec/srs.md#req-func-012) - Stream tokens with < 100ms latency
- [REQ-FUNC-013](../spec/srs.md#req-func-013) - Persist assistant message
- [REQ-FUNC-014](../spec/srs.md#req-func-014) - Display error with action
- [REQ-FUNC-015](../spec/srs.md#req-func-015) - Cancel streaming response
- [REQ-PERF-002](../spec/srs.md#req-perf-002) - Render < 100ms
- [BR-008](../spec/bsr.md#br-008) - Model provider responses streamed with 50ms debounce

**Related Architecture:**
- [ASR-PERF-001](../spec/archi.md#asr-perf-001) - Message render < 100ms (p99)
- [ADR-002](../spec/archi.md#adr-002-tiered-streaming-for-ipc-boundary) - Tiered streaming

## Problem Statement

We need to implement the agent loop that orchestrates the conversation flow: receiving messages, building context with skills and history, calling the model provider, streaming responses with 50ms debouncing, and handling tool calls.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/agent/mod.rs` — Agent module
- `src-tauri/skilldeck-core/src/agent/loop.rs` — AgentLoop implementation

**Key components:**

**AgentLoopConfig:**
- `debounce_ms` — Debounce interval (default: 50ms)
- `max_context_messages` — Maximum context messages (default: 100)
- `max_tool_iterations` — Maximum tool iterations (default: 10)

**AgentLoop:**
- `new(provider, model_id, config, tx)` — Create new loop
- `with_system_prompt(prompt)` — Set system prompt
- `with_skill(skill_content)` — Add skill
- `with_tool(tool)` — Add tool
- `with_history(messages)` — Set conversation history
- `run(user_message)` — Execute the loop
- `cancel()` — Cancel running loop

**Streaming architecture:**
1. Ring buffer accumulates tokens from model
2. 50ms debounce timer
3. Immediate flush on Done or buffer > 100 tokens
4. IPC emit to frontend
5. Frontend uses requestAnimationFrame for rendering

**AgentEvent enum:**
- `Started { conversation_id }`
- `Token { delta }`
- `ToolCall { tool_call }`
- `ToolResult { tool_call_id, result }`
- `Done { input_tokens, output_tokens, cache_read_tokens, cache_write_tokens }`
- `Error { message }`

## Acceptance Criteria

- [x] Agent loop processes user messages
- [x] Context is built with skills and history
- [x] Model provider is called correctly
- [x] Tokens are streamed with 50ms debounce
- [x] Tool calls are handled
- [x] Responses are persisted (handled in Tauri command)
- [x] Errors are handled with suggested actions
- [ ] Cancellation is supported (token exists but not wired to Tauri command)
- [x] Unit tests verify configuration
- [ ] Integration tests verify streaming (some exist but not comprehensive)

## Testing Requirements

**Unit tests:**
- [x] `config_default` — Default configuration is valid

**Integration tests:**
- [ ] `agent_loop_processes_message` — Message is processed
- [ ] `agent_loop_handles_tool_call` — Tool call is handled

**BDD scenarios:**
- [ ] [SC-FUNC-003](../spec/test-verification.md#sc-func-003) - Send message and receive streaming response
- [ ] [SC-FUNC-004](../spec/test-verification.md#sc-func-004) - Model provider error handling

## Dependencies

- **Blocked by:** Model providers, MCP registry
- **Blocks:** Tool dispatcher, context builder

## Effort Estimate

- **Complexity:** High
- **Effort:** 2d

**Completion Note:** Agent loop is implemented with streaming, debouncing, and tool handling. Persistence occurs in the Tauri command after loop completion. Cancellation token exists but is not yet linked to the loop instance. Integration tests are partially present but need expansion.
