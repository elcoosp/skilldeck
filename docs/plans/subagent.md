# A2A-Compliant Subagents with Multi-Skill Support – Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the main agent to spawn independent A2A‑compliant subagents, each optionally equipped with multiple skills from the existing skill registry. Subagents run as separate HTTP servers, stream status to the frontend, and can merge their final results back into the conversation.

**Architecture:**
- Subagents are spawned by a built‑in tool `spawnSubagent` which accepts a task and a list of skill names.
- The tool looks up each skill in the `SkillRegistry`, concatenates their Markdown content, and builds a system prompt that includes the task and skill content.
- A new `SubagentServer` struct spawns an Axum server serving the agent via A2A (using `adk-server`). It runs on a random local port.
- The main agent uses an `A2aClient` to send the initial message and monitor the subagent’s progress via SSE.
- Frontend listens to Tauri events (`subagent-status`, `subagent-artifact`) and displays subagent cards with real‑time updates.
- A second built‑in tool `mergeSubagentResult` retrieves the final output and inserts it as a message.

**Tech Stack:**
- Rust (Tokio, Axum, Tauri)
- ADK-Rust crates: `adk-server`, `adk-agent`, `adk-tool`, `adk-core`
- Existing SkillDeck crates: `skilldeck-core` (SkillRegistry), `skilldeck-models` (if needed), `src-tauri` commands
- Frontend: React, Zustand, Tauri events

---

## Chunk 1: Subagent Server Foundation

### Task 1.1: Create `subagent_server.rs` module

**Files:**
- Create: `src-tauri/src/subagent_server.rs`
- Modify: `src-tauri/src/lib.rs` (to export module)
- Modify: `src-tauri/src/state.rs` (to add maps and semaphore)

- [ ] **Step 1: Write the module scaffold**

```rust
// src-tauri/src/subagent_server.rs

use axum::Router;
use std::sync::Arc;
use tokio::sync::oneshot;
use adk_core::Agent;
use adk_server::{create_app_with_a2a, ServerConfig, SingleAgentLoader};
use adk_session::InMemorySessionService;

pub struct SubagentServer {
    pub url: String,
    shutdown_tx: oneshot::Sender<()>,
    handle: tokio::task::JoinHandle<()>,
}

impl SubagentServer {
    pub async fn spawn(agent: Arc<dyn Agent>) -> Result<Self, Box<dyn std::error::Error>> {
        let session_service = Arc::new(InMemorySessionService::new());
        let loader = Arc::new(SingleAgentLoader::new(agent));
        let config = ServerConfig::new(loader, session_service).with_a2a_base_url(None);
        let app = create_app_with_a2a(config, None);

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        let url = format!("http://{}", addr);

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let handle = tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    shutdown_rx.await.ok();
                })
                .await
                .unwrap();
        });

        Ok(SubagentServer { url, shutdown_tx, handle })
    }

    pub async fn shutdown(self) {
        let _ = self.shutdown_tx.send(());
        self.handle.await.ok();
    }
}
```

- [ ] **Step 2: Add module to `lib.rs`**

```rust
// src-tauri/src/lib.rs (at the top, with other mod declarations)
mod subagent_server;
pub use subagent_server::SubagentServer;
```

- [ ] **Step 3: Extend `AppState` with subagent tracking**

```rust
// src-tauri/src/state.rs

use dashmap::DashMap;
use tokio::sync::Semaphore;
use crate::subagent_server::SubagentServer;

pub struct AppState {
    // ... existing fields
    pub subagent_servers: Arc<DashMap<String, SubagentServer>>,
    pub subagent_semaphore: Arc<Semaphore>, // e.g., limit 3 concurrent
}

impl AppState {
    pub async fn initialize(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        // ... existing initialization ...
        let subagent_semaphore = Arc::new(Semaphore::new(3)); // adjust as needed
        let subagent_servers = Arc::new(DashMap::new());

        Ok(Self {
            // ... existing fields ...
            subagent_servers,
            subagent_semaphore,
        })
    }
}
```

