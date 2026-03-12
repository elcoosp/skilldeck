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
state: open
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

- [ ] Parses valid SKILL.md files correctly
- [ ] Extracts name, description, triggers from frontmatter
- [ ] Computes content hash for change detection
- [ ] Returns error for missing frontmatter
- [ ] Returns error for invalid YAML
- [ ] Returns error for missing name field
- [ ] Handles BOM in file content
- [ ] Unit tests verify parsing
- [ ] Unit tests verify hash computation
- [ ] Integration tests verify file loading

## Testing Requirements

**Unit tests:**
- `parse_valid_skill` — Valid SKILL.md parses correctly
- `parse_missing_frontmatter` — Missing frontmatter returns error
- `parse_missing_name` — Missing name returns error
- `parse_invalid_yaml` — Invalid YAML returns error
- `load_from_filesystem` — Load from filesystem works
- `load_nonexistent` — Nonexistent skill returns error
- `skill_hash_computation` — Hash is computed correctly

**BDD scenarios:**
- [SC-FUNC-010](../spec/test-verification.md#sc-func-010) - Discover skills from filesystem
- [SC-FUNC-011](../spec/test-verification.md#sc-func-011) - Symlink safety

## Dependencies

- **Blocked by:** Plugin traits (SkillLoader trait)
- **Blocks:** Skill resolver, skill watcher

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
