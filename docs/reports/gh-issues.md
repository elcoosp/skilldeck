I'll read the codebase snapshot to cross-reference with these issues before writing the plan.Now I have a thorough picture. Let me also quickly check the supervisor and workflow executor:Now I have a complete picture of every open item across all 14 issues. Here is the comprehensive implementation plan:

---

## Implementation Plan

This plan addresses all open items across the 14 issues, grouped by layer (Rust core → Tauri bridge → Frontend → Tests), ordered by dependency so each task unblocks the next.

---

### Layer 1 — Rust Core (`src-tauri/skilldeck-core`)

#### 1.1 — Wire cancellation token to the Tauri command layer
**Issue:** `implement-agent-loop` — cancellation token exists on `AgentLoop` but is never stored in `AppState`, so the `cancel_agent` Tauri command cannot reach it.

**Files:**
- `src-tauri/src/state.rs` — Add `agent_cancel_tokens: DashMap<String, CancellationToken>` to `AppState`
- `src-tauri/src/commands/messages.rs` — In `run_agent_loop`, call `agent.cancellation_token()`, store it in `state.agent_cancel_tokens` keyed by `conversation_id`, and remove it on loop completion
- `src-tauri/src/commands/messages.rs` — Implement the `cancel_agent(conversation_id)` Tauri command: look up the token and call `.cancel()`

---

#### 1.2 — Implement real `spawnSubagent` dispatch in ToolDispatcher
**Issue:** `implement-built-in-tools` — `spawnSubagent` returns a stub JSON. The `SubagentSpawner` trait and `SpawnerWithContext` already exist in `commands/messages.rs` but the tool dispatcher's `dispatch_builtin` returns dummy JSON.

**Files:**
- `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs` — In `dispatch_builtin`, for `"spawnSubagent"` call `self.subagent_spawner.as_ref()?.spawn_subagent(task, skills).await`, return `json!({"spawned": true, "session_id": id})`
- `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs` — For `"mergeSubagentResults"`, call `self.subagent_spawner.as_ref()?.get_subagent_result(id).await`, return the result string wrapped in `json!({"merged": true, "result": ...})`
- `src-tauri/skilldeck-core/src/traits/subagent_spawner.rs` — Extend the `SubagentSpawner` trait with `get_subagent_result(&self, id: &str) -> Option<String>`
- `src-tauri/src/commands/messages.rs` — Implement `get_subagent_result` on `SpawnerWithContext` using `state.subagent_results.get(id)`

---

#### 1.3 — Wire auto-approve config from frontend settings to `ToolDispatcher`
**Issue:** `implement-tool-dispatcher` — `AutoApproveConfig` and `set_auto_approve()` exist but are never called from the settings save path.

**Files:**
- `src-tauri/src/commands/settings.rs` — In the settings save/update command, after persisting to DB, call `state.registry.tool_dispatcher_or_per_conv.set_auto_approve(config).await`. The dispatcher is per-conversation so this needs the active dispatcher; simplest approach: store a shared `Arc<RwLock<AutoApproveConfig>>` in `AppState` that all dispatchers read on each `needs_approval` call
- `src-tauri/src/state.rs` — Add `global_auto_approve: Arc<RwLock<AutoApproveConfig>>` to `AppState`
- `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs` — Change `needs_approval` to take the config by reference, removing the internal `RwLock` copy; read from the shared state instead

---

#### 1.4 — Implement real MCP supervisor reconnection loop
**Issue:** `implement-mcp-supervisor` — `supervisor.rs` is a binary blob (the file is shown as `[Binary file]` in the snapshot), so its content must be reconstructed. The backoff state machine exists (`SupervisorConfig`, `SupervisorCommand`), but the actual reconnect call is commented out.

**Files:**
- `src-tauri/skilldeck-core/src/mcp/supervisor.rs` — In the health-check loop body, after detecting a server in `Error` or `Disconnected` state, call `registry.connect(id, config).await`. On success call `registry.stored_configs.get(&id).map(...)` to reset. On failure after `max_attempts`, call `registry.mark_failed(id)`. Emit a Tauri event (`McpEvent::ServerReconnected` or `McpEvent::ServerFailed`) via the passed `AppHandle`
- `src-tauri/src/main.rs` — Pass the `AppHandle` into `start_supervisor` so it can emit events

---

#### 1.5 — Bridge MCP events and workflow events to Tauri
**Issue:** `implement-tauri-event-definitions` — MCP supervisor events are not emitted to the frontend; workflow executor events stay in the internal channel.

