---
id: implement-tauri-commands-for-conversations-and-mes
title: Implement Tauri commands for conversations and messages
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#13-chunk-10-tauri-shell--commands--events
state: open
createdAt: '2026-03-12T13:59:50.855Z'
priority: must
effort: 1d
dependencies:
  - Implement Tauri state management and initialization
---
## Context

Tauri commands provide the IPC interface for the React frontend to interact with the Rust core. We need to implement commands for conversation and message management.

**Related Plan Section:**
- [Chunk 10: Tauri Shell — Commands & Events](../plans/v1.md#13-chunk-10-tauri-shell--commands--events)

**Related Requirements:**
- [REQ-FUNC-001](../spec/srs.md#req-func-001) - Create conversation
- [REQ-FUNC-002](../spec/srs.md#req-func-002) - Select conversation
- [REQ-FUNC-003](../spec/srs.md#req-func-003) - Display messages
- [REQ-FUNC-004](../spec/srs.md#req-func-004) - Rename conversation
- [REQ-FUNC-005](../spec/srs.md#req-func-005) - Archive conversation
- [REQ-FUNC-010](../spec/srs.md#req-func-010) - Send message
- [REQ-FUNC-011](../spec/srs.md#req-func-011) - Build context and call provider

## Problem Statement

We need to implement Tauri commands for creating, listing, and managing conversations and messages.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/src/commands/mod.rs` — Commands module
- `src-tauri/src/commands/conversations.rs` — Conversation commands
- `src-tauri/src/commands/messages.rs` — Message commands

**Conversation commands:**
- `create_conversation(profile_id, title?)` — Create new conversation
- `list_conversations(profile_id?, limit?)` — List conversations
- `get_conversation(id)` — Get single conversation
- `delete_conversation(id)` — Delete conversation
- `rename_conversation(id, title)` — Rename conversation
- `archive_conversation(id)` — Archive conversation

**Message commands:**
- `list_messages(conversation_id, branch_id?)` — List messages
- `send_message(conversation_id, content)` — Send message
- `get_message(id)` — Get single message

**Event emission:**
- `AgentEvent::Started` — Agent loop started
- `AgentEvent::Token` — Token streamed
- `AgentEvent::ToolCall` — Tool call requested
- `AgentEvent::Done` — Agent loop completed
- `AgentEvent::Error` — Error occurred

## Acceptance Criteria

- [ ] All conversation commands work
- [ ] All message commands work
- [ ] Events are emitted correctly
- [ ] Errors are handled gracefully
- [ ] Commands are type-safe
- [ ] Integration tests verify commands

## Testing Requirements

**BDD scenarios:**
- [SC-FUNC-001](../spec/test-verification.md#sc-func-001) - Create conversation
- [SC-FUNC-002](../spec/test-verification.md#sc-func-002) - Select conversation
- [SC-FUNC-003](../spec/test-verification.md#sc-func-003) - Send message and receive streaming response

## Dependencies

- **Blocked by:** Tauri state management
- **Blocks:** Frontend development

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