- [ ] **Step 4: Run `cargo check` to verify**

```bash
cd src-tauri
cargo check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/subagent_server.rs src-tauri/src/lib.rs src-tauri/src/state.rs
git commit -m "feat(subagent): add SubagentServer and AppState tracking"
```

---

## Chunk 2: Extend Built‑in Tools

### Task 2.1: Update `spawnSubagent` tool definition

**Files:**
- Modify: `src-tauri/skilldeck-core/src/agent/built_in_tools.rs`

- [ ] **Step 1: Change the tool definition to accept `skills` array**

```rust
// in built_in_tools.rs, function spawn_subagent()

pub fn spawn_subagent() -> ToolDefinition {
    ToolDefinition {
        name: "spawnSubagent".to_string(),
        description: "Spawn a parallel subagent to handle an independent sub-task. \
            Optionally equip it with one or more skills from the skill registry."
            .to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "The task description for the subagent"
                },
                "skills": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "List of skill names to equip the subagent with"
                }
            },
            "required": ["task"]
        }),
    }
}
```

- [ ] **Step 2: Keep `mergeSubagentResults` unchanged** (already defined)

- [ ] **Step 3: Run `cargo check` to verify**

```bash
cd src-tauri/skilldeck-core
cargo check
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/skilldeck-core/src/agent/built_in_tools.rs
git commit -m "feat(subagent): update spawnSubagent tool to accept multiple skills"
```

---

## Chunk 3: Tool Dispatcher Integration and Spawn Implementation

### Task 3.1: Extend `ToolDispatcher` with `AppState`

**Files:**
- Modify: `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs`
- Modify: `src-tauri/src/commands/messages.rs` (dispatcher creation)

- [ ] **Step 1: Add `state` field to `ToolDispatcher`**

```rust
// src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs

use crate::state::AppState; // but core cannot depend on tauri; we need a trait or Arc<dyn Any>

// Better: use an Arc<dyn Any> or pass a generic. For now, we'll use a type‑erased Arc.
// We'll define a trait in core that can be implemented by AppState to expose needed methods.

// Let's create a new trait in core:
```

But `skilldeck-core` cannot depend on `src-tauri`. We need to inject the necessary capabilities via a trait. Let's define a trait `SubagentSpawner` in `skilldeck-core` that `AppState` will implement. This is cleaner.

- [ ] **Step 1a: Define trait `SubagentSpawner` in `skilldeck-core`**

Create file: `src-tauri/skilldeck-core/src/traits/subagent_spawner.rs`

```rust
use async_trait::async_trait;
use std::sync::Arc;

#[async_trait]
pub trait SubagentSpawner: Send + Sync {
    async fn spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
    ) -> Result<String, String>; // returns subagent_id
}
```

Add to `mod.rs` in traits.

- [ ] **Step 1b: Add `subagent_spawner` field to `ToolDispatcher`**

```rust
// src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs

use crate::traits::SubagentSpawner;

pub struct ToolDispatcher {
    // ... existing fields
    subagent_spawner: Option<Arc<dyn SubagentSpawner>>,
}

impl ToolDispatcher {
    pub fn new(
        // ... existing params
        subagent_spawner: Option<Arc<dyn SubagentSpawner>>,
    ) -> Self {
        Self {
            // ...
            subagent_spawner,
        }
    }
}
```

- [ ] **Step 2: Implement `SubagentSpawner` for `AppState`**

In `src-tauri/src/state.rs`:

```rust
use skilldeck_core::traits::SubagentSpawner;
use async_trait::async_trait;

#[async_trait]
impl SubagentSpawner for AppState {
    async fn spawn_subagent(&self, task: String, skill_names: Vec<String>) -> Result<String, String> {
        // Implementation will go here (Task 3.2)
        todo!()
    }
}
```

- [ ] **Step 3: Pass `AppState` as spawner when creating dispatcher**

