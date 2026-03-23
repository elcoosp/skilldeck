---
id: define-plugin-traits-for-dependency-inversion
title: Define plugin traits for dependency inversion
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#6-chunk-3-plugin-traits-dip-interfaces
state: closed
createdAt: '2026-03-12T13:51:42.845Z'
priority: must
effort: 1d
dependencies:
  - Implement core error types and error taxonomy
---
## Context

Plugin traits enable dependency inversion, allowing the core library to be testable without external dependencies. These traits define the interfaces for model providers, MCP transports, skill loaders, and database access.

**Related Plan Section:**
- [Chunk 3: Plugin Traits (DIP Interfaces)](../plans/v1.md#6-chunk-3-plugin-traits-dip-interfaces)

**Related Architecture:**
- [ADR-001](../spec/archi.md#adr-001-three-layer-architecture-rust-core--tauri-shell--react-ui) - Core library with zero Tauri dependencies
- [ADR-004](../spec/archi.md#adr-004-plugin-trait-abstractions-for-providers-and-mcp) - Plugin trait abstractions

## Problem Statement

We need to define trait interfaces for model providers, MCP transports, skill loaders, database access, and sync backends. These traits enable mocking in tests and swapping implementations.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/skilldeck-core/src/traits/mod.rs` — Trait module
- `src-tauri/skilldeck-core/src/traits/model_provider.rs` — ModelProvider trait
- `src-tauri/skilldeck-core/src/traits/mcp_transport.rs` — McpTransport trait
- `src-tauri/skilldeck-core/src/traits/skill_loader.rs` — SkillLoader trait
- `src-tauri/skilldeck-core/src/traits/database.rs` — Database trait
- `src-tauri/skilldeck-core/src/traits/sync_backend.rs` — SyncBackend trait (v2 stub)

**ModelProvider trait:**
- `id()` — Unique identifier
- `display_name()` — Human-readable name
- `supports_toon()` — TOON format support
- `list_models()` — Available models
- `complete()` — Streaming completion
- `complete_sync()` — Non-streaming completion (default impl)

**McpTransport trait:**
- `connect()` — Establish connection
- `supports()` — Check config compatibility

**McpSession struct:**
- `call_tool()` — Execute tool
- `list_resources()` — List resources
- `read_resource()` — Read resource

**SkillLoader trait:**
- `load()` — Load skill from source
- `exists()` — Check if source exists
- `modified_at()` — Get modification time

**Database trait:**
- `connection()` — Get database connection
- `execute_raw()` — Execute raw SQL

**SyncBackend trait (v2 stub):**
- `push()` — Push local changes
- `pull()` — Pull remote changes
- `resolve_conflict()` — Resolve conflicts

## Acceptance Criteria

- [x] All traits are defined with async methods
- [x] All associated types and structs are defined (CompletionRequest, CompletionChunk, etc.)
- [x] Default implementations are provided where sensible
- [x] Unit tests verify serialization/deserialization of types
- [x] Unit tests verify trait object safety

## Testing Requirements

**Unit tests:**
- `message_role_serialization` — MessageRole serializes correctly
- `chat_message_serialization` — ChatMessage serializes correctly
- `tool_definition_schema` — ToolDefinition schema is valid
- `completion_chunk_serialization` — CompletionChunk serializes correctly
- `mcp_server_config_serialization` — McpServerConfig serializes correctly
- `mcp_tool_serialization` — McpTool serializes correctly
- `mcp_content_text` — McpContent::Text serializes correctly
- `skill_creation` — Skill::new creates valid skill
- `skill_hash_computation` — Skill hash is computed correctly
- `skill_manifest_default` — SkillManifest::default is valid
- `skill_source_serialization` — SkillSource serializes correctly
- `sea_orm_database_creation` — SeaOrmDatabase can be created
- `changeset_default` — Changeset::default is valid
- `sync_operation_serialization` — SyncOperation serializes correctly
- `no_op_sync_backend` — NoOpSyncBackend returns empty results

## Dependencies

- **Blocked by:** Core error types
- **Blocks:** Model providers, MCP client, skill system

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** All traits and associated types are implemented in the codebase. Unit tests exist for serialization and core functionality. The traits are fully defined and used throughout the system.