**Files:**
- `src-tauri/src/events.rs` — Add `McpEvent` variants: `ServerConnected`, `ServerDisconnected`, `ServerFailed`, `ToolDiscovered`; add `WorkflowEvent` variants: `Started`, `StepStarted`, `StepCompleted`, `Completed`, `Failed`
- `src-tauri/skilldeck-core/src/mcp/supervisor.rs` — After each reconnect attempt result, emit via `app_handle.emit("mcp-event", McpEvent::...)`
- `src-tauri/src/commands/workflows.rs` — After calling `executor.execute(definition).await`, drain the workflow event receiver and re-emit each event via `app.emit("workflow-event", ...)`
- `src/lib/events.ts` — Add `onMcpEvent` and `onWorkflowEvent` listener wrappers (mirrors the existing `onAgentEvent` pattern)

---

#### 1.6 — Connect workflow steps to real agent execution
**Issue:** `implement-workflow-executor` — pattern runners use `tokio::time::sleep` placeholders instead of calling agent loops.

**Files:**
- `src-tauri/skilldeck-core/src/workflow/executor.rs` — Replace the `sleep` in `execute_step` with a call to a `StepExecutor` trait method. Define the trait: `async fn execute_step(&self, task: &str, skill_names: &[String]) -> Result<String, CoreError>`
- `src-tauri/skilldeck-core/src/traits/mod.rs` — Add `StepExecutor` trait
- `src-tauri/src/commands/workflows.rs` — Implement `StepExecutor` on a `WorkflowStepExecutorImpl` struct that holds `Arc<AppState>` and runs a full agent loop (re-using `run_agent_loop` logic), writing the result to the DB and returning the assistant response text
- `src-tauri/skilldeck-core/src/workflow/executor.rs` — Thread `Arc<dyn StepExecutor>` through `WorkflowExecutor::new` and call it in `execute_step`
- Wire into `parallel.rs` and `eval_opt.rs` the same way sequential already works

---

#### 1.7 — Wire subagent session tracking to workflow spawning
**Issue:** `implement-subagent-session-management` — `SubagentManager` tracks sessions but the workflow executor never calls it; the Tauri `AppState` has `subagent_results: DashMap<String, String>` but it's only populated by the `SpawnerWithContext`, not by the workflow executor path.

**Files:**
- `src-tauri/src/state.rs` — Expose `subagent_manager: Arc<tokio::sync::Mutex<SubagentManager>>` on `AppState`
- `src-tauri/src/commands/workflows.rs` — When `StepExecutorImpl` spawns a sub-task, also call `state.subagent_manager.lock().await.spawn(...)` and on completion call `.complete(id, result)`
- `src-tauri/skilldeck-models/src/subagent_sessions.rs` — Persist sub-agent sessions to DB via an `upsert` when status changes (start → running → completed/failed)

---

### Layer 2 — Tauri Bridge (`src-tauri/src`)

#### 2.1 — Emit MCP events on connection/disconnection
**Files:**
- `src-tauri/src/commands/mcp.rs` — After a successful `registry.connect(...)`, emit `McpEvent::ServerConnected { name }` and for each discovered tool emit `McpEvent::ToolDiscovered { server, tool }`. After `registry.disconnect(...)`, emit `McpEvent::ServerDisconnected { name }`.

---

#### 2.2 — Add `set_auto_approve_config` Tauri command
**Files:**
- `src-tauri/src/commands/settings.rs` — Add `#[tauri::command] set_auto_approve_config(state, config: AutoApproveConfigDto)` that writes to `state.global_auto_approve`
- `src/lib/bindings.ts` — Regenerate/add the binding for the new command
- `src/store/settings.ts` — Call `commands.setAutoApproveConfig(...)` whenever `setToolApprovals` is invoked

---

### Layer 3 — Frontend (`src/`)

#### 3.1 — Progressive unlock: wire `unlockStage` to feature gates
**Issue:** `implement-onboarding-wizard` — `unlockStage` exists in `ui.ts` but nothing reads it to gate features.

**Files:**
- `src/store/ui.ts` — Add helper selectors: `hasSkillsUnlocked`, `hasMcpUnlocked`, `hasWorkflowsUnlocked` (based on `unlockStage >= 1/2/3`)
- `src/hooks/use-agent-stream.ts` — On `AgentEvent::Done`, if `unlockStage === 0`, call `setUnlockStage(1)` (unlocks skills after first message)
- `src/components/layout/left-panel.tsx` / right panel — Wrap the Skills tab trigger and Workflow tab trigger with the relevant `hasX` check, showing a locked badge otherwise
- `src/components/overlays/launch-notification.tsx` — Create an `UnlockToast` component that fires a `sonner` toast when `unlockStage` increments, explaining the new feature. Call it from the `useEffect` that watches `unlockStage`

