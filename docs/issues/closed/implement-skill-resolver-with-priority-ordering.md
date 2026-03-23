---
id: implement-skill-resolver-with-priority-ordering
title: Implement skill resolver with priority ordering
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:small'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#8-chunk-5-skill-system
state: closed
createdAt: '2026-03-12T13:53:55.305Z'
priority: must
effort: 0.5d
dependencies:
  - Implement filesystem skill loader
---
## Context

The skill resolver handles conflicts when multiple skills with the same name exist in different source directories. It applies priority ordering: workspace > personal > superpowers > marketplace.

**Related Plan Section:**
- [Chunk 5: Skill System](../plans/v1.md#8-chunk-5-skill-system)

**Related Requirements:**
- [REQ-FUNC-045](../spec/srs.md#req-func-045) - Resolve skills by priority
- [REQ-FUNC-046](../spec/srs.md#req-func-046) - Log shadowed skills
- [BR-002](../spec/bsr.md#br-002) - Skill resolution priority

**Related Architecture:**
- [ADR-007](../spec/archi.md#adr-007-skill-priority-resolution-order) - Skill priority resolution order

## Problem Statement

We need to implement the skill resolver that takes skills from multiple sources, resolves conflicts by priority, and logs shadowed skills for transparency.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/skills/resolver.rs` — SkillResolver implementation

**Priority order:**
1. workspace (highest)
2. personal
3. superpowers
4. marketplace (lowest)

**Key functions:**
- `resolve(sources)` — Takes Vec<(String, Vec<Skill>)> and returns ResolvedSkills
- Returns selected skills and list of shadowed skills

**ShadowedSkill struct:**
- `name` — Skill name
- `source` — Source that was shadowed
- `shadowed_by` — Source that took precedence

## Acceptance Criteria

- [x] Resolves skills by priority order
- [x] Returns selected skills
- [x] Returns shadowed skills with details
- [x] Logs shadowed skills for transparency
- [x] Handles multiple skills with no conflict
- [x] Unit tests verify priority order
- [x] Unit tests verify shadow detection

## Testing Requirements

**Unit tests:**
- [x] `single_source` — Single source returns all skills
- [x] `workspace_overrides_personal` — Workspace skill shadows personal
- [x] `multiple_skills_no_conflict` — Different names don't conflict
- [x] `priority_order` — All four levels resolve correctly

**BDD scenarios:**
- [x] [SC-FUNC-012](../spec/test-verification.md#sc-func-012) - Skill priority resolution

## Dependencies

- **Blocked by:** Skill loader
- **Blocks:** Skill registry

## Effort Estimate

- **Complexity:** Low
- **Effort:** 0.5d

**Completion Note:** Resolver is implemented with comprehensive tests.
