# SkillDeck Architecture

SkillDeck is a **local‑first, reactive, event‑driven state machine** wrapped in a Tauri desktop shell. The architecture is organized into three layers to ensure clean separation of concerns, testability, and maintainability.

```
┌─────────────────────────────────────────────────────────────────┐
│                     REACT FRONTEND                               │
│  (Pure View Layer — communicates only via Tauri IPC)            │
│                                                                  │
│  Zustand (UI state)    TanStack Query (server state)            │
│  shadcn/ui components  React 19                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Tauri IPC (invoke + events)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TAURI SHELL                                  │
│  (Thin OS Integration Layer)                                     │
│                                                                  │
│  AppState registration   Command handlers                        │
│  Event bridging          OS keychain bridge                      │
│  Approval gate queue     Window management                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Direct API calls
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RUST CORE (skilldeck-core)                   │
│  (Pure Library Crate — Zero Tauri Dependency)                    │
│                                                                  │
│  Agent Layer      Skill Layer       MCP Layer                   │
│  Workflow Layer   Provider Layer    Workspace Layer             │
│  Data Layer       Search Engine     TOON Encoder                │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Three‑Layer Architecture (ADR-001)
- **Rust Core (`skilldeck-core`)** – all business logic, no Tauri dependencies.
- **Tauri Shell** – thin OS integration, IPC, keychain, window management.
- **React Frontend** – pure view layer, communicates only via IPC.

This separation ensures the core is testable in isolation and portable to other contexts (CLI, server) in the future.

### 2. Tiered Streaming (ADR-002)
To meet the requirement of <100ms render latency, streaming responses from model providers go through a ring buffer → 50ms debounced emit → IPC → `requestAnimationFrame` rendering. This balances responsiveness and IPC efficiency.

### 3. Approval Gate via Oneshot Channels (ADR-005)
Tool calls requiring user approval use oneshot channels. The agent loop awaits the channel; the UI resolves it via IPC. Cancellation is handled by closing the channel.

### 4. Petgraph for Workflow DAG (ADR-006)
Workflows are defined as directed acyclic graphs using the `petgraph` crate. This provides topological sort, cycle detection, and dependency management.

### 5. SQLite with WAL Mode (ADR-003)
All persistent data is stored in SQLite with WAL mode enabled for crash recovery and concurrency.

### 6. OS Keychain for Secrets (ADR-009)
API keys are stored in the platform‑specific secure keychain, never in the database or config files.

## Core Modules (Rust)

- **`error`** – comprehensive error taxonomy.
- **`db`** – database connection and migrations.
- **`traits`** – dependency inversion interfaces (`ModelProvider`, `McpTransport`, `SkillLoader`, `Database`).
- **`providers`** – Claude, OpenAI, Ollama implementations.
- **`skills`** – loader, resolver, watcher for filesystem‑based skills.
- **`mcp`** – MCP client, registry, supervision.
- **`agent`** – agent loop, context builder, tool dispatcher, approval gate.
- **`workflow`** – workflow graph, executor, subagent management.
- **`workspace`** – project type detection, context loading.
- **`events`** – event types for IPC.

## IPC Boundary

All communication between the frontend and Rust core happens via Tauri IPC:

- **Commands** – typed invoke calls (e.g., `create_conversation`, `send_message`).
- **Events** – one‑way streaming events (e.g., `AgentEvent::Token`, `WorkflowEvent::StepStarted`).

The frontend never accesses the database or filesystem directly.

## Data Flow Example: Message Streaming

1. User types a message and hits Send.
2. Frontend invokes `send_message` command.
3. Tauri shell routes to Rust core, which starts the agent loop.
4. Agent loop builds context (history, skills, system prompt) and calls the model provider.
5. Provider returns a streaming response; tokens are accumulated in a ring buffer.
6. Every 50ms (or when buffer is full), a batch of tokens is emitted as an IPC event.
7. Frontend receives the event, appends to `streamingText` in Zustand, and updates the DOM via `requestAnimationFrame`.

For more detailed diagrams, see the [full Architecture Document](docs/ARCHITECTURE_FULL.md).

## Technology Stack

| Layer          | Technology                                                       |
|----------------|------------------------------------------------------------------|
| Rust Core      | Tokio, SeaORM, Petgraph, Reqwest, Tracing, Thiserror            |
| Tauri Shell    | Tauri 2, tauri‑plugin‑keyring, tauri‑plugin‑store, etc.         |
| React Frontend | React 19, TypeScript, Vite, Zustand, TanStack Query, shadcn/ui, Tailwind CSS |
| Database       | SQLite (with WAL)                                                |
| Security       | OS keychain (Keychain, Credential Manager, libsecret)            |

## Contributing to the Architecture

If you're interested in the architecture, check out the [ADR documents](docs/adr/) for detailed design rationales. For development setup, see [CONTRIBUTING.md](CONTRIBUTING.md).

We welcome discussions and contributions that improve the architecture while maintaining our core principles of local‑first, privacy, and developer control.
