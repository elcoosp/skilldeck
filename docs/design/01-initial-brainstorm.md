## Design — Section 1: Architecture Overview

The app is structured as three distinct layers:

**1. Rust Core (`src-tauri/core`)**
A library crate that owns all business logic: the agent loop, model abstraction, MCP client, skill engine, plugin loader, and sync engine. It exposes a clean async API consumed by Tauri commands. This crate has zero Tauri dependency — it's pure domain logic, fully testable in isolation.

**2. Tauri Shell (`src-tauri`)**
Thin Tauri application that wires the Rust core to the OS: registers Tauri commands, manages the app window, handles secure credential storage (via the OS keychain), auto-update, and native menus. Also owns the `pg_embed` lifecycle — starts/stops the bundled Postgres instance.

**3. React Frontend (`src`)**
Pure view layer in React + TypeScript. Communicates exclusively via Tauri's `invoke()` command bridge. No business logic. State management via Zustand or Jotai — lightweight, no Redux overhead.

**Plugin boundary:** A separate `core-plugin-api` crate defines the stable ABI — traits for `ModelProvider`, `McpTransport`, `SkillLoader`, and `SyncBackend`. Dynamic plugins implement these traits and are loaded at runtime via `libloading`. ABI stability is enforced via a C-compatible FFI layer using `safer_ffi` or `abi_stable`.

**Data flow at a glance:**

```
React UI → invoke() → Tauri command → Core (Rust) → [Model API / MCP server / DB / Plugin]
                                                     ↑
                                              dyn Plugin (.so/.dll)
```

## Design — Section 2: Core Rust Traits (Plugin Seams)

Four traits define the extensibility boundaries. Everything built-in implements these traits. Dynamic loading slots in at v2 without changing the call sites.

```rust
// Model provider: Claude, GPT-4, Gemini, Ollama
#[async_trait]
pub trait ModelProvider: Send + Sync {
    fn id(&self) -> &str;
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionStream>;
}

// MCP transport: stdio or HTTP/SSE
#[async_trait]
pub trait McpTransport: Send + Sync {
    async fn connect(&self, config: &McpServerConfig) -> Result<McpSession>;
}

// Skill loader: reads SKILL.md manifests from disk or remote
#[async_trait]
pub trait SkillLoader: Send + Sync {
    async fn load(&self, source: &SkillSource) -> Result<Skill>;
}

// Sync backend: local Postgres, remote Postgres, future S3/cloud
#[async_trait]
pub trait SyncBackend: Send + Sync {
    async fn push(&self, changeset: &Changeset) -> Result<()>;
    async fn pull(&self) -> Result<Changeset>;
}
```

A `Registry` struct in the core holds `Arc<dyn ModelProvider>` etc. — populated at startup by the Tauri shell registering built-in implementations. At v2, the shell additionally scans a plugins directory and registers dynamic ones.
Good. Moving to the feature set and data model.

## Design — Section 3: Features & Data Model

**Core features of v1:**

_Chat & Agent Loop_
Each conversation has an active `Profile` (model + MCP servers + skills). The agent loop in Rust handles streaming responses, tool call dispatch to MCP servers, and skill context injection into the system prompt. The loop is fully async via Tokio, streaming back to the React UI via Tauri events (`emit`).

_MCP Discovery_
Two sources unified into a single `McpServerRegistry`:

- **Local scanner**: probes localhost ports + scans for running processes matching known MCP server patterns, runs on app start + manual refresh
- **Registry browser**: fetches a curated index (JSON manifest hosted remotely), displays in the marketplace UI with one-click connect

_Skills_
Skills are markdown files (`SKILL.md`) with a frontmatter manifest (name, description, triggers). Loaded from: local filesystem paths, remote URLs, or the marketplace. Active skills for a conversation are concatenated into the system prompt prefix.

_Agent Profiles_
A saved configuration: model + model params + active MCP servers + active skills + system prompt override. Profiles are named, reusable across conversations, and shown in the new-chat flow.

**SeaORM schema (key tables):**

