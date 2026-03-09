# Tauri AI Agent Chat — Design Document

**Date:** 2026-03-09  
**Status:** Approved  
**Audience:** Developers / power users building AI workflows

---

## Overview

A Tauri desktop application providing an AI agent chat interface with discoverable MCP servers and a skills system based on the Anthropic/Claude.ai SKILL.md format. The app targets developers who want full control over their agent configurations, model choices, and tool integrations — all stored locally with optional cloud sync.

---

## Architecture

The app is structured as three distinct layers with clean separation of concerns.

### 1. Rust Core (`src-tauri/core`)

A standalone library crate owning all business logic: the agent loop, model abstraction, MCP client, skill engine, and sync engine. Has zero Tauri dependency — pure domain logic, fully testable in isolation. Exposes an async API consumed by Tauri commands.

### 2. Tauri Shell (`src-tauri`)

Thin wiring layer that connects the Rust core to the OS. Responsibilities:
- Registers Tauri commands (the React ↔ Rust bridge)
- Manages the `pg_embed` lifecycle (bundled Postgres instance)
- Handles secure credential storage via OS keychain
- Registers all built-in trait implementations into the core Registry
- Auto-update and native menus

### 3. React Frontend (`src`)

Pure view layer in React + TypeScript. Communicates exclusively via Tauri's `invoke()` command bridge. No business logic lives here. State management via Zustand — lightweight, no Redux overhead.

### Data Flow

```
React UI → invoke() → Tauri command → Rust Core → [Model API / MCP server / DB]
                ↑
        Tauri events (streaming)
```

---

## Plugin Architecture (Trait Seams)

Four traits define the extensibility boundaries. All built-in implementations satisfy these traits. Dynamic loading (`.so`/`.dll` via `libloading`) is deferred to v2 — at v1, the Tauri shell statically registers built-in implementations into a `Registry` struct holding `Arc<dyn Trait>` instances.

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

// Sync backend: local Postgres, remote Postgres, future backends
#[async_trait]
pub trait SyncBackend: Send + Sync {
    async fn push(&self, changeset: &Changeset) -> Result<()>;
    async fn pull(&self) -> Result<Changeset>;
}
```

At v2, the shell additionally scans a `~/.config/app/plugins/` directory and registers dynamic implementations without changing any call sites.

---

## Features

### Chat & Agent Loop

Each conversation has an active `Profile` (model + MCP servers + skills). The agent loop:
1. Injects active skills as system prompt prefix
2. Streams model response via `ModelProvider::complete()`
3. Dispatches tool calls to the appropriate MCP server via `McpTransport`
4. Injects tool results back into the context and continues
5. Emits Tauri events for each token, tool call, and completion

The loop is fully async via Tokio. Streaming tokens reach the React UI via `agent:token` events.

### MCP Discovery

Two sources unified into a single `McpServerRegistry`:

**Local scanner** — runs on app start and manual refresh:
- Probes localhost ports against known MCP server port conventions
- Scans running processes for known MCP server binary names

**Registry browser** — fetches a remotely hosted JSON index:
- Curated list of MCP servers with metadata (name, description, transport, config schema)
- One-click connect: fills config form from schema, saves to DB

Both sources are displayed side-by-side in the Marketplace UI with status badges: `connected` / `available` / `not running`.

### Skills

Skills are markdown files (`SKILL.md`) with YAML frontmatter manifest:

```yaml
---
name: my-skill
description: What this skill does
triggers: [keyword1, keyword2]
---
# Skill content injected into system prompt
```

Skills are loaded from local filesystem paths, remote URLs, or the marketplace. Active skills for a conversation are concatenated into the system prompt prefix at agent loop start.

### Agent Profiles

A saved, reusable configuration containing:
- Model selection + parameters (temperature, max tokens, etc.)
- Active MCP servers
- Active skills
- Optional system prompt override

Profiles are shown in the new-chat flow and switchable mid-session via a dropdown badge on the conversation header.

### Sync

Local Postgres (via `pg_embed`) is the source of truth. Optional remote Postgres DSN stored encrypted in the OS keychain. Sync is manual-trigger or on app close — a simple changeset diff on `updated_at` timestamps. No CRDT complexity at v1.

---

## Data Model (SeaORM / PostgreSQL)

```sql
profiles
  id uuid PK, name text, model_id text, model_params jsonb,
  system_prompt text, created_at, updated_at

conversations
  id uuid PK, profile_id uuid FK, title text, created_at, updated_at