In `src-tauri/src/commands/messages.rs`, inside `run_agent_loop`:

```rust
let subagent_spawner: Option<Arc<dyn SubagentSpawner>> = Some(state.clone() as Arc<dyn SubagentSpawner>);
let dispatcher = Arc::new(ToolDispatcher::new(
    Arc::clone(&state.registry.mcp_registry),
    Arc::clone(&state.approval_gate),
    Arc::clone(&state.registry.skill_registry),
    provider.supports_toon(),
    subagent_spawner,
));
```

- [ ] **Step 4: Implement `spawnSubagent` logic in dispatcher**

In `tool_dispatcher.rs`, `dispatch_builtin` for `"spawnSubagent"`:

```rust
// Inside dispatch_builtin, match name
"spawnSubagent" => {
    if let Some(spawner) = &self.subagent_spawner {
        let task = args["task"].as_str().unwrap_or("").to_string();
        let skills = args["skills"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        match spawner.spawn_subagent(task, skills).await {
            Ok(subagent_id) => Some(Ok(serde_json::json!({ "subagentId": subagent_id, "status": "spawned" }))),
            Err(e) => Some(Err(CoreError::ToolExecution { tool_name: "spawnSubagent".into(), message: e })),
        }
    } else {
        Some(Err(CoreError::Internal { message: "Subagent spawner not configured".into() }))
    }
}
```

- [ ] **Step 5: Run `cargo check` on both crates**

```bash
cargo check -p skilldeck-core
cargo check -p skilldeck-lib
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/skilldeck-core/src/traits/subagent_spawner.rs \
       src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs \
       src-tauri/src/state.rs \
       src-tauri/src/commands/messages.rs
git commit -m "feat(subagent): integrate ToolDispatcher with SubagentSpawner trait"
```

### Task 3.2: Implement `spawn_subagent` in `AppState`

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/subagent_server.rs` (add helper for agent creation)

- [ ] **Step 1: Add helper to build subagent LlmAgent from task and skills**

In `subagent_server.rs`, add a function:

```rust
use adk_agent::LlmAgentBuilder;
use adk_model::ModelProvider;
use skilldeck_core::skills::SkillRegistry;

pub async fn build_subagent_agent(
    provider: Arc<dyn ModelProvider>,
    model_id: String,
    task: String,
    skill_names: Vec<String>,
    skill_registry: Arc<SkillRegistry>,
) -> Result<Arc<dyn Agent>, String> {
    let mut skills_content = Vec::new();
    for name in &skill_names {
        let skill = skill_registry
            .get_skill(name)
            .await
            .ok_or_else(|| format!("Skill '{}' not found", name))?;
        skills_content.push(format!("\n\n---\n\n[Skill: {}]\n{}", name, skill.content_md));
    }

    let system_prompt = if skills_content.is_empty() {
        task
    } else {
        format!("{}\n\n{}", task, skills_content.join(""))
    };

    let agent = LlmAgentBuilder::new("subagent")
        .model(provider)
        .instruction(system_prompt)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(Arc::new(agent))
}
```

- [ ] **Step 2: Implement `spawn_subagent` in `AppState`**

```rust
// in src-tauri/src/state.rs

