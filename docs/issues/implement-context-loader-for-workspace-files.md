---
id: implement-context-loader-for-workspace-files
title: Implement context loader for workspace files
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:small'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#12-chunk-9-workspace-detection
state: open
createdAt: '2026-03-12T13:59:50.853Z'
priority: must
effort: 0.5d
dependencies:
  - Implement workspace detector for project type detection
---
## Context

The context loader reads workspace context files (CLAUDE.md, README, etc.) and builds a context string for the AI.

**Related Plan Section:**
- [Chunk 9: Workspace Detection](../plans/v1.md#12-chunk-9-workspace-detection)

**Related Requirements:**
- [REQ-FUNC-121](../spec/srs.md#req-func-121) - Load context files
- [REQ-FUNC-122](../spec/srs.md#req-func-122) - Load workspace skills

## Problem Statement

We need to implement the context loader that reads context files, handles missing files gracefully, and builds a context string for injection into the system prompt.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/workspace/context.rs` — ContextLoader implementation

**ContextFile struct:**
- `name` — File name
- `path` — File path
- `content` — File content
- `priority` — Loading priority

**WorkspaceContext struct:**
- `root` — Workspace root path
- `project_type` — Detected project type
- `context_files` — Loaded context files
- `skill_directory` — Optional skill directory path
- `is_git_repo` — Whether it's a git repository
- `gitignore_patterns` — Gitignore patterns

**ContextLoader:**
- `load(root)` — Load workspace context
- `load_context_files(root, project_type)` — Load context files
- `find_skill_directory(root)` — Find skill directory
- `load_gitignore(root)` — Load gitignore patterns
- `build_context_string(context)` — Build context string

## Acceptance Criteria

- [ ] Loads CLAUDE.md if present
- [ ] Loads README.md if present
- [ ] Loads .gitignore if present
- [ ] Loads project-specific files
- [ ] Handles missing files gracefully
- [ ] Finds skill directory
- [ ] Detects git repository
- [ ] Builds context string
- [ ] Unit tests verify file loading
- [ ] Integration tests verify context building

## Testing Requirements

**Unit tests:**
- `load_context` — Context files loaded
- `detect_git` — Git repository detected
- `load_gitignore` — Gitignore patterns loaded
- `build_context_string` — Context string built

**BDD scenarios:**
- [SC-FUNC-029](../spec/test-verification.md#sc-func-029) - Workspace detection

## Dependencies

- **Blocked by:** Workspace detector
- **Blocks:** Workspace management

## Effort Estimate

- **Complexity:** Low
- **Effort:** 0.5d
