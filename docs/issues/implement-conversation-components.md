---
id: implement-conversation-components
title: Implement conversation components
labels:
  - frontend
  - 'priority:must'
  - 'type:feature'
  - 'size:large'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#15-chunk-12-react-frontend--components
state: open
createdAt: '2026-03-12T13:59:50.860Z'
priority: must
effort: 3d
dependencies:
  - Implement React layout components
---
## Context

Conversation components handle the display of conversations, messages, branches, and tool calls.

**Related Plan Section:**
- [Chunk 12: React Frontend — Components](../plans/v1.md#15-chunk-12-react-frontend--components)

**Related Requirements:**
- [REQ-FUNC-002](../spec/srs.md#req-func-002) - Select conversation from sidebar
- [REQ-FUNC-003](../spec/srs.md#req-func-003) - Display messages in branch structure
- [REQ-FUNC-020](../spec/srs.md#req-func-020) - Create branch from message
- [REQ-FUNC-021](../spec/srs.md#req-func-021) - Display branch navigator
- [REQ-FUNC-076](../spec/srs.md#req-func-076) - Display approval card

## Problem Statement

We need to implement conversation components including conversation list, message thread, message bubbles, branch navigation, tool call cards, and approval cards.

## Solution Approach

### Implementation Details

**Files to create:**
- `src/components/conversation/conversation-list.tsx` — Conversation list
- `src/components/conversation/conversation-item.tsx` — Single conversation
- `src/components/conversation/message-thread.tsx` — Message thread (virtualized)
- `src/components/conversation/message-bubble.tsx` — Message bubble
- `src/components/conversation/branch-nav.tsx` — Branch navigation
- `src/components/conversation/tool-call-card.tsx` — Tool call display
- `src/components/conversation/tool-approval-card.tsx` — Approval card
- `src/components/conversation/subagent-card.tsx` — Subagent display
- `src/components/conversation/artifact-card.tsx` — Artifact display
- `src/components/conversation/message-input.tsx` — Message input with enhancements

**ConversationList:**
- Virtualized list using react-virtuoso
- Search/filter functionality
- Active conversation highlighting

**MessageThread:**
- Virtualized rendering for performance
- Branch navigation integration
- Scroll position preservation

**MessageBubble:**
- User/assistant/system/tool roles
- Markdown rendering
- Code block syntax highlighting
- Artifact display

**ToolApprovalCard:**
- Tool name and parameters display
- Approve/Deny/Edit buttons
- Parameter editing
- Approval state management

**MessageInput:**
- Textarea with auto-resize
- Slash command palette
- Skill selector (@)
- File attachment (#)
- Send on Cmd+Enter

## Acceptance Criteria

- [ ] Conversation list renders correctly
- [ ] Message thread renders with virtualization
- [ ] Message bubbles display correctly
- [ ] Branch navigation works
- [ ] Tool call cards display
- [ ] Approval cards work
- [ ] Message input has all features
- [ ] Keyboard shortcuts work
- [ ] Unit tests verify rendering

## Testing Requirements

**Unit tests:**
- [ ] `message_bubble_renders` — Message bubble renders
- [ ] `branch_nav_renders` — Branch navigation renders
- [ ] `tool_approval_card_renders` — Approval card renders
- [ ] `message_input_renders` — Message input renders

**BDD scenarios:**
- [ ] [SC-FUNC-005](../spec/test-verification.md#sc-func-005) - Create branch from message
- [ ] [SC-FUNC-006](../spec/test-verification.md#sc-func-006) - Navigate between branches
- [ ] [SC-FUNC-007](../spec/test-verification.md#sc-func-007) - Merge branch into main thread
- [ ] [SC-FUNC-019](../spec/test-verification.md#sc-func-019) - Tool approval gate

## Dependencies

- **Blocked by:** Layout components
- **Blocks:** Integration testing

## Effort Estimate

- **Complexity:** High
- **Effort:** 3d

**Completion Note:** Frontend components are not present in the provided Rust codebase. This issue remains open for frontend implementation.