---

#### 3.2 — Real-time token counter in right panel
**Issue:** `implement-right-panel-tabs` — token counter component is missing; analytics tab uses mock data.

**Files:**
- `src/components/layout/right-panel.tsx` — Add a `TokenCounter` sub-component in the `SessionTab` that reads from `useAgentStream` for the active conversation's in-flight `input_tokens`/`output_tokens` (emitted on `Done`), accumulated per-session in a `Map<conversationId, {input, output}>` held in a new `useSessionStats` hook
- `src/hooks/use-session-stats.ts` — Create this hook: subscribes to `AgentEvent::Done` events and accumulates token counts per conversation in `useRef`
- `src/components/layout/right-panel.tsx` (`AnalyticsTab`) — Replace mock data with real data from `useAnalytics()` which already calls `commands.getAnalytics()`. The backend command (`src-tauri/src/commands/analytics.rs`) already has `SUM(input_tokens)` queries; confirm it returns non-zero by ensuring the DB persistence step (Issue 4 from the previous plan) is complete first.

---

#### 3.3 — Workflow DAG visualization using React Flow
**Issue:** `implement-right-panel-tabs` — workflow tab is a placeholder.

**Files:**
- `package.json` — Add `@xyflow/react` dependency
- `src/components/workflow/workflow-editor.tsx` — Replace placeholder with a `<ReactFlow>` instance. Build nodes/edges from `useWorkflowDefinitions()` data: each `WorkflowStep` becomes a node, each `depends_on` edge becomes a directed edge. Style nodes by step status using `useWorkflowEvents()` state
- `src/hooks/use-workflow-events.ts` — Already exists; ensure it updates step status on `WorkflowEvent::StepStarted` / `StepCompleted` / `Failed`

---

#### 3.4 — Subscribe to MCP events in frontend
**Files:**
- `src/hooks/use-mcp-events.ts` — Extend to handle `McpEvent::ServerConnected/Disconnected/Failed/ToolDiscovered`; on each event, call `queryClient.invalidateQueries(['mcp_servers'])` so the MCP tab updates live
- `src/components/layout/left-panel.tsx` — Ensure `useMcpEvents()` is called at app root (already done via `GlobalEventListeners` in `App.tsx`)

---

### Layer 4 — Tests

#### 4.1 — Integration tests for agent loop
**Issue:** `write-integration-tests` — agent loop integration tests are stubs.

**Files:** `src-tauri/skilldeck-core/tests/integration/agent_loop_tests.rs`

Tests to add (using `MockProvider` with canned token/tool responses):
- `agent_loop_processes_message` — mock provider returns two token chunks + Done; assert `new_messages` contains one assistant message and both token events were received
- `agent_loop_handles_tool_call` — mock provider returns a `ToolCall` chunk then Done after the tool result; assert the tool was dispatched and a tool-result message was appended
- `agent_loop_cancellation` — spawn the loop, immediately cancel the token; assert it returns `CoreError::Cancelled`
- `agent_loop_max_tool_iterations` — mock always returns a tool call; assert loop exits after `max_tool_iterations` with no panic

Add a `MockProvider` struct in `tests/utils/mock_provider.rs` implementing `ModelProvider` that returns a pre-configured stream.

---

#### 4.2 — Integration tests for MCP client
**Issue:** `write-integration-tests` — MCP client integration tests are missing entirely.

**Files:** `src-tauri/skilldeck-core/tests/integration/mcp_client_tests.rs`

Use `tokio::process` to spawn a tiny Python echo MCP server in tests (or use `tempfile` + `std::process` to write and run a minimal stdio server script). Tests:
- `stdio_transport_connect_and_list_tools`
- `stdio_transport_call_tool`
- `registry_connects_and_disconnects`
- `supervisor_reconnects_after_disconnect` — kill the process, verify supervisor restarts it within the configured backoff window

---

#### 4.3 — Integration tests for workflow executor
**Issue:** `write-integration-tests` — existing workflow tests use placeholder sleeps.

**Files:** `src-tauri/skilldeck-core/tests/integration/workflow_executor_tests.rs`

