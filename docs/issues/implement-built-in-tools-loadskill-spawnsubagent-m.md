---
id: implement-built-in-tools-loadskill-spawnsubagent-m
title: 'Implement built-in tools (loadSkill, spawnSubagent, mergeSubagentResults)'
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#10-chunk-7-agent-loop--tool-dispatcher
state: open
createdAt: '2026-03-12T13:56:20.458Z'
priority: should
effort: 1d
dependencies:
  - Implement skill resolver with priority ordering
---
## Context

Built-in tools are always available without approval gates. They provide core functionality like loading skills, spawning subagents, and merging results.

**Related Plan Section:**
- [Chunk 7: Agent Loop & Tool Dispatcher](../plans/v1.md#10-chunk-7-agent-loop--tool-dispatcher)

**Related Requirements:**
- [REQ-FUNC-150](../spec/srs.md#req-func-150) - Load skill by name
- [REQ-FUNC-151](../spec/srs.md#req-func-151) - No approval for loadSkill
- [REQ-FUNC-152](../spec/srs.md#req-func-152) - Error if skill not found
- [REQ-FUNC-155](../spec/srs.md#req-func-155) - Spawn subagent
- [REQ-FUNC-156](../spec/srs.md#req-func-156) - Display subagent card
- [REQ-FUNC-157](../spec/srs.md#req-func-157) - No approval for spawn
- [REQ-FUNC-160](../spec/srs.md#req-func-160) - Merge subagent results
- [REQ-FUNC-161](../spec/srs.md#req-func-161) - Individual merge controls

## Problem Statement

We need to implement the three built-in tools that the agent can call without user approval: loadSkill, spawnSubagent, and mergeSubagentResults.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/agent/built_in_tools.rs` — Built-in tool implementations

**loadSkill tool:**
- Input: `{ "name": "skill-name" }`
- Looks up skill in registry
- Injects skill content into context
- Returns: `{ "loaded": "skill-name" }`
- Error if skill not found

**spawnSubagent tool:**
- Input: `{ "task_description": "..." }`
- Creates new subagent session
- Returns: `{ "spawned": true, "session_id": "..." }`
- No approval required

**mergeSubagentResults tool:**
- Input: `{ "session_ids": ["...", "..."] }`
- Aggregates results from subagents
- Returns: `{ "merged": true, "results": [...] }`

## Acceptance Criteria

- [ ] loadSkill loads skill by name
- [ ] loadSkill returns error if not found
- [ ] spawnSubagent creates subagent session
- [ ] mergeSubagentResults aggregates results
- [ ] All built-in tools skip approval gate
- [ ] Unit tests verify each tool

## Testing Requirements

**Unit tests:**
- `load_skill_success` — Skill is loaded
- `load_skill_not_found` — Error if skill not found
- `spawn_subagent` — Subagent is spawned
- `merge_results` — Results are merged

**BDD scenarios:**
- [SC-FUNC-035](../spec/test-verification.md#sc-func-035) - loadSkill built-in tool
- [SC-FUNC-036](../spec/test-verification.md#sc-func-036) - spawnSubagent built-in tool
- [SC-FUNC-037](../spec/test-verification.md#sc-func-037) - mergeSubagentResults built-in tool

## Dependencies

- **Blocked by:** Skill registry, subagent management
- **Blocks:** Tool dispatcher

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