messages
  id uuid PK, conversation_id uuid FK, role text, content text,
  tool_calls jsonb, created_at

mcp_servers
  id uuid PK, name text, transport text (stdio|sse),
  config_json jsonb, source text (local|registry), active bool

skills
  id uuid PK, name text, source_url text,
  manifest_json jsonb, content_md text

profile_mcps
  profile_id uuid FK, mcp_server_id uuid FK

profile_skills
  profile_id uuid FK, skill_id uuid FK

sync_state
  id uuid PK, last_pushed_at timestamptz,
  last_pulled_at timestamptz, remote_dsn_encrypted text
```

---

## Frontend Layout

Three-panel layout:

```
┌─────────────┬──────────────────────────────┬─────────────────────┐
│  LEFT PANEL │       CENTER PANEL           │    RIGHT PANEL      │
│  160px      │       flex-1                 │    320px            │
│             │                              │   (collapsible)     │
│ • New Chat  │  ┌──────────────────────┐   │                     │
│             │  │  Conversation title  │   │  Active Profile     │
│ Conversation│  │  + profile badge ▾   │   │  ─────────────────  │
│ history     │  └──────────────────────┘   │  Model selector     │
│ (grouped    │                              │  MCP servers list   │
│  by date)   │  Message thread              │  Skills list        │
│             │  (streamed, tool calls       │                     │
│ ─────────── │   shown as collapsible      │  ─────────────────  │
│             │   inline cards)              │  Marketplace tab    │
│ Profiles    │                              │  (browse + install  │
│ ─────────── │  ┌──────────────────────┐   │   MCP + skills)     │
│             │  │  Input               │   │                     │
│ Settings    │  │  [attach][profile▾]  │   │                     │
│             │  └──────────────────────┘   │                     │
└─────────────┴──────────────────────────────┴─────────────────────┘
```

**Key UX details:**
- Tool calls render inline as collapsible cards: MCP server name, tool name, inputs, outputs
- Profile badge on conversation header is a quick-switch dropdown
- Skills show as pills in the right panel — click to preview SKILL.md, toggle to activate/deactivate per conversation
- Right panel Marketplace tab shows registry + local servers side by side with status badges

### Tauri Event Bus

| Event | Payload | Consumer |
|---|---|---|
| `agent:token` | `{ text: string }` | Appended to message stream |
| `agent:tool_call` | `{ server, tool, input, output }` | Renders inline tool card |
| `agent:done` | `{ message_id }` | Finalizes message, saves to DB |
| `mcp:discovered` | `{ server: McpServer }` | Updates local server list live |

---

## Error Handling

A single `CoreError` enum covers all failure domains:

```rust
pub enum CoreError {
    Model(ModelError),    // API errors, rate limits, auth failures
    Mcp(McpError),        // Transport failures, tool call errors
    Skill(SkillError),    // Parse failures, missing manifests
    Db(DbError),          // SeaORM/Postgres errors
    Sync(SyncError),      // Remote DSN unreachable, conflict
    Plugin(PluginError),  // Reserved for v2
}
```

Errors serialize to JSON at the Tauri command boundary. The React UI shows human-readable messages per domain with an optional "show details" toggle for raw error output. MCP tool call failures are non-fatal — the agent loop catches them, injects the error as a tool result message, and continues without losing the conversation.

---

## Testing Strategy

**Unit tests** (`core/src/**/tests`) — each trait implementation tested with mock dependencies. `MockModelProvider` returns scripted responses, `MockMcpTransport` simulates tool calls. No Tauri or Postgres required.

**Integration tests** (`core/tests/`) — spin up `pg_embed`, run the full agent loop against a local Ollama model. Covers: profile loading, skill injection, MCP tool dispatch, message persistence.

**E2E tests** (Tauri WebDriver) — minimal, covering only critical happy paths that break silently: new chat creation, profile switch, MCP server connect, skill toggle.

---

## Out of Scope (v1)

- Dynamic plugin loading (`.so`/`.dll`) — v2
- CRDT-based sync conflict resolution — v2
- Team/org sharing of profiles and skills — v2
- Custom MCP registry hosting — v2

---

## Model Support (v1 Built-ins)

| Provider | Implementation | Transport |
|---|---|---|
| Anthropic Claude | `ClaudeProvider` | HTTPS + SSE |
| OpenAI GPT-4 | `OpenAiProvider` | HTTPS + SSE |
| Google Gemini | `GeminiProvider` | HTTPS + SSE |
| Ollama (local) | `OllamaProvider` | HTTP (localhost) |