#[async_trait]
impl SubagentSpawner for AppState {
    async fn spawn_subagent(&self, task: String, skill_names: Vec<String>) -> Result<String, String> {
        // Acquire semaphore permit
        let _permit = self.subagent_semaphore.acquire().await.map_err(|e| e.to_string())?;

        // Get provider and model from the current conversation? But we don't have that here.
        // We need the provider and model to be passed in or stored in AppState.
        // For now, we'll assume we have a default provider and model stored in AppState.
        // We'll add those fields later.

        // For now, return a placeholder.
        // This will be completed after we add provider resolution.
        Err("Not yet implemented".into())
    }
}
```

We realize we need the provider and model to build the subagent. The `spawn_subagent` tool is called during the main agent's execution, which knows the provider and model from the conversation. We need to pass that information into the spawner. The simplest way is to include them in the tool call arguments, but that would require the LLM to provide them, which is not desired. Alternatively, we can store the current provider and model in thread‑local or pass them via context.

Better: the `ToolDispatcher` already has access to the main agent's provider via its internal state? Not directly. Let's reframe: when the main agent calls the built‑in tool, we are inside the `run_agent_loop` and we know the provider and model. We can capture them and pass them to the spawner via a closure or by storing them in a struct that implements `SubagentSpawner`.

We'll modify `SubagentSpawner` to accept provider and model as parameters.

- [ ] **Step 3: Update trait to include provider and model**

```rust
// src-tauri/skilldeck-core/src/traits/subagent_spawner.rs

#[async_trait]
pub trait SubagentSpawner: Send + Sync {
    async fn spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
        provider: Arc<dyn ModelProvider>,
        model_id: String,
    ) -> Result<String, String>;
}
```

- [ ] **Step 4: Adjust dispatcher call to pass provider and model**

In `tool_dispatcher.rs`:

```rust
// Inside dispatch_builtin, we now need provider and model. They aren't in the dispatcher.
// We'll need to add them as fields in ToolDispatcher or pass them at runtime.
```

This is getting complex. A simpler approach: instead of making the dispatcher responsible for spawning, we can make the spawner a closure stored in the dispatcher that captures the provider and model at the point of agent execution. The `run_agent_loop` can create a spawner closure that knows the provider and model, and pass that to the dispatcher as an `Arc<dyn SubagentSpawner>`. That closure can capture the necessary values.

Let's define `SubagentSpawner` as a trait with a single method that takes `(task, skills)`. The implementation in `AppState` will need to know provider and model, so we'll store them in a struct that implements the trait.

- [ ] **Step 5: Create a struct that holds provider, model, and AppState reference**

In `src-tauri/src/commands/messages.rs`, inside `run_agent_loop`:

```rust
use std::sync::Arc;
use skilldeck_core::traits::SubagentSpawner;

struct SpawnerWithContext {
    state: Arc<AppState>,
    provider: Arc<dyn ModelProvider>,
    model_id: String,
}

#[async_trait]
impl SubagentSpawner for SpawnerWithContext {
    async fn spawn_subagent(&self, task: String, skill_names: Vec<String>) -> Result<String, String> {
        self.state.do_spawn_subagent(task, skill_names, self.provider.clone(), self.model_id.clone()).await
    }
}
```

Then we add a method `do_spawn_subagent` to `AppState` (or implement the logic inline). We'll put the actual spawning logic in `AppState` but require the extra params.

- [ ] **Step 6: Add `do_spawn_subagent` to `AppState`**

```rust
// src-tauri/src/state.rs

impl AppState {
    pub async fn do_spawn_subagent(
        &self,
        task: String,
        skill_names: Vec<String>,
        provider: Arc<dyn ModelProvider>,
        model_id: String,
    ) -> Result<String, String> {
        let _permit = self.subagent_semaphore.acquire().await.map_err(|e| e.to_string())?;

        let agent = crate::subagent_server::build_subagent_agent(
            provider,
            model_id,
            task,
            skill_names,
            self.registry.skill_registry.clone(),
        )
        .await?;

        let server = crate::subagent_server::SubagentServer::spawn(agent).await.map_err(|e| e.to_string())?;
        let url = server.url.clone();
        let subagent_id = uuid::Uuid::new_v4().to_string();

        // Store server
        self.subagent_servers.insert(subagent_id.clone(), server);

        // Create A2A client and send initial message (optional, could start automatically)
        let client = adk_server::a2a::A2aClient::from_url(&url).await.map_err(|e| e.to_string())?;
        // We'll spawn a monitor task later that listens to events.
        // For now, just return the id.

        Ok(subagent_id)
    }
}
```

- [ ] **Step 7: Create the spawner and pass to dispatcher in `run_agent_loop`**

```rust
// src-tauri/src/commands/messages.rs, inside run_agent_loop

