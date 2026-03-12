---
id: implement-workspace-detector-for-project-type-dete
title: Implement workspace detector for project type detection
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
createdAt: '2026-03-12T13:59:50.851Z'
priority: must
effort: 0.5d
---
## Context

The workspace detector identifies project types (Rust, Node, Python, Go, Java, .NET, Generic) by looking for characteristic files. It also loads context files like CLAUDE.md and README.md.

**Related Plan Section:**
- [Chunk 9: Workspace Detection](../plans/v1.md#12-chunk-9-workspace-detection)

**Related Requirements:**
- [REQ-FUNC-120](../spec/srs.md#req-func-120) - Detect project type
- [REQ-FUNC-121](../spec/srs.md#req-func-121) - Load context files
- [REQ-FUNC-122](../spec/srs.md#req-func-122) - Load workspace skills
- [REQ-FUNC-123](../spec/srs.md#req-func-123) - Respect .gitignore

## Problem Statement

We need to implement the workspace detector that scans a directory for project type indicators and loads relevant context files.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/workspace/mod.rs` — Workspace module
- `src-tauri/skilldeck-core/src/workspace/detector.rs` — WorkspaceDetector implementation

**ProjectType enum:**
- `Rust` — Cargo.toml present
- `Node` — package.json present
- `Python` — pyproject.toml, setup.py, or requirements.txt present
- `Go` — go.mod present
- `Java` — pom.xml or build.gradle present
- `DotNet` — *.csproj, *.fsproj, or *.vbproj present
- `Generic` — No recognized project type

**WorkspaceDetector:**
- `detect(path)` — Detect project type
- `recommended_skills(project_type)` — Get recommended skills
- `context_files(project_type)` — Get typical context files

**Context files (by priority):**
1. CLAUDE.md
2. README.md
3. .gitignore
4. Project-specific files (Cargo.toml, package.json, etc.)

## Acceptance Criteria

- [ ] Detects Rust projects
- [ ] Detects Node projects
- [ ] Detects Python projects
- [ ] Detects Go projects
- [ ] Detects Java projects
- [ ] Detects .NET projects
- [ ] Falls back to Generic
- [ ] Returns recommended skills
- [ ] Returns context files
- [ ] Unit tests verify each project type

## Testing Requirements

**Unit tests:**
- `detect_rust` — Rust project detected
- `detect_node` — Node project detected
- `detect_python` — Python project detected
- `detect_generic` — Generic fallback
- `recommended_skills_rust` — Rust skills recommended
- `context_files_rust` — Rust context files returned

**BDD scenarios:**
- [SC-FUNC-029](../spec/test-verification.md#sc-func-029) - Workspace detection

## Dependencies

- **Blocked by:** None
- **Blocks:** Context loader

## Effort Estimate

- **Complexity:** Low
- **Effort:** 0.5d
