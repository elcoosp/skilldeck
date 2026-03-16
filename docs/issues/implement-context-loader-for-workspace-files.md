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
state: closed
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
- `skill_directories` — Discovered skill directories
- `is_git_repo` — Whether it's a git repository
- `gitignore_patterns` — Gitignore patterns

**ContextLoader:**
- `load(root)` — Load workspace context
- `load_context_files(root, project_type)` — Load context files
- `find_skill_directories(root)` — Find skill directories
- `load_gitignore(root)` — Load gitignore patterns
- `build_context_string(context)` — Build context string

## Acceptance Criteria

- [x] Loads CLAUDE.md if present
- [x] Loads README.md if present
- [x] Loads .gitignore if present
- [x] Loads project-specific files
- [x] Handles missing files gracefully
- [x] Finds skill directories
- [x] Detects git repository
- [x] Builds context string
- [x] Unit tests verify file loading
- [x] Integration tests verify context building (some tests exist)

## Testing Requirements

**Unit tests:**
- [x] `load_context` — Context files loaded
- [x] `detect_git` — Git repository detected
- [x] `load_gitignore` — Gitignore patterns loaded
- [x] `build_context_string` — Context string built

**BDD scenarios:**
- [x] [SC-FUNC-029](../spec/test-verification.md#sc-func-029) - Workspace detection

## Dependencies

- **Blocked by:** Workspace detector
- **Blocks:** Workspace management

## Effort Estimate

- **Complexity:** Low
- **Effort:** 0.5d

**Completion Note:** Fully implemented with tests. One minor issue: uses sync `std::fs::read_dir` in `has_dotnet_project_file` inside detector, but context loader itself is async.
