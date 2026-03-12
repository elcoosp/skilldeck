---
id: implement-database-layer-with-sqlite-and-seaorm
title: Implement database layer with SQLite and SeaORM
labels:
  - backend
  - database
  - 'priority:must'
  - 'type:feature'
  - 'size:large'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#5-chunk-2-database-layer
state: open
createdAt: '2026-03-12T13:51:42.844Z'
priority: must
effort: 2d
dependencies:
  - Implement core error types and error taxonomy
---
## Context

The database layer is the foundation for all persistent storage in SkillDeck. Using SQLite with WAL mode ensures crash recovery without data loss (REQ-REL-001, REQ-REL-002). SeaORM provides type-safe queries and migrations.

**Related Plan Section:**
- [Chunk 2: Database Layer](../plans/v1.md#5-chunk-2-database-layer)

**Related Requirements:**
- [REQ-REL-001](../spec/srs.md#req-rel-001) - No data loss on crash
- [REQ-REL-002](../spec/srs.md#req-rel-002) - SQLite WAL mode
- [REQ-CON-003](../spec/srs.md#req-con-003) - SQLite with WAL mode

**Related Architecture:**
- [ASR-REL-001](../spec/archi.md#asr-rel-001) - No data loss on crash
- [ASR-REL-002](../spec/archi.md#asr-rel-002) - MCP supervision

## Problem Statement

We need to implement the database connection management with SQLite WAL mode, create the initial migration with all 35 tables, and provide utility functions for database operations.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/db/mod.rs` — Database module
- `src-tauri/skilldeck-core/src/db/connection.rs` — Connection management
- `src-tauri/skilldeck-core/src/db/migrations/mod.rs` — Migration module
- `src-tauri/skilldeck-core/src/db/migrations/m20250115_000001_initial.rs` — Initial migration (35 tables)

**Database configuration:**
- WAL mode for concurrent reads
- Foreign keys enabled
- Busy timeout of 5000ms
- Synchronous mode NORMAL for performance

**Tables to create (35 total):**
1. Core: profiles, conversations, messages, tool_call_events, conversation_branches
2. Profile config: profile_mcps, profile_skills, conversation_mcp_overrides, conversation_skill_overrides, conversation_model_override
3. MCP: mcp_servers, mcp_tool_cache
4. Skills: skills, skill_source_dirs
5. Workflow: subagent_sessions, workflow_executions, workflow_steps
6. Workspace: workspaces
7. Artifacts: artifacts, templates
8. Organization: folders, tags, conversation_tags, attachments
9. Prompts: prompts, prompt_variables
10. Analytics: usage_events, model_pricing
11. UI state: workspace_state, conversation_ui_state, bookmarks
12. Export: export_jobs, message_embeddings
13. Sync (v2 stub): sync_state, sync_watermarks

**Seed data:**
- Default profile
- Default skill source directories
- Model pricing data

## Acceptance Criteria

- [ ] Database opens successfully with `:memory:` option
- [ ] All 35 tables are created with correct schema
- [ ] Foreign key constraints are properly defined
- [ ] WAL mode is enabled and verified
- [ ] Integrity check passes
- [ ] Database statistics can be retrieved
- [ ] Migrations can be run on startup
- [ ] Seed data is inserted correctly

## Testing Requirements

**Unit tests:**
- `db_opens_in_memory` — Database opens with in-memory mode
- `db_migration_runs` — Initial migration creates all tables
- `db_integrity_check` — Integrity check passes
- `db_stats` — Statistics can be retrieved
- `wal_mode_enabled` — WAL mode is verified

## Dependencies

- **Blocked by:** Core error types
- **Blocks:** All entities, repositories

## Effort Estimate

- **Complexity:** High
- **Effort:** 2d
