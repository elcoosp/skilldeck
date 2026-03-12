---
id: implement-skill-scanner-for-directory-traversal
title: Implement skill scanner for directory traversal
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:small'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#8-chunk-5-skill-system
state: open
createdAt: '2026-03-12T13:53:55.307Z'
priority: must
effort: 0.5d
dependencies:
  - Implement filesystem skill loader
---
## Context

The skill scanner traverses skill source directories to discover all SKILL.md files. It must handle symlink skipping for security and provide efficient directory traversal.

**Related Plan Section:**
- [Chunk 5: Skill System](../plans/v1.md#8-chunk-5-skill-system)

**Related Requirements:**
- [REQ-FUNC-040](../spec/srs.md#req-func-040) - Scan skill directories on startup
- [REQ-FUNC-043](../spec/srs.md#req-func-043) - Skip symlinked skill directories
- [REQ-SEC-004](../spec/srs.md#req-sec-004) - Symlink skip

## Problem Statement

We need to implement the skill scanner that traverses configured skill source directories, discovers SKILL.md files, and skips symlinks for security.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/skills/scanner.rs` — SkillScanner implementation

**Key features:**
- Recursive directory traversal
- Symlink detection and skipping
- Returns list of discovered skill paths
- Efficient glob-based scanning

**Security:**
- Skip symlinks pointing outside allowed directories
- Log warning when symlink is skipped
- No directory traversal attacks

## Acceptance Criteria

- [ ] Scans configured directories recursively
- [ ] Discovers all SKILL.md files
- [ ] Skips symlinks with warning
- [ ] Returns list of skill paths
- [ ] Integration tests verify symlink skipping

## Testing Requirements

**Integration tests:**
- `scanner_discovers_skills` — Skills are discovered
- `scanner_skips_symlinks` — Symlinks are skipped

**Security tests:**
- `symlink_skill_directory_is_skipped` — Symlink outside workspace is skipped

## Dependencies

- **Blocked by:** Skill loader
- **Blocks:** Skill registry

## Effort Estimate

- **Complexity:** Low
- **Effort:** 0.5d