Replace placeholder sleeps with a `MockStepExecutor` that immediately returns a canned string. Tests:
- `sequential_execution_runs_in_order` — three-step chain; assert events arrive in order
- `parallel_execution_runs_concurrently` — two independent steps; assert both `StepStarted` events arrive before either `StepCompleted`
- `dependent_step_blocked_on_failure` — step B depends on A; A fails; assert B is `Blocked`
- `evaluator_optimizer_loops_until_pass` — mock evaluator returns "fail" twice then "pass"; assert three iterations

---

#### 4.4 — Unit tests for provider modules and DB layer
**Issue:** `write-unit-tests` — provider and DB tests are incomplete.

**Files:**
- `src-tauri/skilldeck-core/src/providers/claude.rs` — Add `#[cfg(test)]` block: `message_conversion_roles`, `tool_conversion_names`, `streaming_chunk_deserialization` (test against a hardcoded SSE chunk string)
- `src-tauri/skilldeck-core/src/providers/openai.rs` — Mirror the same three tests (already partially present, add `streaming_usage_parsed`)
- `src-tauri/skilldeck-core/tests/unit/db_connection_tests.rs` — Add `stats_returns_known_tables` (already in connection.rs but not the standalone file), `db_migration_idempotent` (run migrations twice, assert no error)

---

#### 4.5 — BDD scenario tests
**Issue:** `write-bdd-scenario-tests` — no BDD tests exist.

Add `cucumber-rs` (or `behave`-style via `rstest` parametrize) as a dev-dependency. Use the existing E2E Playwright tests as the BDD layer for user-journey scenarios (they already exist in `src-tauri/tests/e2e/`), and add Rust-level BDD-style tests for core journeys:

**Files:** `src-tauri/tests/bdd/`
- `conversations.rs` — `given_a_profile_when_i_send_a_message_then_i_receive_a_response` using `MockProvider`
- `skills.rs` — `given_a_skill_installed_when_agent_runs_then_skill_is_injected`
- `tool_approval.rs` — `given_an_mcp_tool_when_agent_calls_it_then_approval_is_requested`
- `workflow.rs` — `given_a_sequential_workflow_when_executed_then_steps_run_in_order`

Each test follows a strict Given/When/Then comment structure. No external BDD framework is required — the clarity comes from the naming convention and comments.

---

#### 4.6 — NFR verification tests
**Issue:** `write-nfr-verification-tests` — no NFR tests exist.

**Performance (`src-tauri/skilldeck-core/benches/`):**
- `agent_loop_latency.rs` — Criterion benchmark: mock provider returns 100 token chunks; measure time from `run()` call to last `Token` event; assert p99 < 100ms
- `skill_scan_throughput.rs` — Create 100 temporary skill directories; benchmark `scan_skill_directories`; assert < 500ms

**Security (`src-tauri/tests/security/`):**
- `api_key_not_in_db.rs` — Open in-memory DB, run migrations, insert a profile, assert `SELECT key_hash FROM api_keys` does not contain the raw key string (only its hash)
- `symlink_skill_directory_skipped.rs` — Create a symlink pointing outside the skills dir; assert `scan_skill_directories` does not follow it (mirrors the existing `skill_scanner.rs` symlink logic test)

**Accessibility (`src/__tests__/accessibility/`):**
- `keyboard-navigation.test.tsx` — Use `@testing-library/user-event` to tab through the message input, send button, and sidebar; assert focus is never lost
- `contrast.test.tsx` — For each CSS variable pair (foreground/background), assert the computed contrast ratio meets WCAG AA (4.5:1) using the `wcag-contrast` npm package

---

### Dependency Ordering Summary

The tasks above should be executed in this sequence to avoid blocking:

1. **1.4** (supervisor reconnect) → unblocks **1.5** (event bridging) → unblocks **3.4** (MCP frontend events)
2. **1.2** (spawnSubagent real dispatch) + **1.7** (subagent tracking) → unblocks **1.6** (workflow real execution)
3. **1.1** (cancellation wiring) → unblocks **4.1** (agent loop integration test: cancellation case)
4. **1.3** (auto-approve config wiring) → unblocks **2.2** (set_auto_approve command) → unblocks **3.1 partial** (tool settings take effect)
5. **1.6** (workflow real execution) → unblocks **3.3** (React Flow DAG with live status) + **4.3** (workflow executor integration tests)
6. **3.1** (progressive unlock) + **3.2** (token counter) → both independent; can run in parallel with Rust work
7. **4.1–4.4** (unit + integration tests) → unblocks **4.5** (BDD scenarios) → unblocks **4.6** (NFR benchmarks)
