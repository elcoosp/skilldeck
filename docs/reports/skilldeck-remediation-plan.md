# SkillDeck — Codebase Remediation Plan

> **Audit Date:** April 2026  
> **Codebase:** `elcoosp/skilldeck` — Tauri + React + Rust (skilldeck-core)  
> **Scope:** Full codebase review for vaporware, semi-implementations, dead stubs, and broken wiring

---

## Executive Summary

The codebase is architecturally sound and has excellent bones — real DB models, real Tauri commands, real Rust core logic. But roughly **7 feature areas** are either entirely vaporware (UI wired to a non-existent or stub backend), semi-implemented (backend works but frontend is disconnected or vice-versa), or have hard-coded workarounds that indicate incomplete integration. These are not cosmetic issues; several would fail at first user contact.

---

## Severity Classification

| Level | Meaning |
|---|---|
| 🔴 **Critical** | Crashes, broken contract, feature appears available but silently fails |
| 🟠 **Major** | Feature is partially wired but produces wrong output or is never triggered |
| 🟡 **Minor** | Feature works but is fragile, poorly wired, or carries obvious tech debt |

---

## Finding 1 — `toon.rs` is a One-Line Stub

**Severity:** 🟠 Major  
**Files:** `src-tauri/skilldeck-core/src/toon.rs`, `src-tauri/src/subagent_server.rs` (`tools_toon` field)

### Evidence

```rust
// src-tauri/skilldeck-core/src/toon.rs
//! TOON encoder — stub for future chunk.
```

The file body is empty. Yet `tools_toon: None` is passed throughout `CompletionRequest` in `context_builder.rs`, `subagent_server.rs`, and everywhere a request is constructed. This field exists in the type but is never populated or consumed anywhere functional.

### Impact

Any feature gating on `tools_toon` silently becomes a no-op. The ADK subagent adapter also sets `tools_toon: None` explicitly, meaning tool-use through the subagent pathway is partially neutered by default.

### Remediation

```
1. Decide: implement TOON encoding or remove the field.
   - If removing: delete toon.rs, remove tools_toon from CompletionRequest and all callsites (~8 occurrences).
   - If implementing: write the encoder and populate the field in context_builder.rs before the provider call.
2. Add a compile-time lint or TODO tracker so this does not silently persist.
```

---

## Finding 2 — Workflow UI Has No Route / Entry Point

**Severity:** 🔴 Critical  
**Files:** `src/components/workflow/workflow-editor.tsx`, `src/components/workflow/workflow-graph.tsx`, `src/hooks/use-workflow-definitions.ts`, `src/hooks/use-workflow-events.ts`

### Evidence

Both workflow components exist and are well-implemented. The hooks use `(commands as any).listWorkflowDefinitions()` and `(commands as any).saveWorkflowDefinition()` — the `as any` cast is a strong signal that at the time of writing the Tauri bindings were either not generated or not typed. There is **no route** in `src/routes/` that renders either `WorkflowEditor` or `WorkflowGraph`. Searching the route tree:

```
src/routes/_app/
  conversations.$conversationId.tsx
  index.tsx
  settings.achievements.tsx
  settings.api-keys.tsx
  ...
  (no settings.workflows.tsx or workflows.tsx)
```

The backend (`src-tauri/src/commands/workflows.rs`) is fully implemented — CRUD and `run_workflow_definition` all work. The `run_workflow_definition` command hard-codes `provider_id = "ollama"` as a fallback, which will silently fail for Claude-only users.

### Remediation

```
1. Generate/regenerate Tauri bindings so workflow commands are typed; remove all `(commands as any)` casts in use-workflow-definitions.ts.
2. Create src/routes/_app/settings.workflows.tsx (or a dedicated /workflows route).
3. Add "Workflows" to the settings nav or left-panel tab list.
4. Fix run_workflow_definition to use the active profile's provider rather than hard-coded "ollama":
   - Accept an optional provider_id param, or
   - Read from AppState.active_profile.
5. Wire WorkflowGraph into the route so users can see live step progress via useWorkflowEvents.
```

---

## Finding 3 — `workflow/sequential.rs` is a Binary/Corrupt File

**Severity:** 🔴 Critical  
**File:** `src-tauri/skilldeck-core/src/workflow/sequential.rs`

### Evidence

The file appears twice in the dump and both times is flagged as `[Binary file]`. The `parallel.rs` executor imports from it:

