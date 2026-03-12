---
id: implement-skill-watcher-for-hot-reload
title: Implement skill watcher for hot reload
labels:
  - backend
  - 'priority:should'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#8-chunk-5-skill-system
state: open
createdAt: '2026-03-12T13:53:55.306Z'
priority: should
effort: 1d
dependencies:
  - Implement filesystem skill loader
---
## Context

The skill watcher monitors skill directories for changes and triggers hot reload when SKILL.md files are created, modified, or deleted. This enables real-time skill updates without restarting the application.

**Related Plan Section:**
- [Chunk 5: Skill System](../plans/v1.md#8-chunk-5-skill-system)

**Related Requirements:**
- [REQ-FUNC-050](../spec/srs.md#req-func-050) - Detect skill changes within 200ms
- [REQ-FUNC-051](../spec/srs.md#req-func-051) - Reload modified skill
- [REQ-FUNC-052](../spec/srs.md#req-func-052) - Remove deleted skill

## Problem Statement

We need to implement the skill watcher that monitors skill directories using the `notify` crate, debounces events, and emits events for skill lifecycle changes.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/skills/watcher.rs` — SkillWatcher implementation

**Key features:**
- Uses `notify` crate for filesystem watching
- 200ms debounce to coalesce multiple events
- Only watches SKILL.md files
- Emits SkillWatchEvent enum: Created, Modified, Deleted
- Recursive watching for skill directories

**SkillWatchEvent enum:**
- `Created(PathBuf)` — New skill detected
- `Modified(PathBuf)` — Skill file changed
- `Deleted(PathBuf)` — Skill file removed

**Implementation:**
- `start_watcher(dir, tx)` — Start watching a directory
- Returns watcher handle
- Sends events to channel

## Acceptance Criteria

- [ ] Detects new SKILL.md files within 200ms
- [ ] Detects modified SKILL.md files within 200ms
- [ ] Detects deleted SKILL.md files within 200ms
- [ ] Ignores non-SKILL.md files
- [ ] Works with recursive directory watching
- [ ] Integration tests verify hot reload

## Testing Requirements

**Integration tests:**
- `watcher_detects_new_skill` — New skill is detected
- `watcher_detects_modified_skill` — Modified skill is detected
- `watcher_detects_deleted_skill` — Deleted skill is detected

**BDD scenarios:**
- [SC-FUNC-013](../spec/test-verification.md#sc-func-013) - Skill hot reload

## Dependencies

- **Blocked by:** Skill loader
- **Blocks:** Skill registry

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
