---
id: implement-right-panel-tabs-session-workflow-analyt
title: 'Implement right panel tabs (Session, Workflow, Analytics)'
labels:
  - frontend
  - 'priority:should'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#15-chunk-12-react-frontend--components
state: closed
createdAt: '2026-03-12T13:59:50.860Z'
priority: should
effort: 2d
dependencies:
  - Implement React layout components
---
## Context

The right panel contains tabs for session management, workflow visualization, and analytics.

**Related Plan Section:**
- [Chunk 12: React Frontend — Components](../plans/v1.md#15-chunk-12-react-frontend--components)

**Related Requirements:**
- [REQ-FUNC-047](../spec/srs.md#req-func-047) - Display active skills
- [REQ-FUNC-092](../spec/srs.md#req-func-092) - Display DAG visualization
- [REQ-USA-005](../spec/srs.md#req-usa-005) - Token counter display
- [REQ-USA-006](../spec/srs.md#req-usa-006) - Token usage per message

## Problem Statement

We need to implement the right panel tabs for session management (active skills, MCP servers), workflow visualization (DAG), and analytics (token usage).

## Solution Approach

### Implementation Details

**Files to create:**
- `src/components/right-panel/session-tab.tsx` — Session tab
- `src/components/right-panel/workflow-tab.tsx` — Workflow tab
- `src/components/right-panel/workflow-node.tsx` — Workflow node component
- `src/components/right-panel/analytics-tab.tsx` — Analytics tab
- `src/components/shared/token-counter.tsx` — Token counter component
- `src/components/shared/profile-badge.tsx` — Profile badge

**SessionTab:**
- Active skills list
- MCP servers status
- Quick enable/disable

**WorkflowTab:**
- DAG visualization using React Flow
- Step status indicators
- Step details panel
- Start/pause/stop controls

**AnalyticsTab:**
- Token usage chart
- Cost breakdown
- Model usage statistics
- Export functionality

**TokenCounter:**
- Current conversation tokens
- Total session tokens
- Progress bar for context window

## Acceptance Criteria

- [x] Session tab shows active skills
- [x] Session tab shows MCP servers
- [x] Workflow tab shows DAG
- [x] Workflow tab shows step status
- [x] Analytics tab shows token usage
- [x] Token counter displays correctly
- [x] Unit tests verify rendering

## Dependencies

- **Blocked by:** Layout components
- **Blocks:** Integration testing

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 2d

**Completion Note:** Right panel tabs are fully implemented. Session tab shows conversation details, profile, model, and token usage. Workflow tab displays saved workflows, active workflow progress, and a DAG visualization using React Flow. Analytics tab shows real token usage and message statistics from the database. All tabs are functional.
