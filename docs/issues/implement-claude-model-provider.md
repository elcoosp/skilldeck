---
id: implement-claude-model-provider
title: Implement Claude model provider
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#7-chunk-4-model-providers
state: open
createdAt: '2026-03-12T13:51:42.846Z'
priority: must
effort: 1d
dependencies:
  - Define plugin traits for dependency inversion
---
## Context

The Claude provider is the primary model provider for SkillDeck. It implements the ModelProvider trait and handles streaming completions via Anthropic's API with proper error handling and retry logic.

**Related Plan Section:**
- [Chunk 4: Model Providers](../plans/v1.md#7-chunk-4-model-providers)

**Related Requirements:**
- [REQ-FUNC-010](../spec/srs.md#req-func-010) - Send message triggers agent loop
- [REQ-FUNC-011](../spec/srs.md#req-func-011) - Build context and call provider
- [REQ-FUNC-012](../spec/srs.md#req-func-012) - Stream tokens with < 100ms latency
- [REQ-REL-003](../spec/srs.md#req-rel-003) - API retry with backoff

**Related Architecture:**
- [ADR-004](../spec/archi.md#adr-004-plugin-trait-abstractions-for-providers-and-mcp) - Plugin trait abstractions

## Problem Statement

We need to implement the Claude provider that connects to Anthropic's API, handles streaming responses, implements exponential backoff retry, and properly manages errors.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/providers/mod.rs` — Provider module
- `src-tauri/skilldeck-core/src/providers/claude.rs` — Claude provider implementation

**Key features:**
- HTTP client with 120s timeout
- SSE streaming for token-by-token responses
- Exponential backoff retry (1s → 2s → 4s, max 60s)
- Proper error classification (retryable vs non-retryable)
- TOON format support flag
- Model listing (Claude Sonnet 4.5, Claude Opus 4, Claude 3.5 Sonnet)

**Error handling:**
- 429 Rate Limited → retry with backoff
- 5xx Server Error → retry with backoff
- 401 Unauthorized → fail immediately
- 400 Bad Request → fail immediately

**Request format:**
- `model` — Model identifier
- `max_tokens` — Maximum output tokens
- `messages` — Conversation messages
- `system` — System prompt
- `tools` — Tool definitions
- `stream` — Enable streaming

**Response format:**
- SSE events: `message_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`

## Acceptance Criteria

- [ ] Provider implements ModelProvider trait
- [ ] Streaming completion works correctly
- [ ] Exponential backoff retry is implemented
- [ ] Error classification is correct
- [ ] TOON support flag is set
- [ ] Model listing returns available models
- [ ] Unit tests verify message conversion
- [ ] Unit tests verify tool conversion
- [ ] Integration tests verify API calls (with mock)

## Testing Requirements

**Unit tests:**
- `provider_id` — Provider returns correct ID and display name
- `message_conversion` — Messages convert to Claude format
- `tool_conversion` — Tools convert to Claude format
- `list_models` — Model listing works

**Integration tests:**
- Mock HTTP server returns valid streaming response
- Mock HTTP server returns rate limit error (verify retry)
- Mock HTTP server returns authentication error (verify no retry)

## Dependencies

- **Blocked by:** Plugin traits
- **Blocks:** Agent loop

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