```rust
use super::sequential::{StepExecutionContext, run_step_with_agent_pub};
```

These two symbols are the core execution primitives used by parallel execution. If this file is genuinely binary/corrupt in the repo, parallel execution will fail to compile.

### Remediation

```
1. Verify the file on disk: `file src-tauri/skilldeck-core/src/workflow/sequential.rs`
2. If corrupt: restore from git history or rewrite based on what parallel.rs imports:
   - StepExecutionContext: a struct holding provider, model_id, skill_registry refs
   - run_step_with_agent_pub: async fn(prompt, skill, ctx) -> Result<String, CoreError>
3. Add a CI check that `cargo check` runs on the core crate in isolation.
```

---

## Finding 4 — Achievements Are Stored in `localStorage` (Not the DB)

**Severity:** 🟠 Major  
**Files:** `src/hooks/use-achievements.ts`, `src/lib/achievements.ts`, `src/__tests__/hooks/use-achievements.test.ts`

### Evidence

```ts
// use-achievements.ts
const STORAGE_KEY = 'skilldeck-achievements'

const getUnlocked = useCallback((): AchievementId[] => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}, [])
```

The achievement system is entirely client-side in `localStorage`. This means:
- Achievements are lost on app data directory wipe / profile change.
- No cross-device persistence even when platform sync is enabled.
- The `AchievementsTab` displays state, but the unlock trigger (called from `use-messages.ts` on send) works fine — the issue is purely persistence layer.

There is a `skilldeck_models` crate but no `achievements` model in it. The DB has no achievements table in the migration files visible in the audit.

### Remediation

**Option A (quick fix — low effort):** Move to Tauri's `store` plugin (persisted JSON file alongside the DB, survives app updates). Add a migration from localStorage on first launch.

**Option B (full fix — recommended):** Add an `achievements` table to skilldeck-models, create a migration, add `unlock_achievement` / `list_achievements` Tauri commands, and update the hook to call them. This unlocks future server-side analytics on achievement rates.

```
Either way:
1. Add a migration guard: on app start, read localStorage achievements and write to new store.
2. Update useAchievements to use the new persistence layer.
3. Update the test in use-achievements.test.ts — it currently mocks localStorage directly.
```

---

## Finding 5 — Referral & Platform Features Gate on a Server That May Not Exist

**Severity:** 🟠 Major  
**Files:** `src/components/settings/referral-tab.tsx`, `src/hooks/use-platform.ts`, `src-tauri/src/platform_client.rs`, `src-tauri/src/nudge_poller.rs`

### Evidence

The referral system, nudge poller, skill sync, conversation sharing, GDPR export, and account deletion all call a `PLATFORM_BASE_URL` / `platformUrl`. The platform client is fully implemented and the Tauri commands are wired. However:

1. `get_platform_preferences` returns `Ok(...)` from DB but the DB row only exists **after** `ensure_platform_registration` has been called. The first query will return `Err("Platform preferences not initialized")`. The frontend handles this with `isPlatformNotConfigured()`, but the referral tab will render a loading spinner indefinitely (it calls `stats.data` without checking for the init error).

2. `run_workflow_definition` hard-codes `provider_id = "ollama"` — if a user is platform-connected but using Claude, workflow runs fail silently.

3. `get_platform_preferences` returns `email: None` always — the email field is stored server-side, not in the local DB, and the sync path is not triggered on preference load.

4. The `referral-tab` renders `stats.data.rewards_earned` which will be `undefined` if the platform is not configured, rendering `NaN` in the stats grid.

### Remediation

```
1. In get_platform_preferences: return a typed "not configured" result rather than Err string, so the frontend can distinguish "not registered" from "network error".
2. In referral-tab: add an isError guard before accessing stats.data fields. Render a "Platform not connected" CTA instead of undefined/NaN.
3. Add email sync: on get_platform_preferences, if platform is configured, fetch /me from the platform API and merge email + email_verified into the response.
4. Document the expected platform API contract (OpenAPI or Rust types) so frontend and backend stay in sync.
```

---

## Finding 6 — Conversation Sharing / Sync is Fully Implemented Backend but Zero UI

**Severity:** 🟠 Major  
**Files:** `src-tauri/src/commands/platform.rs` (`share_conversation`, `sync_conversation_to_platform`, `get_shared_conversation`, `check_sync_status`), `src/routes/_app/shared.$shareToken.tsx`

### Evidence

