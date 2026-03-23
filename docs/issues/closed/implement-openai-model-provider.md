---
id: implement-openai-model-provider
title: Implement OpenAI model provider
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:small'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#7-chunk-4-model-providers
state: closed
createdAt: '2026-03-12T13:51:42.846Z'
priority: should
effort: 0.5d
dependencies:
  - Define plugin traits for dependency inversion
---
## Context

The OpenAI provider enables users to use GPT models with SkillDeck. It implements the ModelProvider trait with OpenAI-compatible API format.

**Related Plan Section:**
- [Chunk 4: Model Providers](../plans/v1.md#7-chunk-4-model-providers)

**Related Requirements:**
- [REQ-FUNC-011](../spec/srs.md#req-func-011) - Build context and call provider
- [REQ-REL-003](../spec/srs.md#req-rel-003) - API retry with backoff

## Problem Statement

We need to implement the OpenAI provider that connects to OpenAI's API, handles streaming responses, and implements proper error handling.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/providers/openai.rs` — OpenAI provider implementation

**Key features:**
- HTTP client with 120s timeout
- SSE streaming for token-by-token responses
- Exponential backoff retry
- OpenAI-compatible request format
- Model listing (GPT-4o, GPT-4o-mini, GPT-4 Turbo)

**Request format:**
- `model` — Model identifier
- `messages` — Conversation messages (system, user, assistant roles)
- `max_tokens` — Maximum output tokens
- `temperature` — Sampling temperature
- `tools` — Tool definitions
- `stream` — Enable streaming
- `stream_options` — Include usage in stream

**Response format:**
- SSE events with `data: {...}` lines
- `[DONE]` terminator

## Acceptance Criteria

- [x] Provider implements ModelProvider trait
- [x] Streaming completion works correctly
- [x] Exponential backoff retry is implemented
- [x] Error classification is correct
- [x] Model listing returns available models
- [x] Unit tests verify message conversion
- [x] Unit tests verify tool conversion

## Testing Requirements

**Unit tests:**
- [x] `provider_id` — Provider returns correct ID and display name
- [x] `message_conversion` — Messages convert to OpenAI format
- [x] `tool_conversion` — Tools convert to OpenAI format
- [x] `list_models` — Model listing works
- [x] `custom_base_url` — Custom base URL works

## Dependencies

- **Blocked by:** Plugin traits
- **Blocks:** Agent loop

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 0.5d

**Completion Note:** OpenAI provider is implemented with retry logic and streaming. Unit tests present.
