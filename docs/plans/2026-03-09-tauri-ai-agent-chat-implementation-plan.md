# Tauri AI Agent Chat — Implementation Plan

**Date:** 2026-03-09  
**Design doc:** `2026-03-09-tauri-ai-agent-chat-design.md`  
**Stack:** Tauri 2, Rust (Tokio, SeaORM, pg_embed), React + TypeScript, Zustand

---

## Milestones

| # | Milestone | Output |
|---|---|---|
| 1 | Project scaffold | Tauri app boots, DB migrates, CI passes |
| 2 | Model abstraction | Claude + Ollama streaming in chat UI |
| 3 | MCP integration | stdio + HTTP/SSE transports, tool calls render |
| 4 | Skills engine | SKILL.md loads, injects into system prompt |
| 5 | Agent profiles | Profiles saved, switched per-conversation |
| 6 | MCP discovery | Local scanner + registry browser working |
| 7 | Marketplace UI | Browse, install, manage MCP servers + skills |
| 8 | Sync engine | Local PG + optional remote PG sync |
| 9 | Multi-model | GPT-4 + Gemini providers added |
| 10 | Polish + E2E | Error states, WebDriver tests, auto-update |

---

## Milestone 1 — Project Scaffold

**Goal:** Tauri app boots, Postgres starts via pg_embed, migrations run, CI pipeline passes.

### Tasks

**1.1 — Initialize Tauri 2 project**
```bash
cargo create-tauri-app tauri-agent --template react-ts
```
- Configure `tauri.conf.json`: window size, title, CSP
- Add `src-tauri/core/` as a workspace member library crate
- Add `src-tauri/core-plugin-api/` as a workspace member library crate

**1.2 — Set up pg_embed**
- Add `pg_embed` to `src-tauri/Cargo.toml`
- Create `src-tauri/src/db.rs`: starts PG on app launch, stops on exit
- Store PG data directory in `app_data_dir()`

**1.3 — SeaORM migrations**
- Add `sea-orm-migration` to workspace
- Write initial migration: all tables from design doc schema
- Run via `Migrator::up()` on app start after pg_embed is ready

**1.4 — Core crate skeleton**
- `core/src/lib.rs`: re-exports all public modules
- `core/src/error.rs`: `CoreError` enum
- `core/src/registry.rs`: `Registry` struct holding `Arc<dyn Trait>` instances
- Empty trait definitions in `core/src/traits/`

**1.5 — CI pipeline**
- GitHub Actions: `cargo test`, `cargo clippy`, `cargo fmt --check`
- Frontend: `pnpm lint`, `pnpm typecheck`

**Acceptance criteria:** `cargo tauri dev` launches app, DB migrates cleanly, CI is green.

---

## Milestone 2 — Model Abstraction + Basic Chat

**Goal:** User can send a message and receive a streaming response from Claude or Ollama.

### Tasks

**2.1 — Define `ModelProvider` trait**
```rust
// core/src/traits/model.rs
#[async_trait]
pub trait ModelProvider: Send + Sync {
    fn id(&self) -> &str;
    fn display_name(&self) -> &str;
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionStream, CoreError>;
}
```
- `CompletionRequest`: messages vec, model params, system prompt, tools list
- `CompletionStream`: `impl Stream<Item = Result<StreamEvent, CoreError>>`
- `StreamEvent`: `Token(String)` | `ToolCall(ToolCallEvent)` | `Done`

**2.2 — `ClaudeProvider` implementation**
- Uses `anthropic` Rust crate or raw `reqwest` + SSE parsing
- Handles: API key from OS keychain, streaming, error mapping to `CoreError::Model`

**2.3 — `OllamaProvider` implementation**
- HTTP to `localhost:11434`
- Auto-detects available models via `/api/tags`

**2.4 — Tauri command: `agent_send_message`**
- Input: `conversation_id`, `content`, `model_id`
- Spawns Tokio task running the agent loop
- Emits `agent:token`, `agent:done` events via `app.emit()`

**2.5 — React: basic chat UI**
- Left panel: conversation list (static for now)
- Center panel: message thread + input box
- Subscribes to `agent:token` events, appends to streaming message
- No profiles or MCP yet — hardcoded model for now