`share_conversation`, `sync_conversation_to_platform`, `check_sync_status`, and `get_shared_conversation` are all fully implemented Tauri commands. A route `shared.$shareToken.tsx` exists. But:

- There is no "Share" button anywhere in the conversation UI (`message-thread.tsx`, `conversation-item.tsx`, `left-panel.tsx`) that calls `share_conversation`.
- `shared.$shareToken.tsx` presumably renders a shared conversation but the route is only reachable if someone navigates to it directly — there is no way for the current user to generate a share link through the UI.
- `sync_conversation_to_platform` is never called from any hook or component.

### Remediation

```
1. Add a "Share" action to the conversation context menu (right-click or ... menu in left-panel.tsx / conversation-item.tsx).
2. On click: call share_conversation → display the returned share URL in a copy dialog (reuse the pattern from ShareSkillModal).
3. Emit a sendActivityEvent('conversation_shared') call after success.
4. Decide if sync_conversation_to_platform is auto-sync or manual — implement accordingly.
5. Verify shared.$shareToken.tsx renders correctly for unauthenticated viewers (it may need to bypass the platform registration requirement).
```

---

## Finding 7 — `export_gdpr_data` and `delete_platform_account` Have No UI

**Severity:** 🟡 Minor  
**Files:** `src-tauri/src/commands/platform.rs`, `src/components/settings/platform-tab.tsx`

### Evidence

Both commands exist in the backend. The platform tab renders preferences and nudge settings but has no "Export my data" or "Delete account" section. These are legal compliance features in most jurisdictions (GDPR Art. 17 / Art. 20).

### Remediation

```
1. Add a "Data & Privacy" section to platform-tab.tsx (or a dedicated settings.privacy.tsx route).
2. Wire "Export my data" → export_gdpr_data → trigger file download via Tauri dialog.
3. Wire "Delete account" → confirmation AlertDialog → delete_platform_account → log out and reset local state.
```

---

## Finding 8 — `bookmarks.rs` Backend Has a Broken Query

**Severity:** 🔴 Critical  
**File:** `src-tauri/src/commands/bookmarks.rs`

### Evidence

```rust
// list_bookmarks
.filter(messages::COLUMN.conversation_id.eq(conv_uuid))
```

`messages::COLUMN` is not a valid Sea-ORM accessor — the correct pattern is `messages::Column::ConversationId`. This will fail to compile or produce a runtime panic depending on how the macro expands. The `toggle_bookmark` handler uses:

```rust
.filter(bookmarks::COLUMN.message_id.eq(msg_uuid))
.filter(bookmarks::COLUMN.heading_anchor.eq(heading_anchor.clone()))
```

Same problem. Additionally `add_bookmark` takes `State<'_, Arc<AppState>>` by value in `toggle_bookmark`'s internal call — this is a moved state issue that may cause a compile error.

### Remediation

```rust
// Fix all COLUMN references:
.filter(messages::Column::ConversationId.eq(conv_uuid))
.filter(bookmarks::Column::MessageId.eq(msg_uuid))
.filter(bookmarks::Column::HeadingAnchor.eq(heading_anchor.clone()))

// Fix toggle_bookmark internal call — extract the DB logic into a shared helper
// rather than calling add_bookmark(state, req) which moves `state`.
```

---

## Finding 9 — `WorkflowEditor` Resets Name on Re-open

**Severity:** 🟡 Minor  
**File:** `src/components/workflow/workflow-editor.tsx`

### Evidence

```tsx
const [name, setName] = useState('')
```

`name` is always initialized to `''` even when `initialDefinition` is passed. When editing an existing workflow, the name field will be blank and saving will overwrite the original name with an empty string.

### Remediation

```tsx
const [name, setName] = useState(initialDefinition?.name ?? '')
```

Also: `saveMutation` calls `commands.saveWorkflowDefinition` which always INSERTs a new record — there is no update path. Editing creates a duplicate rather than updating the existing workflow.

```
1. Pass the workflow ID to WorkflowEditorProps when editing.
2. Add an update_workflow_definition Tauri command that uses UPDATE rather than INSERT.
3. In the mutation, branch on whether an ID is present to call save vs. update.
```

---

## Finding 10 — Subagent Architecture Has Incomplete Result Merging

**Severity:** 🟠 Major  
**Files:** `src-tauri/src/subagent_server.rs`, `src-tauri/src/subagent_monitor.rs`, `src-tauri/skilldeck-core/src/agent/built_in_tools.rs`