let spawner = Arc::new(SpawnerWithContext {
    state: state.clone(),
    provider: provider.clone(),
    model_id: model_id.clone(),
});

let dispatcher = Arc::new(ToolDispatcher::new(
    // ... other args
    Some(spawner as Arc<dyn SubagentSpawner>),
));
```

- [ ] **Step 8: Implement `build_subagent_agent` (stub for now)**

We'll implement it properly later.

- [ ] **Step 9: Run `cargo check`**

```bash
cargo check -p skilldeck-core
cargo check -p skilldeck-lib
```

- [ ] **Step 10: Commit**

```bash
git add src-tauri/skilldeck-core/src/traits/subagent_spawner.rs \
       src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs \
       src-tauri/src/state.rs \
       src-tauri/src/commands/messages.rs \
       src-tauri/src/subagent_server.rs
git commit -m "feat(subagent): implement spawn_subagent logic with provider context"
```

---

## Chunk 4: Monitor Task and Event Emission

### Task 4.1: Spawn monitor task for each subagent

**Files:**
- Modify: `src-tauri/src/state.rs` (add active_clients map)
- Modify: `src-tauri/src/commands/messages.rs` (spawn monitor after spawn)

- [ ] **Step 1: Add `active_subagent_clients` to `AppState`**

```rust
// src-tauri/src/state.rs
use dashmap::DashMap;
use adk_server::a2a::A2aClient;

pub struct AppState {
    // ... existing
    pub subagent_clients: Arc<DashMap<String, A2aClient>>,
}

// Initialize in AppState::initialize
subagent_clients: Arc::new(DashMap::new()),
```

- [ ] **Step 2: After spawning server, store client and spawn monitor**

In `do_spawn_subagent`, after getting client:

```rust
let client_clone = client.clone();
self.subagent_clients.insert(subagent_id.clone(), client);

// Spawn monitor task
let state_clone = self.clone(); // careful: self is Arc, we can clone it
let subagent_id_clone = subagent_id.clone();
let app_handle = ... // we need Tauri AppHandle to emit events. We'll need to pass it in.

// For now, we'll just note that we need app_handle. We'll pass it as parameter.
```

But monitor needs to emit Tauri events. We'll add `app_handle` to `AppState` (it's already there? In `AppState::initialize` we have `app: &tauri::AppHandle`, we can store it). Let's add a field `app_handle: tauri::AppHandle` to `AppState`.

- [ ] **Step 3: Store `app_handle` in `AppState`**

```rust
// src-tauri/src/state.rs

pub struct AppState {
    // ...
    pub app_handle: tauri::AppHandle,
}

// In AppState::initialize, after creation:
let state = Self {
    // ...
    app_handle: app.clone(),
};
```

- [ ] **Step 4: Implement monitor function**

Create a new file `src-tauri/src/subagent_monitor.rs` (or add to `subagent_server.rs`).

```rust
// src-tauri/src/subagent_monitor.rs

use adk_server::a2a::{A2aClient, UpdateEvent};
use futures::StreamExt;
use std::sync::Arc;
use tauri::AppHandle;
use tracing::error;

