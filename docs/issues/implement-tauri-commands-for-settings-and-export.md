---
id: implement-tauri-commands-for-settings-and-export
title: Implement Tauri commands for settings and export
labels:
  - backend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#13-chunk-10-tauri-shell--commands--events
state: closed
createdAt: '2026-03-12T13:59:50.857Z'
priority: must
effort: 1d
dependencies:
  - Implement Tauri state management and initialization
---
## Context

Additional Tauri commands are needed for settings management (API keys) and conversation export.

**Related Plan Section:**
- [Chunk 10: Tauri Shell — Commands & Events](../plans/v1.md#13-chunk-10-tauri-shell--commands--events)

**Related Requirements:**
- [REQ-FUNC-110](../spec/srs.md#req-func-110) - Store key in OS keychain
- [REQ-FUNC-111](../spec/srs.md#req-func-111) - Retrieve key at runtime
- [REQ-FUNC-130](../spec/srs.md#req-func-130) - Export as Markdown
- [REQ-FUNC-131](../spec/srs.md#req-func-131) - Export as JSON

## Problem Statement

We need to implement Tauri commands for API key management (via OS keychain) and conversation export.

## Solution Approach

### Implementation Details

**Files to create:**
- `src-tauri/src/commands/settings.rs` — Settings commands
- `src-tauri/src/commands/export.rs` — Export commands
- `src-tauri/src/credentials.rs` — Keychain integration

**Settings commands:**
- `list_api_keys()` — List API key status
- `set_api_key(provider, key)` — Store API key
- `delete_api_key(provider)` — Delete API key
- `validate_api_key(provider, key)` — Validate API key

**Export commands:**
- `export_conversation(id, format, path)` — Export conversation
- `export_conversations(ids, format, path)` — Export multiple conversations

**Keychain integration:**
- Use `tauri-plugin-keyring` for OS keychain access
- Store keys with service name "skilldeck-{provider}"
- Never store keys in database or config files

## Acceptance Criteria

- [x] API keys are stored in OS keychain
- [x] API keys are retrieved at runtime
- [x] API keys are deleted from keychain
- [x] Conversations export as Markdown
- [x] Conversations export as JSON
- [ ] Multiple conversations export as zip
- [x] Export errors are handled

## Dependencies

- **Blocked by:** Tauri state management
- **Blocks:** Frontend development

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d

**Completion Note:** Settings and export commands are fully implemented in `src-tauri/src/commands/settings.rs` and `export.rs`. Keychain integration uses `tauri-plugin-keyring`. Multiple conversation export is not yet implemented.
