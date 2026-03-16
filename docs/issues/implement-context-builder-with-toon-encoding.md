---
id: implement-context-builder-with-toon-encoding
title: Implement context builder with TOON encoding
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#10-chunk-7-agent-loop--tool-dispatcher
state: in-progress
createdAt: '2026-03-12T13:56:20.457Z'
priority: should
effort: 1d
dependencies:
  - Implement skill resolver with priority ordering
---
## Context

The context builder assembles the system prompt, conversation history, and active skills into a format optimized for the model. It may use TOON (Tree of Object Notation) encoding for token efficiency.

**Related Plan Section:**
- [Chunk 7: Agent Loop & Tool Dispatcher](../plans/v1.md#10-chunk-7-agent-loop--tool-dispatcher)

**Related Requirements:**
- [REQ-FUNC-011](../spec/srs.md#req-func-011) - Build context and call provider
- [REQ-FUNC-055](../spec/srs.md#req-func-055) - Enable skill for profile

## Problem Statement

We need to implement the context builder that assembles the complete context for the model request, including system prompt, skills, and conversation history.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/agent/context_builder.rs` — ContextBuilder implementation

**Key functions:**
- `build_context(conversation, skills, system_prompt)` — Build complete context
- `apply_toon(content)` — Apply TOON encoding (optional)
- `truncate_to_limit(context, max_tokens)` — Truncate if needed

**Context assembly order:**
1. System prompt
2. Active skills (by priority)
3. Conversation history (limited)
4. Current user message

**TOON encoding (optional):**
- Token-efficient structured format
- Fallback to JSON if not supported

## Acceptance Criteria

- [x] Assembles system prompt correctly
- [x] Includes active skills by priority
- [x] Includes conversation history
- [x] Respects token limits (truncates messages)
- [ ] Supports TOON encoding (optional)
- [ ] Falls back to JSON if needed

## Dependencies

- **Blocked by:** Skill resolver
- **Blocks:** Agent loop

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** ContextBuilder builds system prompt and trims messages, but TOON encoding is not implemented. The builder is used by AgentLoop.
