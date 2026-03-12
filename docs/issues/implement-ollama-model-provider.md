---
id: implement-ollama-model-provider
title: Implement Ollama model provider
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:small'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#7-chunk-4-model-providers
state: open
createdAt: '2026-03-12T13:51:42.847Z'
priority: should
effort: 0.5d
dependencies:
  - Define plugin traits for dependency inversion
---
## Context

The Ollama provider enables local LLM inference for users who need complete data sovereignty. It uses the OpenAI-compatible API provided by Ollama.

**Related Plan Section:**
- [Chunk 4: Model Providers](../plans/v1.md#7-chunk-4-model-providers)

**Related Requirements:**
- [REQ-FUNC-011](../spec/srs.md#req-func-011) - Build context and call provider
- [REQ-DEP-003](../spec/srs.md#req-dep-003) - Ollama (optional)

## Problem Statement

We need to implement the Ollama provider that connects to local Ollama instances, handles streaming responses, and properly manages errors without retry (local).

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/providers/ollama.rs` — Ollama provider implementation

**Key features:**
- HTTP client connecting to localhost (default port 11434)
- OpenAI-compatible API format
- No retry on errors (local inference)
- TOON support disabled (may not support all optimizations)
- Model listing (Llama 3.2, Llama 3.1, Code Llama)

**Configuration:**
- Configurable port
- Custom model selection

## Acceptance Criteria

- [ ] Provider implements ModelProvider trait
- [ ] Streaming completion works correctly
- [ ] No retry on errors
- [ ] TOON support flag is false
- [ ] Model listing returns available models
- [ ] Unit tests verify provider creation
- [ ] Unit tests verify default port

## Testing Requirements

**Unit tests:**
- `provider_id` — Provider returns correct ID and display name
- `default_port` — Default port is 11434

## Dependencies

- **Blocked by:** Plugin traits
- **Blocks:** Agent loop

## Effort Estimate

- **Complexity:** Low
- **Effort:** 0.5d