**2.6 — Persist messages**
- Save user message on send, assistant message on `agent:done`
- Load conversation history on mount via `get_conversation` command

**Acceptance criteria:** User types a message, streaming response appears token by token, persists in DB.

---

## Milestone 3 — MCP Integration

**Goal:** MCP servers connect via stdio and HTTP/SSE, tool calls execute and render inline.

### Tasks

**3.1 — Define `McpTransport` trait**
```rust
#[async_trait]
pub trait McpTransport: Send + Sync {
    async fn connect(&self, config: &McpServerConfig) -> Result<McpSession, CoreError>;
}

pub struct McpSession {
    pub tools: Vec<McpTool>,
    // internal send/receive channels
}
impl McpSession {
    pub async fn call_tool(&self, name: &str, input: Value) -> Result<Value, CoreError>;
}
```

**3.2 — `StdioTransport` implementation**
- Spawns child process via `tokio::process::Command`
- Reads/writes JSON-RPC over stdin/stdout
- Implements MCP initialization handshake

**3.3 — `HttpSseTransport` implementation**
- Connects to MCP HTTP server
- Uses SSE for streaming tool responses
- Handles reconnection on disconnect

**3.4 — Agent loop: tool call dispatch**
- When model emits `StreamEvent::ToolCall`, look up MCP session by server id
- Call `session.call_tool()`, inject result as tool message
- Continue completion loop

**3.5 — Tauri command: `mcp_connect` / `mcp_disconnect`**
- Manages `McpSession` lifetime in a `HashMap<Uuid, McpSession>` in app state
- Emits `mcp:status_changed` event

**3.6 — React: inline tool call cards**
- Collapsible card component: server name, tool name, input JSON, output JSON
- Shows spinner while tool call is in flight
- Renders on `agent:tool_call` event

**Acceptance criteria:** Connect a real MCP server (e.g. `mcp-server-filesystem`), invoke a tool via chat, see result inline.

---

## Milestone 4 — Skills Engine

**Goal:** SKILL.md files load from disk or URL, active skills inject into system prompt.

### Tasks

**4.1 — Define `SkillLoader` trait + `Skill` model**
```rust
pub struct Skill {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub content_md: String, // full SKILL.md body
}

#[async_trait]
pub trait SkillLoader: Send + Sync {
    async fn load(&self, source: &SkillSource) -> Result<Skill, CoreError>;
}

pub enum SkillSource {
    LocalPath(PathBuf),
    RemoteUrl(Url),
}
```

**4.2 — `FileSystemSkillLoader` implementation**
- Reads SKILL.md, parses YAML frontmatter via `gray_matter`
- Validates required fields (name, description)

**4.3 — `RemoteSkillLoader` implementation**
- Fetches from URL via `reqwest`
- Caches to local DB (`skills` table)

**4.4 — System prompt injection**
- In agent loop: before first completion, concatenate active skills' `content_md`
- Format: each skill separated by `---`, prefixed with skill name header

**4.5 — Tauri commands: `skill_add`, `skill_remove`, `skill_list`**

**4.6 — React: skills pills in right panel**
- Toggle active/inactive per conversation
- Click pill → modal showing SKILL.md content

**Acceptance criteria:** Add a local SKILL.md, activate it, verify system prompt injection affects model behavior.

---

## Milestone 5 — Agent Profiles

**Goal:** Profiles saved in DB, selectable on new chat and switchable mid-session.

### Tasks

**5.1 — `Profile` SeaORM entity + CRUD commands**
- `profile_create`, `profile_update`, `profile_delete`, `profile_list`
- `profile_get` returns full profile with related MCP servers and skills

**5.2 — New chat flow**
- Modal on "New Chat": select profile (or "blank")
- Creates conversation with `profile_id`, loads profile config into agent loop

**5.3 — Profile badge + quick-switch**
- Dropdown on conversation header showing active profile
- Switching profile updates conversation's `profile_id`, reloads right panel

**5.4 — Profile editor UI**
- Form: name, model, model params, system prompt override
- MCP servers multi-select, skills multi-select
- Save → `profile_update` command