pub async fn monitor_subagent(
    subagent_id: String,
    client: A2aClient,
    app_handle: AppHandle,
) {
    // We need a task ID; we didn't send a message yet. We should send a dummy user message
    // to start the subagent's execution. But the subagent's instruction already contains the task,
    // so we might not need to send anything. However, the subagent won't start automatically;
    // it needs an incoming message. So we should send a simple "Start" message.

    let message = adk_server::a2a::Message::builder()
        .role(adk_server::a2a::Role::User)
        .parts(vec![adk_server::a2a::Part::text("Start".to_string())])
        .message_id(uuid::Uuid::new_v4().to_string())
        .build();

    let stream = match client.send_streaming_message(message).await {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to start subagent {}: {}", subagent_id, e);
            return;
        }
    };

    let mut stream = Box::pin(stream);
    while let Some(event) = stream.next().await {
        match event {
            Ok(UpdateEvent::TaskStatusUpdate(status)) => {
                let _ = app_handle.emit(
                    "subagent-status",
                    serde_json::json!({
                        "subagentId": subagent_id,
                        "status": status.status.state,
                    }),
                );
            }
            Ok(UpdateEvent::TaskArtifactUpdate(artifact)) => {
                // For now, just log; we can accumulate and show later.
                let _ = app_handle.emit(
                    "subagent-artifact",
                    serde_json::json!({
                        "subagentId": subagent_id,
                        "artifact": artifact,
                    }),
                );
            }
            Err(e) => {
                error!("Subagent {} stream error: {}", subagent_id, e);
                break;
            }
        }
    }

    // When stream ends, clean up
    // We'll handle cleanup separately.
}
```

- [ ] **Step 5: Spawn monitor in `do_spawn_subagent`**

After inserting client, spawn:

```rust
let client_clone = client.clone();
let app_handle = self.app_handle.clone();
let subagent_id_clone = subagent_id.clone();
tokio::spawn(async move {
    monitor_subagent(subagent_id_clone, client_clone, app_handle).await;
});
```

- [ ] **Step 6: Run `cargo check`**

```bash
cargo check
```

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/subagent_monitor.rs src-tauri/src/lib.rs
git commit -m "feat(subagent): add monitor task and event emission"
```

---

## Chunk 5: Frontend Updates

### Task 5.1: Add subagent state to UI store

**Files:**
- Create: `src/store/subagent.ts`
- Modify: `src/store/index.ts` (or `ui.ts` if we merge)

- [ ] **Step 1: Create `subagent.ts` store slice**

```typescript
// src/store/subagent.ts
import { create } from 'zustand';

export interface SubagentState {
  id: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

interface SubagentStore {
  subagents: Record<string, SubagentState>;
  updateSubagentStatus: (id: string, status: SubagentState['status']) => void;
  setSubagentResult: (id: string, result: string) => void;
  setSubagentError: (id: string, error: string) => void;
  removeSubagent: (id: string) => void;
}

export const useSubagentStore = create<SubagentStore>((set) => ({
  subagents: {},
  updateSubagentStatus: (id, status) =>
    set((state) => ({
      subagents: {
        ...state.subagents,
        [id]: { ...state.subagents[id], status },
      },
    })),
  setSubagentResult: (id, result) =>
    set((state) => ({
      subagents: {
        ...state.subagents,
        [id]: { ...state.subagents[id], result, status: 'completed' },
      },
    })),
  setSubagentError: (id, error) =>
    set((state) => ({
      subagents: {
        ...state.subagents,
        [id]: { ...state.subagents[id], error, status: 'failed' },
      },
    })),
  removeSubagent: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.subagents;
      return { subagents: rest };
    }),
}));
```

- [ ] **Step 2: Integrate into main store (optional)**

If we have a root store, we can include it there.

- [ ] **Step 3: Run `pnpm check` to verify types**

```bash
pnpm check
```

- [ ] **Step 4: Commit**

```bash
git add src/store/subagent.ts
git commit -m "feat(ui): add subagent store"
```

### Task 5.2: Create `SubagentCard` component

**Files:**
- Create: `src/components/conversation/subagent-card.tsx`
- Modify: `src/components/conversation/message-bubble.tsx` (to render cards)

- [ ] **Step 1: Write the component**

