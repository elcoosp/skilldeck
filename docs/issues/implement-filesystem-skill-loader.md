---
id: implement-filesystem-skill-loader
title: Implement filesystem skill loader
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#8-chunk-5-skill-system
state: closed
createdAt: '2026-03-12T13:53:55.304Z'
priority: must
effort: 1d
dependencies:
  - Define plugin traits for dependency inversion
---
## Context

The skill loader is responsible for parsing SKILL.md files with YAML frontmatter. It validates the skill format, extracts metadata, and computes content hashes for change detection.

**Related Plan Section:**
- [Chunk 5: Skill System](../plans/v1.md#8-chunk-5-skill-system)

**Related Requirements:**
- [REQ-FUNC-040](../spec/srs.md#req-func-040) - Scan skill directories on startup
- [REQ-FUNC-041](../spec/srs.md#req-func-041) - Parse SKILL.md frontmatter
- [REQ-FUNC-042](../spec/srs.md#req-func-042) - Skip malformed SKILL.md
- [REQ-FUNC-043](../spec/srs.md#req-func-043) - Skip symlinked skill directories

**Related Architecture:**
- [ADR-007](../spec/archi.md#adr-007-skill-priority-resolution-order) - Skill priority resolution

## Problem Statement

We need to implement the FilesystemSkillLoader that parses SKILL.md files, validates YAML frontmatter, extracts skill metadata, and computes content hashes.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/skills/mod.rs` — Skill module
- `src-tauri/skilldeck-core/src/skills/loader.rs` — FilesystemSkillLoader implementation

**Skill format:**
```markdown
---
name: skill-name
description: Brief description
triggers:
  - optional-trigger-keywords
---
# Skill Title

Skill content in Markdown format.
```

**Key functions:**
- `parse(content, path, source)` — Parse SKILL.md content
- `load(source)` — Load from SkillSource enum
- `exists(source)` — Check if source exists
- `modified_at(source)` — Get modification time
- `compute_hash()` — Compute SHA-256 hash of content

**Error handling:**
- Missing frontmatter delimiter → SkillParse error
- Invalid YAML → SkillParse error
- Missing name field → SkillParse error
- Symlink detection → skip with warning

## Acceptance Criteria

- [x] Parses valid SKILL.md files correctly
- [x] Extracts name, description, triggers from frontmatter
- [x] Computes content hash for change detection
- [x] Returns error for missing frontmatter
- [x] Returns error for invalid YAML
- [x] Returns error for missing name field
- [x] Handles BOM in file content
- [x] Unit tests verify parsing
- [x] Unit tests verify hash computation
- [x] Integration tests verify file loading

## Testing Requirements

**Unit tests:**
- [x] `parse_valid_skill` — Valid SKILL.md parses correctly
- [x] `parse_missing_frontmatter` — Missing frontmatter returns error
- [x] `parse_missing_name` — Missing name returns error
- [x] `parse_invalid_yaml` — Invalid YAML returns error
- [x] `load_from_filesystem` — Load from filesystem works
- [x] `load_nonexistent` — Nonexistent skill returns error
- [x] `skill_hash_computation` — Hash is computed correctly

**BDD scenarios:**
- [x] [SC-FUNC-010](../spec/test-verification.md#sc-func-010) - Discover skills from filesystem
- [x] [SC-FUNC-011](../spec/test-verification.md#sc-func-011) - Symlink safety

## Dependencies

- **Blocked by:** Plugin traits (SkillLoader trait)
- **Blocks:** Skill resolver, skill watcher

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** Fully implemented with tests. One minor issue: `name` extraction from manifest could be more robust, but works.
