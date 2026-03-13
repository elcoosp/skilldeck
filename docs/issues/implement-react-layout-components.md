---
id: implement-react-layout-components
title: Implement React layout components
labels:
  - frontend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#15-chunk-12-react-frontend--components
state: open
createdAt: '2026-03-12T13:59:50.859Z'
priority: must
effort: 2d
dependencies:
  - Set up React frontend foundation
---
## Context

The layout components provide the three-panel resizable interface for the application shell.

**Related Plan Section:**
- [Chunk 12: React Frontend — Components](../plans/v1.md#15-chunk-12-react-frontend--components)

**Related Requirements:**
- [REQ-USA-001](../spec/srs.md#req-usa-001) - Keyboard navigation
- [REQ-PERF-003](../spec/srs.md#req-perf-003) - 60fps UI responsiveness

## Problem Statement

We need to implement the layout components including the app shell, left panel (conversations), center panel (messages), and right panel (session/workflow/analytics).

## Solution Approach

### Implementation Details

**Files to create:**
- `src/components/ui/` — shadcn/ui components (button, input, dialog, etc.)
- `src/components/layout/app-shell.tsx` — Main app shell
- `src/components/layout/left-panel.tsx` — Conversation list
- `src/components/layout/center-panel.tsx` — Message thread
- `src/components/layout/right-panel.tsx` — Session/workflow/analytics tabs

**AppShell:**
- Three-panel layout using react-resizable-panels
- Left panel: Conversation list (280px default)
- Center panel: Message thread (flexible)
- Right panel: Session/workflow/analytics (320px default)
- Panel resize handles

**LeftPanel:**
- New conversation button
- Search input
- Conversation list (virtualized)
- Open workspace button

**CenterPanel:**
- Message thread (virtualized)
- Branch navigation
- Message input

**RightPanel:**
- Session tab (active skills, MCP servers)
- Workflow tab (DAG visualization)
- Analytics tab (token usage)

## Acceptance Criteria

- [ ] Three-panel layout renders correctly
- [ ] Panels are resizable
- [ ] Left panel shows conversation list
- [ ] Center panel shows message thread
- [ ] Right panel shows tabs
- [ ] Keyboard navigation works
- [ ] Layout is responsive
- [ ] Unit tests verify rendering

## Testing Requirements

**Unit tests:**
- [ ] `app_shell_renders` — App shell renders
- [ ] `left_panel_renders` — Left panel renders
- [ ] `center_panel_renders` — Center panel renders
- [ ] `right_panel_renders` — Right panel renders

## Dependencies

- **Blocked by:** React frontend foundation
- **Blocks:** Conversation components

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 2d

**Completion Note:** Frontend layout components not present.