```tsx
// src/components/conversation/subagent-card.tsx
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useSubagentStore } from '@/store/subagent';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SubagentCardProps {
  subagentId: string;
  task: string;
  onMerge?: () => void;
  onCancel?: () => void;
}

export function SubagentCard({ subagentId, task, onMerge, onCancel }: SubagentCardProps) {
  const subagent = useSubagentStore((s) => s.subagents[subagentId]);

  const status = subagent?.status ?? 'pending';
  const result = subagent?.result;
  const error = subagent?.error;

  const statusIcon = {
    pending: <Loader2 className="size-3.5 animate-spin text-muted-foreground" />,
    running: <Loader2 className="size-3.5 animate-spin text-primary" />,
    completed: <CheckCircle2 className="size-3.5 text-green-500" />,
    failed: <XCircle className="size-3.5 text-destructive" />,
  }[status];

  return (
    <div className="my-2 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        {statusIcon}
        <span className="font-medium flex-1 truncate">Subagent: {task}</span>
      </div>

      {status === 'completed' && result && (
        <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap break-words">
          {result}
        </pre>
      )}

      {status === 'failed' && error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex gap-2 mt-2">
        {status === 'completed' && onMerge && (
          <Button size="sm" onClick={onMerge}>
            Merge result
          </Button>
        )}
        {(status === 'pending' || status === 'running') && onCancel && (
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `message-bubble.tsx` to detect subagent spawn messages**

When the assistant sends a tool result containing `subagentId`, we should render a `SubagentCard`. We'll detect that by checking the content for a JSON object with that field.

- [ ] **Step 3: Add conditional rendering in message bubble**

```tsx
// Inside MessageBubble, after checking role, if it's assistant message with tool result:
if (message.role === 'assistant' && message.content) {
  try {
    const data = JSON.parse(message.content);
    if (data.subagentId) {
      return <SubagentCard subagentId={data.subagentId} task={data.task ?? ''} />;
    }
  } catch {}
}
```

- [ ] **Step 4: Run `pnpm check` and fix any errors**

- [ ] **Step 5: Commit**

```bash
git add src/components/conversation/subagent-card.tsx src/components/conversation/message-bubble.tsx
git commit -m "feat(ui): add SubagentCard component"
```

### Task 5.3: Add Tauri event listeners

**Files:**
- Create: `src/hooks/use-subagent-events.ts`
- Modify: `src/App.tsx` (to use the hook)

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-subagent-events.ts
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useSubagentStore } from '@/store/subagent';

export function useSubagentEvents() {
  const updateStatus = useSubagentStore((s) => s.updateSubagentStatus);
  const setResult = useSubagentStore((s) => s.setSubagentResult);
  const setError = useSubagentStore((s) => s.setSubagentError);

  useEffect(() => {
    let unlistenStatus: (() => void) | undefined;
    let unlistenArtifact: (() => void) | undefined;

    const setup = async () => {
      unlistenStatus = await listen<{ subagentId: string; status: string }>(
        'subagent-status',
        (event) => {
          updateStatus(event.payload.subagentId, event.payload.status as any);
        }
      );
      unlistenArtifact = await listen<{ subagentId: string; artifact: any }>(
        'subagent-artifact',
        (event) => {
          // For now, treat artifacts as final result (simplified)
          setResult(event.payload.subagentId, JSON.stringify(event.payload.artifact));
        }
      );
    };

    setup();

    return () => {
      unlistenStatus?.();
      unlistenArtifact?.();
    };
  }, [updateStatus, setResult, setError]);
}
```

- [ ] **Step 2: Add hook to `App.tsx`**