### Evidence

`mergeSubagentResults` is defined as a built-in tool with a `strategy` enum (`concat`, `summarize`, `vote`). However:

1. `subagent_monitor.rs` stores the final result in a `DashMap<String, String>` but there is no code path that reads this map back to the parent agent loop to fulfil the `mergeSubagentResults` tool call.
2. `tool_dispatcher.rs` (not audited in full) would need to handle the `mergeSubagentResults` tool name and look up the results map — this wiring is not visible anywhere.
3. The `SubagentServer` spawns on a random port (`127.0.0.1:0`) but the URL is stored in the struct — there is no registry that maps `subagentId` → server URL visible in the state.

### Remediation

```
1. Add a SubagentRegistry to AppState: Arc<DashMap<String, SubagentHandle>> where
   SubagentHandle = { server_url, results_map, monitor_task }.
2. In tool_dispatcher, when the agent calls spawnSubagent:
   a. Spawn SubagentServer + build_subagent_agent
   b. Register in SubagentRegistry with the returned subagentId
   c. Spawn monitor_subagent
3. When the agent calls mergeSubagentResults(subagentId):
   a. Look up results_map[subagentId]
   b. Apply the requested strategy (concat is trivial; summarize requires another LLM call; vote requires majority logic)
   c. Return the merged result as the tool result
4. Clean up SubagentRegistry entries after merge to avoid memory leaks.
```

---

## Summary Table

| # | Feature | Status | Severity | Effort |
|---|---|---|---|---|
| 1 | `toon.rs` TOON encoder | Stub — one-liner comment, no code | 🟠 Major | S |
| 2 | Workflow UI route & bindings | Backend complete, no UI entry point | 🔴 Critical | M |
| 3 | `sequential.rs` binary/corrupt | Will not compile if truly corrupt | 🔴 Critical | M |
| 4 | Achievements persistence | localStorage only, lost on wipe | 🟠 Major | M |
| 5 | Platform/referral error states | Unguarded nulls, email never synced | 🟠 Major | S |
| 6 | Conversation sharing UI | Backend complete, zero UI trigger | 🟠 Major | S |
| 7 | GDPR export / delete account | Backend complete, no settings UI | 🟡 Minor | S |
| 8 | Bookmarks backend query | Invalid Sea-ORM column accessors | 🔴 Critical | S |
| 9 | WorkflowEditor edit mode | Always inserts, ignores name init | 🟡 Minor | S |
| 10 | Subagent result merging | Results map never read by parent | 🟠 Major | L |

**Effort key:** S = hours, M = 1–3 days, L = 1+ week

---

## Recommended Sprint Order

### Sprint 1 — Make it compile and not crash
- Fix `bookmarks.rs` column accessors (Finding 8)
- Verify / restore `sequential.rs` (Finding 3)
- Remove or stub-out `tools_toon` field (Finding 1)

### Sprint 2 — Wire existing backend to UI
- Add Workflow settings route + fix `(commands as any)` casts (Finding 2)
- Add "Share conversation" button (Finding 6)
- Add GDPR/delete UI to platform settings (Finding 7)

### Sprint 3 — Harden semi-implemented features
- Fix platform preferences null guards + email sync (Finding 5)
- Fix WorkflowEditor edit mode — update vs insert (Finding 9)
- Migrate achievements to durable storage (Finding 4)

### Sprint 4 — Complete the subagent loop
- Implement SubagentRegistry + mergeSubagentResults dispatch (Finding 10)
- Integration test: spawn → task → merge → parent continues

---

## Cross-Cutting Observations

**`(commands as any)` casts** appear in `use-workflow-definitions.ts` for all four workflow commands. This indicates the Tauri specta bindings codegen was not re-run after the workflow commands were added. Running `cargo tauri dev` or the specta export script should regenerate `lib/bindings.ts` and eliminate all four casts.

**Hard-coded `"ollama"` provider** in `run_workflow_definition` will silently fail for any user not running a local Ollama instance. This should read from `state.registry.get_active_provider()` or accept a `provider_id` argument.

**`console.log` noise in bookmarks store** — the bookmarks Zustand store has 8+ `console.log` debug statements that should be removed or converted to a structured logger before release.

**`tools_toon: None` proliferation** — this field is set to `None` in at least 5 places including the subagent adapter. If TOON encoding is a planned feature, centralise the `None` default in `CompletionRequest::default()` so it only needs to change in one place when implemented.
