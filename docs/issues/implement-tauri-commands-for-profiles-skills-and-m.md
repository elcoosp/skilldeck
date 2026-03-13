---
id: implement-tauri-commands-for-profiles-skills-and-m
title: 'Implement Tauri commands for profiles, skills, and MCP'
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#13-chunk-10-tauri-shell--commands--events
state: open
createdAt: '2026-03-12T13:59:50.856Z'
priority: must
effort: 1d
dependencies:
  - Implement Tauri state management and initialization
---
## Context

Additional Tauri commands are needed for managing profiles, skills, and MCP servers.

**Related Plan Section:**
- [Chunk 10: Tauri Shell — Commands & Events](../plans/v1.md#13-chunk-10-tauri-shell--commands--events)

**Related Requirements:**
- [REQ-FUNC-105](../spec/srs.md#req-func-105) - Create profile
- [REQ-FUNC-106](../spec/srs.md#req-func-106) - Switch active profile
- [REQ-FUNC-040](../spec/srs.md#req-func-040) - Scan skill directories
- [REQ-FUNC-065](../spec/srs.md#req-func-065) - Connect to MCP server

## Problem Statement

We need to implement Tauri commands for profile management, skill management, and MCP server management.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/src/commands/profiles.rs` — Profile commands
- `src-tauri/src/commands/skills.rs` — Skill commands
- `src-tauri/src/commands/mcp.rs` — MCP commands

**Profile commands:**
- `list_profiles()` — List all profiles
- `get_profile(id)` — Get single profile
- `create_profile(name, model_provider, model_id)` — Create profile
- `update_profile(id, updates)` — Update profile
- `delete_profile(id)` — Delete profile
- `set_default_profile(id)` — Set default profile

**Skill commands:**
- `list_skills(source?)` — List skills
- `get_skill(name)` — Get skill details
- `toggle_skill(name, enabled)` — Enable/disable skill
- `reload_skills()` — Reload all skills

**MCP commands:**
- `list_mcp_servers()` — List MCP servers
- `connect_mcp_server(id)` — Connect to server
- `disconnect_mcp_server(id)` — Disconnect from server
- `get_mcp_tools(server_id)` — Get server tools
- `call_mcp_tool(server_name, tool_name, arguments)` — Execute tool

## Acceptance Criteria

- [ ] All profile commands work
- [ ] All skill commands work
- [ ] All MCP commands work
- [ ] Errors are handled gracefully
- [ ] Commands are type-safe

## Dependencies

- **Blocked by:** Tauri state management
- **Blocks:** Frontend development

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** No Tauri commands present.