Inside `AppContent`, add `useSubagentEvents()`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-subagent-events.ts src/App.tsx
git commit -m "feat(ui): add subagent event listeners"
```

---

## Chunk 6: Resource Management and Cleanup

### Task 6.1: Implement `mergeSubagentResult` tool

**Files:**
- Modify: `src-tauri/skilldeck-core/src/agent/built_in_tools.rs` (definition)
- Modify: `src-tauri/src/commands/messages.rs` (execution in dispatcher)

- [ ] **Step 1: Add `mergeSubagentResult` tool definition if not present** (should already exist, but ensure it accepts `subagentId`)

- [ ] **Step 2: Implement execution in dispatcher**

In `dispatch_builtin` for `"mergeSubagentResult"`:

```rust
"mergeSubagentResult" => {
    let subagent_id = args["subagentId"].as_str().ok_or_else(|| CoreError::ToolExecution {
        tool_name: "mergeSubagentResult".into(),
        message: "Missing subagentId".into(),
    })?;

    // We need to get the final result from the subagent's A2A client.
    // But we don't have the client here. We'll need to store it in a way accessible.
    // We could add a method on SubagentSpawner to retrieve result, or store results in AppState when subagent completes.

    // For now, we'll assume the monitor stores the final result in AppState.
    // We'll add a map `subagent_results` in AppState that monitor populates.

    // Then here we can read it.

    unimplemented!()
}
```

- [ ] **Step 3: Extend `AppState` with results map**

Add `subagent_results: Arc<DashMap<String, String>>` to `AppState`.

- [ ] **Step 4: In monitor, when task completes, store result in map**

When stream ends, we can capture the final artifact. But A2A doesn't give a single final result; we may need to accumulate artifacts. For simplicity, we'll take the last artifact as the result.

- [ ] **Step 5: Implement `mergeSubagentResult` to fetch from map**

```rust
// In tool execution, after getting subagent_id:
if let Some(result) = state.subagent_results.get(subagent_id) {
    // Return result as JSON
    serde_json::json!({ "result": result.value().clone() })
} else {
    Err(... "subagent not completed yet")
}
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/commands/messages.rs
git commit -m "feat(subagent): implement mergeSubagentResult tool"
```

### Task 6.2: Clean up on app shutdown and subagent completion

- [ ] **Step 1: Implement `Drop` for `AppState` to shutdown servers**

```rust
impl Drop for AppState {
    fn drop(&mut self) {
        // Iterate over servers and send shutdown signals
        // This is best-effort.
        for mut entry in self.subagent_servers.iter_mut() {
            let server = entry.value();
            // We need to call shutdown, which is async. We can spawn a blocking task.
            let handle = server.handle.clone();
            let shutdown_tx = server.shutdown_tx.clone(); // but oneshot can't be cloned
            // This is tricky. We may need a different shutdown mechanism.
            // For now, we'll note that we need to handle this properly.
        }
    }
}
```

Better: store a `Vec<tokio::sync::oneshot::Sender<()>>` and join handles. We can add a `shutdown_all` method called on app exit.

- [ ] **Step 2: Add `shutdown_all` method and call it on exit**

In Tauri's `setup`, we can add a shutdown hook.

- [ ] **Step 3: Commit**

---

## Chunk 7: Testing and Documentation

### Task 7.1: Unit tests for skill resolution

**Files:**
- Create: `src-tauri/skilldeck-core/tests/unit/subagent_spawn_tests.rs`

- [ ] **Step 1: Write test for `build_subagent_agent` with multiple skills**

- [ ] **Step 2: Write test for missing skill handling**

- [ ] **Step 3: Run tests**

```bash
cargo nextest run -p skilldeck-core
```

- [ ] **Step 4: Commit**

### Task 7.2: Integration test with dummy subagent

**Files:**
- Create: `src-tauri/tests/integration/subagent_flow.rs`

- [ ] **Step 1: Write test that spawns a subagent with a test skill, verifies it runs, and merges result**

- [ ] **Step 2: Run test**

- [ ] **Step 3: Commit**

### Task 7.3: E2E test with Playwright

**Files:**
- Create: `src-tauri/tests/e2e/subagent.spec.ts`

- [ ] **Step 1: Write test simulating user sending a message that triggers subagent spawn**

- [ ] **Step 2: Run with Playwright**

- [ ] **Step 3: Commit**

### Task 7.4: Documentation

- [ ] **Step 1: Update `docs/plans/` with this plan**

- [ ] **Step 2: Update `README.md` with subagent feature overview**

- [ ] **Step 3: Commit**

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-16-a2a-subagents-with-skills.md`. Ready to execute?**