**Acceptance criteria:** Create two profiles with different models, switch between them mid-session, verify model changes.

---

## Milestone 6 — MCP Discovery

**Goal:** Local scanner detects running MCP servers; registry browser shows curated index.

### Tasks

**6.1 — Local scanner**
- Scan localhost ports 3000–9999 for HTTP MCP servers (send MCP `initialize` probe)
- Scan running processes for known MCP binary names (`mcp-server-*`)
- Run on app start + expose `mcp_scan` command for manual refresh
- Emit `mcp:discovered` event for each found server

**6.2 — Registry index format**
```json
{
  "servers": [{
    "id": "mcp-filesystem",
    "name": "Filesystem",
    "description": "...",
    "transport": "stdio",
    "command": "npx @modelcontextprotocol/server-filesystem",
    "config_schema": { ... }
  }]
}
```
- Host index JSON at a stable URL
- `mcp_registry_fetch` command: fetches + caches to DB

**6.3 — Unified `McpServerRegistry` in core**
- Merges local scan results + registry entries
- Deduplicates by server identity
- Exposes `list_all()` returning status per server

**Acceptance criteria:** Start a local MCP server, see it appear in the UI automatically.

---

## Milestone 7 — Marketplace UI

**Goal:** Browse and install MCP servers and skills from the right panel marketplace tab.

### Tasks

**7.1 — Marketplace tab component**
- Two sub-tabs: "MCP Servers" and "Skills"
- Each shows registry items + local discovered items
- Status badge per item: `connected` / `available` / `not running`

**7.2 — MCP server install flow**
- Click "Connect" → config form generated from `config_schema`
- Submit → `mcp_connect` command → status updates live

**7.3 — Skills marketplace**
- Remote skill index (same pattern as MCP registry)
- Click "Install" → `skill_add` with remote URL → loads + saves to DB

**7.4 — Search + filter**
- Client-side filter by name/description
- Category tags (filesystem, web, database, etc.)

**Acceptance criteria:** Browse registry, install an MCP server and a skill without leaving the app.

---

## Milestone 8 — Sync Engine

**Goal:** Optional remote Postgres sync works, DSN stored in OS keychain.

### Tasks

**8.1 — Define `SyncBackend` trait**
```rust
#[async_trait]
pub trait SyncBackend: Send + Sync {
    async fn push(&self, changeset: &Changeset) -> Result<(), CoreError>;
    async fn pull(&self) -> Result<Changeset, CoreError>;
}

pub struct Changeset {
    pub conversations: Vec<ConversationRow>,
    pub messages: Vec<MessageRow>,
    pub profiles: Vec<ProfileRow>,
    // etc.
}
```

**8.2 — Changeset diffing**
- Compare local `updated_at` vs remote `updated_at` per row
- Last-write-wins conflict resolution at v1

**8.3 — `RemotePostgresSyncBackend` implementation**
- Connects to remote DSN via SeaORM connection pool
- Push: upsert changed rows to remote
- Pull: fetch rows newer than `last_pulled_at`

**8.4 — Keychain storage**
- Store remote DSN via `tauri-plugin-stronghold` or `keyring` crate
- Never store in DB or plaintext config

**8.5 — Tauri commands: `sync_configure`, `sync_push`, `sync_pull`**

**8.6 — Settings UI: sync section**
- Input remote DSN, test connection button
- Manual sync buttons + last synced timestamp
- Toggle auto-sync on app close

**Acceptance criteria:** Configure remote PG, push conversations, pull on another machine.

---

## Milestone 9 — Multi-model (GPT-4 + Gemini)

**Goal:** All four model providers working: Claude, GPT-4, Gemini, Ollama.

### Tasks

**9.1 — `OpenAiProvider`**
- OpenAI-compatible API (`/v1/chat/completions` with streaming)
- Tool calling via OpenAI function schema → translates to/from MCP tool format

**9.2 — `GeminiProvider`**
- Google Generative AI REST API
- Maps Gemini function calling to `ToolCallEvent`