```
profiles          id, name, model_id, model_params, system_prompt, created_at
conversations     id, profile_id, title, created_at, updated_at
messages          id, conversation_id, role, content, tool_calls, created_at
mcp_servers       id, name, transport, config_json, source (local|registry), active
skills            id, name, source_url, manifest_json, content_md
profile_mcps      profile_id, mcp_server_id
profile_skills    profile_id, skill_id
sync_state        id, last_pushed_at, last_pulled_at, remote_dsn_encrypted
```

_Sync_
Local Postgres is the source of truth. Optional remote Postgres DSN stored encrypted in OS keychain. Sync is manual-trigger or on app close — a simple changeset diff on `updated_at` timestamps, no CRDT complexity at v1.
Good. Now the frontend structure.

## Design — Section 4: React Frontend Layout

Three-panel layout, standard for developer tools (think VS Code / Linear):

```
┌─────────────┬──────────────────────────────┬─────────────────────┐
│  LEFT PANEL │       CENTER PANEL           │    RIGHT PANEL      │
│  160px      │       flex-1                 │    320px            │
│             │                              │   (collapsible)     │
│ • New Chat  │  ┌──────────────────────┐   │                     │
│             │  │  Conversation title  │   │  Active Profile     │
│ Conversation│  │  + profile badge     │   │  ─────────────────  │
│ history     │  └──────────────────────┘   │  Model selector     │
│ (grouped    │                              │  MCP servers list   │
│  by date)   │  Message thread              │  Skills list        │
│             │  (streamed, tool calls       │                     │
│ ─────────── │   shown inline as           │  ─────────────────  │
│             │   collapsible cards)         │  Marketplace tab    │
│ Profiles    │                              │  (browse + install  │
│ ─────────── │  ┌──────────────────────┐   │   MCP + skills)     │
│             │  │  Input box           │   │                     │
│ Settings    │  │  [attach] [profile▾] │   │                     │
│             │  └──────────────────────┘   │                     │
└─────────────┴──────────────────────────────┴─────────────────────┘
```

**Key UX details:**

- Tool calls render inline as collapsible cards showing MCP server name, tool name, inputs/outputs — developers want to see what's happening
- The right panel's **Marketplace tab** lets users browse the registry + detected local servers side by side, with status badges (connected / available / not running)
- Profile badge on the conversation header is a quick-switch dropdown — no need to open settings to swap models mid-session
- Skills show as pills in the right panel — click to preview the SKILL.md content, toggle to activate/deactivate for this conversation

**Tauri event flow:**

```
Rust core emits:
  agent:token        → appended to message stream
  agent:tool_call    → renders inline tool card
  agent:done         → finalizes message, saves to DB
  mcp:discovered     → updates local server list live
```

Last section — error handling and testing strategy.

## Design — Section 5: Error Handling & Testing

**Error handling**

A single `CoreError` enum in the Rust core covers all failure domains:

```rust
pub enum CoreError {
    Model(ModelError),        // API errors, rate limits, auth failures
    Mcp(McpError),            // Transport failures, tool call errors
    Skill(SkillError),        // Parse failures, missing manifests
    Db(DbError),              // SeaORM/Postgres errors
    Sync(SyncError),          // Remote DSN unreachable, conflict
    Plugin(PluginError),      // Reserved for v2
}
```

Errors propagate via `Result<T, CoreError>` through the core, get serialized to JSON at the Tauri command boundary, and surface in React as typed error states per feature domain. The UI never shows raw Rust errors — each domain has a human-readable fallback message with an optional "show details" toggle for developers.

MCP tool call failures are non-fatal — the agent loop catches them, injects the error as a tool result message, and continues. The user sees the failure inline in the tool call card without losing the conversation.

**Testing strategy**

Three layers:

- **Unit tests** in the core crate — each trait implementation tested with mock dependencies. `MockModelProvider` returns scripted responses, `MockMcpTransport` simulates tool calls. No Tauri, no Postgres required.
- **Integration tests** — spin up a real `pg_embed` instance, run the full agent loop against a local Ollama model. Tests live in `tests/` in the core crate.
- **E2E tests** — Tauri's WebDriver integration for critical user flows: new chat, profile switch, MCP connect, skill toggle. Kept minimal — only the happy paths that break silently.