**9.3 — Model selector UI**
- Dropdown in profile editor + right panel
- Groups by provider, shows available models per provider
- Ollama: fetches live model list from local API

**9.4 — API key management**
- Settings page: one keychain entry per provider
- Validate key on entry with a test API call

**Acceptance criteria:** Switch between all four providers in a single session.

---

## Milestone 10 — Polish + E2E Tests

**Goal:** Production-quality error states, E2E tests covering critical paths, auto-update.

### Tasks

**10.1 — Error state UI**
- Per-domain error components: model errors, MCP errors, sync errors
- "Show details" toggle revealing raw `CoreError` JSON
- Toast notifications for background failures (sync, MCP disconnect)

**10.2 — Loading states**
- Skeleton loaders for conversation list, marketplace
- Streaming indicator on active message

**10.3 — WebDriver E2E tests**
- New chat creation
- Profile switch mid-session
- MCP server connect
- Skill toggle

**10.4 — Tauri auto-update**
- Configure `tauri-plugin-updater`
- GitHub Releases as update server
- Check on app start, prompt user to install

**10.5 — App icons + packaging**
- macOS `.dmg`, Windows `.msi`, Linux `.AppImage`
- Code signing setup

**Acceptance criteria:** E2E suite passes, app packages cleanly on all three platforms.

---

## Directory Structure

```
tauri-agent/
├── src/                          # React frontend
│   ├── components/
│   │   ├── chat/                 # MessageThread, MessageBubble, ToolCallCard, InputBox
│   │   ├── layout/               # ThreePanelLayout, LeftPanel, RightPanel
│   │   ├── marketplace/          # MarketplaceTab, McpServerCard, SkillCard
│   │   └── profiles/             # ProfileEditor, ProfileBadge
│   ├── store/                    # Zustand stores (conversations, profiles, mcp, skills)
│   ├── hooks/                    # useTauriEvent, useConversation, etc.
│   └── lib/                      # invoke() wrappers typed with Rust command signatures
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Tauri app entry, registers commands + plugins
│   │   ├── db.rs                 # pg_embed lifecycle
│   │   └── commands/             # One file per command group
│   ├── core/                     # Core library crate (no Tauri dependency)
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── error.rs
│   │   │   ├── registry.rs
│   │   │   ├── agent/            # Agent loop
│   │   │   ├── traits/           # ModelProvider, McpTransport, SkillLoader, SyncBackend
│   │   │   ├── providers/        # ClaudeProvider, OllamaProvider, OpenAiProvider, GeminiProvider
│   │   │   ├── mcp/              # StdioTransport, HttpSseTransport, McpSession, scanner
│   │   │   ├── skills/           # FileSystemSkillLoader, RemoteSkillLoader
│   │   │   └── sync/             # RemotePostgresSyncBackend, changeset diffing
│   │   └── tests/                # Integration tests (pg_embed + Ollama)
│   └── migration/                # SeaORM migrations
└── docs/
    └── plans/
        ├── 2026-03-09-tauri-ai-agent-chat-design.md
        └── 2026-03-09-tauri-ai-agent-chat-implementation-plan.md
```

---

## Key Dependencies

| Crate | Purpose |
|---|---|
| `tauri` v2 | App framework |
| `tokio` | Async runtime |
| `sea-orm` | ORM |
| `pg_embed` | Bundled Postgres |
| `reqwest` | HTTP client (model APIs, MCP HTTP transport) |
| `tokio-process` | stdio MCP transport (child process) |
| `eventsource-stream` | SSE parsing |
| `gray_matter` | SKILL.md frontmatter parsing |
| `keyring` | OS keychain (API keys, sync DSN) |
| `async-trait` | Trait objects with async methods |
| `uuid` | IDs everywhere |
| `serde` / `serde_json` | Serialization |
| `thiserror` | `CoreError` derive |
| `tracing` | Structured logging |

---

## Development Order Rationale

Milestones 1→5 build the core loop end-to-end: scaffold → model → MCP → skills → profiles. This gives a working, useful app by M5. Milestones 6→7 add the discovery/marketplace UX. M8 adds sync. M9 adds remaining models. M10 productionizes. Each milestone is independently shippable as an internal build.
