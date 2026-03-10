# Tauri AI Agent Chat — Design Document

**Date:** 2026-03-10
**Status:** Approved
**Audience:** Developers / power users building AI workflows

---

## Overview

A Tauri desktop application providing an AI agent chat interface with discoverable MCP servers, a skills system compatible with the [Superpowers](https://github.com/obra/superpowers) open standard, and a full branching conversation tree. Targets developers who want complete control over their agent configurations, model choices, tool integrations, and skill composition — with all data stored locally and optional cloud sync.

Superpowers compatibility is treated as an **external interoperability target**, not a built-in dependency. The app reads from the same filesystem conventions (`SKILL.md` manifests, priority-ordered skill directories) so that skills authored for Superpowers work without modification.

---

## Architecture

Three distinct layers with clean separation of concerns.

### 1. Rust Core (`src-tauri/core`)

Standalone library crate owning all business logic: agent loop, model abstraction, MCP client, skill engine, subagent orchestrator, filesystem watcher, and sync engine. Zero Tauri dependency — fully testable in isolation. Exposes an async API consumed by Tauri commands.

### 2. Tauri Shell (`src-tauri`)

Thin OS integration layer:

- Registers Tauri commands (React ↔ Rust bridge)
- Manages `pg_embed` lifecycle (bundled Postgres)
- Secure credential storage via OS keychain
- Registers built-in trait implementations into the core `Registry`
- Filesystem watcher lifecycle (via `notify` crate)
- Auto-update and native menus

### 3. React Frontend (`src`)

Pure view layer in React + TypeScript. Communicates exclusively via Tauri `invoke()` and event subscriptions. No business logic. State via Zustand.

### Data Flow

```
React UI ──invoke()──▶ Tauri command ──▶ Rust Core ──▶ [Model API / MCP / DB / FS]
         ◀──events───────────────────────────────────────────────────────────────────
```

---

## Plugin Architecture (Trait Seams)

Four traits define extensibility boundaries. All built-in implementations satisfy these traits. Dynamic loading (`.so`/`.dll`) is deferred to v2 — at v1 the Tauri shell statically registers built-ins.

```rust
#[async_trait]
pub trait ModelProvider: Send + Sync {
    fn id(&self) -> &str;
    fn display_name(&self) -> &str;
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionStream, CoreError>;
}

#[async_trait]
pub trait McpTransport: Send + Sync {
    async fn connect(&self, config: &McpServerConfig) -> Result<McpSession, CoreError>;
}

#[async_trait]
pub trait SkillLoader: Send + Sync {
    async fn load(&self, source: &SkillSource) -> Result<Skill, CoreError>;
}

#[async_trait]
pub trait SyncBackend: Send + Sync {
    async fn push(&self, changeset: &Changeset) -> Result<(), CoreError>;
    async fn pull(&self) -> Result<Changeset, CoreError>;
}
```

At v2, the shell scans `~/.config/app/plugins/` and registers dynamic implementations without changing call sites.

---

## Features

### Agent Loop

Each conversation runs an agent loop with a resolved context:

1. **Resolve skills** — merge profile skills + conversation skill overrides using the priority resolver (project > personal > superpowers > marketplace). Inject static skills into system prompt.
2. **Stream completion** via `ModelProvider::complete()`
3. **Dispatch tool calls** — built-in tools (`loadSkill`, `spawnSubagent`, `mergeSubagentResults`) handled by core; MCP tool calls dispatched to the appropriate `McpSession`
4. **Inject tool results** back into context and continue
5. **Emit events** for each token, tool call, subagent event, and completion

The loop is fully async via Tokio. Tool calls requiring user approval pause the loop and emit `agent:approval_required`.

### Skill System (Superpowers-Compatible)

Skills are directories containing `SKILL.md` with YAML frontmatter. The app is compatible with Superpowers' filesystem conventions without any dependency on the Superpowers codebase.

```yaml
---
name: my-skill
description: What this skill does and when to use it
triggers: [keyword1, keyword2]
---
# Skill content injected into system prompt
```

**Skill sources and priority order (highest to lowest):**

| Priority | Source      | Location                                                       |
| -------- | ----------- | -------------------------------------------------------------- |
| 1        | Project     | `./.skills/` relative to a configured project dir              |
| 2        | Personal    | `~/.config/app/skills/` (user-managed, Superpowers-compatible) |
| 3        | Superpowers | `~/.claude/skills/` (read-only, if Superpowers is installed)   |
| 4        | Marketplace | `app_data_dir()/marketplace-skills/` (installed via app)       |

When the same skill name appears in multiple sources, the highest-priority source wins (shadowing). The UI surfaces which version is active.

**Bundled resources:** Skills may include `scripts/` and `references/` subdirectories. The `disk_path` field on the `skills` DB record points to the root skill directory, making all bundled resources accessible to the agent via the filesystem tool.

**Two loading modes:**

- **Static (profile-level):** Skills in the active profile's skill list are injected into the system prompt at conversation start. These are "always-on" for the session.
- **Dynamic (agent-invoked):** The agent can call the built-in `loadSkill` tool mid-conversation to load any available skill into the current context. This adds it to the active session's skill list and emits a `skill:loaded` event so the UI can update.

**Filesystem watcher:** The `notify` crate watches all configured skill source directories. Any SKILL.md change (create, modify, delete) triggers an immediate rescan and DB upsert — skills updated on disk are live instantly, no app restart required.

### MCP Discovery

Two sources unified into `McpServerRegistry`:

**Local scanner** — on app start and manual refresh:

- Probes localhost ports for HTTP MCP servers (MCP `initialize` probe)
- Scans running processes for known MCP binary patterns

**Registry browser** — fetches a remotely hosted JSON index:

- Curated metadata: name, description, transport, `config_schema`
- One-click connect: form generated from `config_schema`, saved to DB

### Agent Profiles

A saved, reusable configuration:

- Model + parameters (temperature, max tokens, top_p, etc.)
- Active MCP servers (ordered)
- Active skills (ordered — determines system prompt injection order)
- Optional system prompt override
- Color + icon for visual identification in the UI

Per-conversation overrides use an additive delta: `op: add | remove` on top of the profile's defaults. Absence of an override row means inherit from profile. Overrides can be saved back as a new profile.

### Subagents (Agent-Initiated)

The agent can spawn subagents via built-in tools. Subagents are isolated agent loop instances with a forked context. They run concurrently and their results are merged back into the parent conversation as a new message (child of the spawn point in the branch tree).

```rust
// Built-in tools available to the agent loop
pub struct LoadSkill { pub name: String }

pub struct SpawnSubagent {
    pub prompt: String,
    pub profile_id: Option<Uuid>,    // optional profile override for subagent
    pub skill_names: Vec<String>,    // additional skills for subagent only
}

pub struct MergeSubagentResults {
    pub subagent_ids: Vec<Uuid>,
    pub merge_strategy: MergeStrategy, // concat | summarise | first_wins
}
```

Subagent lifecycle:

1. `SpawnSubagent` called → core creates a new `AgentSession` with forked context, assigns `subagent_id`
2. Subagent runs independently, emitting `subagent:token { subagent_id, text }` events
3. Parent loop pauses at the spawn point; UI shows subagent cards in the thread
4. `MergeSubagentResults` called → core collects outputs, applies merge strategy, injects as a new message in the parent conversation
5. Branch tree records the fork point and the merge message as distinct nodes

### Tool Approval

Destructive tool calls (configurable per MCP server and per tool) pause the agent loop and emit `agent:approval_required`. The UI shows an inline approval card with the tool name, server, and full input arguments. The user can approve (loop continues), deny (tool result injected as a refusal), or edit the input before approving.

The approval requirement is configured on `mcp_servers.requires_approval_tools: text[]` — a list of tool names that require approval for that server.

### Sync

Local Postgres (via `pg_embed`) is the source of truth. Optional remote Postgres DSN stored encrypted in OS keychain. Sync is manual-trigger or on app close. `sync_watermarks` tracks last-synced timestamp per table for efficient incremental queries. Last-write-wins on `updated_at`. No CRDT at v1.

---

## Data Model (SeaORM / PostgreSQL)

29 tables across 10 domains. Every table earns its place by powering a specific UX feature.

### Domain Map

```
CONVERSATIONS & BRANCHING     conversations, messages, tool_call_events,
                              conversation_branches
ORGANISATION                  folders, tags, conversation_tags
ATTACHMENTS                   attachments
PROMPTS                       prompts, prompt_variables
PROFILES & CONFIGURATION      profiles, profile_mcps, profile_skills
                              conversation_mcp_overrides,
                              conversation_skill_overrides,
                              conversation_model_override
MCP & SKILLS                  mcp_servers, mcp_tool_cache,
                              skills, skill_source_dirs
SUBAGENTS                     subagent_sessions
SEARCH                        message_embeddings
USAGE & ANALYTICS             usage_events, model_pricing
UI STATE                      workspace_state, conversation_ui_state
BOOKMARKS & EXPORT            bookmarks, export_jobs
SYNC                          sync_state, sync_watermarks
```

---

### Conversations & Branching

Full branching tree via parent pointers. Editing a message inserts a new node with the same `parent_id` and creates a new branch. No data is ever destroyed.

```sql
conversations
  id                uuid PK
  folder_id         uuid FK nullable
  profile_id        uuid FK nullable      -- null = no profile, bare config
  title             text                  -- auto-generated then user-editable
  title_generated   bool default false    -- true once background LLM title job ran
  pinned            bool default false
  created_at        timestamptz
  updated_at        timestamptz
  deleted_at        timestamptz nullable  -- soft delete

-- hot path: always queried by conversation + time order
CREATE INDEX messages_conversation_created
  ON messages (conversation_id, created_at);

messages
  id                uuid PK
  conversation_id   uuid FK
  parent_id         uuid FK nullable      -- null = root; tree structure for branching
  role              text                  -- user | assistant | tool_result | system
  content           text
  model_id          text nullable         -- which model produced this (assistant only)
  subagent_id       uuid FK nullable      -- set if this message was produced by a subagent
  created_at        timestamptz
  deleted_at        timestamptz nullable

-- tool calls stored in a dedicated table, not jsonb on message
-- cleaner to query, easier to index, avoids jsonb sprawl
tool_call_events
  id                uuid PK
  message_id        uuid FK              -- the assistant message that triggered this
  conversation_id   uuid FK              -- denormalized for fast querying
  mcp_server_id     uuid FK nullable     -- null for built-in tools (loadSkill, etc.)
  tool_name         text
  input_json        jsonb
  output_json       jsonb nullable       -- null until resolved
  status            text                 -- pending | running | success | error | denied
  approval_required bool default false
  started_at        timestamptz
  completed_at      timestamptz nullable

conversation_branches
  id                uuid PK
  conversation_id   uuid FK
  name              text nullable        -- user-named branch e.g. "approach A"
  tip_message_id    uuid FK             -- leaf node of this branch
  is_active         bool                -- which branch the UI is currently showing
  created_at        timestamptz
```

---

### Organisation

```sql
folders
  id                uuid PK
  parent_id         uuid FK nullable     -- null = root folder
  name              text
  color             text nullable        -- hex
  position          int                  -- manual sort order within parent
  created_at        timestamptz
  updated_at        timestamptz

tags
  id                uuid PK
  name              text UNIQUE
  color             text nullable
  created_at        timestamptz

conversation_tags
  conversation_id   uuid FK
  tag_id            uuid FK
  PRIMARY KEY (conversation_id, tag_id)
```

---

### Attachments

Files on disk, metadata in DB. `checksum` enables deduplication and sync integrity.

```sql
attachments
  id                uuid PK
  message_id        uuid FK nullable
  prompt_id         uuid FK nullable
  filename          text
  disk_path         text                 -- absolute path under app_data_dir()
  mime_type         text
  size_bytes        bigint
  checksum          text                 -- sha256
  created_at        timestamptz
```

---

### Prompt Library

Full template engine with typed variable definitions. `prompt_variables` drives a fill-in form before inserting into the input box.

```sql
prompts
  id                uuid PK
  folder_id         uuid FK nullable
  name              text
  description       text nullable
  content           text                 -- template with {{variable}} placeholders
  model_id          text nullable
  profile_id        uuid FK nullable
  use_count         int default 0
  created_at        timestamptz
  updated_at        timestamptz

prompt_variables
  id                uuid PK
  prompt_id         uuid FK
  name              text                 -- matches {{name}} in template
  type              text                 -- text | number | select | file
  default_value     text nullable
  options           jsonb nullable       -- for type=select
  required          bool default true
  position          int
```

---

### Profiles & Configuration

`conversation_model_override` is a separate table — absence of a row means "inherit from profile", no nullable sprawl. Overrides use `op: add | remove` delta so the profile remains the canonical source of truth.

```sql
profiles
  id                uuid PK
  name              text
  description       text nullable
  model_id          text
  model_params      jsonb                -- { temperature, max_tokens, top_p, ... }
  system_prompt     text nullable
  color             text nullable        -- hex, for profile badge chip
  icon              text nullable        -- emoji or icon name
  is_default        bool default false
  created_at        timestamptz
  updated_at        timestamptz

profile_mcps
  profile_id        uuid FK
  mcp_server_id     uuid FK
  position          int
  PRIMARY KEY (profile_id, mcp_server_id)

profile_skills
  profile_id        uuid FK
  skill_id          uuid FK
  position          int                  -- system prompt injection order
  PRIMARY KEY (profile_id, skill_id)

conversation_mcp_overrides
  conversation_id   uuid FK
  mcp_server_id     uuid FK
  op                text                 -- add | remove
  PRIMARY KEY (conversation_id, mcp_server_id)

conversation_skill_overrides
  conversation_id   uuid FK
  skill_id          uuid FK
  op                text                 -- add | remove
  PRIMARY KEY (conversation_id, skill_id)

conversation_model_override
  conversation_id   uuid PK FK
  model_id          text
  model_params      jsonb
  system_prompt     text nullable
```

---

### MCP Servers & Skills

`mcp_tool_cache` stores tool schemas to avoid re-fetching on every agent loop start and to power the tool browser UI. `skill_source_dirs` owns the priority-ordered list of skill directories — the source of truth for the resolver and the filesystem watcher.

```sql
mcp_servers
  id                      uuid PK
  name                    text
  description             text nullable
  transport               text             -- stdio | sse
  config_json             jsonb            -- command+args or url
  source                  text             -- local | registry | manual
  registry_id             text nullable
  icon_url                text nullable
  requires_approval_tools text[]           -- tool names that need user approval
  last_seen_at            timestamptz nullable
  created_at              timestamptz
  updated_at              timestamptz

mcp_tool_cache
  id                uuid PK
  mcp_server_id     uuid FK
  tool_name         text
  tool_schema       jsonb
  last_synced_at    timestamptz
  UNIQUE (mcp_server_id, tool_name)

skills
  id                uuid PK
  name              text
  description       text
  source            text                   -- local | personal | superpowers | marketplace
  disk_path         text nullable          -- root dir of skill (for bundled scripts/refs)
  source_url        text nullable          -- remote origin, for update checks
  manifest_json     jsonb                  -- parsed frontmatter
  content_md        text                   -- SKILL.md body
  version           text nullable
  checksum          text nullable          -- sha256 of content_md, for change detection
  is_shadowed       bool default false     -- true if a higher-priority skill has same name
  shadowed_by_id    uuid FK nullable       -- the skill that shadows this one
  last_fetched_at   timestamptz nullable
  created_at        timestamptz
  updated_at        timestamptz

-- priority-ordered list of skill source directories
-- drives both the resolver and the filesystem watcher
skill_source_dirs
  id                uuid PK
  path              text                   -- absolute filesystem path
  source_type       text                   -- project | personal | superpowers | marketplace
  priority          int                    -- lower = higher priority; user can reorder
  watch_enabled     bool default true      -- whether notify watcher is active
  last_scanned_at   timestamptz nullable
  created_at        timestamptz
```

---

### Subagents

```sql
subagent_sessions
  id                uuid PK
  parent_conversation_id  uuid FK
  spawn_message_id  uuid FK              -- the message that triggered the spawn
  merge_message_id  uuid FK nullable     -- the message created on merge (null until merged)
  prompt            text                 -- the task given to the subagent
  profile_id        uuid FK nullable
  status            text                 -- running | done | failed | merged
  merge_strategy    text nullable        -- concat | summarise | first_wins
  output            text nullable        -- final output before merge
  created_at        timestamptz
  completed_at      timestamptz nullable
  merged_at         timestamptz nullable
```

---

### Semantic Search

Embeddings generated async after each assistant message — never blocks the agent loop. `ivfflat` index for fast approximate nearest-neighbour search.

```sql
-- requires: CREATE EXTENSION vector;
message_embeddings
  id                uuid PK
  message_id        uuid FK UNIQUE
  embedding         vector(1536)          -- nomic-embed-text / OpenAI dims
  model_id          text
  created_at        timestamptz

CREATE INDEX message_embeddings_ivfflat
  ON message_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

### Usage & Analytics

Append-only event log. `model_pricing` preserves historical pricing via `valid_from`/`valid_until` so cost estimates stay accurate after price changes. Cache token fields are first-class for Anthropic prompt caching analytics.

```sql
usage_events
  id                    uuid PK
  conversation_id       uuid FK nullable
  message_id            uuid FK nullable
  subagent_id           uuid FK nullable  -- set if usage from a subagent
  model_id              text
  provider              text
  input_tokens          int
  output_tokens         int
  cache_read_tokens     int default 0
  cache_write_tokens    int default 0
  cost_usd              numeric(12,8)
  latency_ms            int               -- time to first token
  total_ms              int
  created_at            timestamptz

model_pricing
  id                    uuid PK
  model_id              text
  provider              text
  input_cost_per_1k     numeric(12,8)
  output_cost_per_1k    numeric(12,8)
  cache_read_cost_per_1k  numeric(12,8) default 0
  cache_write_cost_per_1k numeric(12,8) default 0
  valid_from            timestamptz
  valid_until           timestamptz nullable
  UNIQUE (model_id, valid_from)
```

---

### UI State

`workspace_state` is a single upserted row — cheap to write on every panel resize. `input_draft` preserves unsent content when switching between conversations.

```sql
workspace_state
  id                        uuid PK default gen_random_uuid()
  active_conversation_ids   uuid[]
  focused_conversation_id   uuid nullable
  left_panel_width          int default 160
  right_panel_width         int default 320
  right_panel_collapsed     bool default false
  left_panel_collapsed      bool default false
  updated_at                timestamptz

conversation_ui_state
  conversation_id           uuid PK FK
  scroll_position           int default 0
  active_branch_id          uuid FK nullable
  input_draft               text nullable
  updated_at                timestamptz
```

---

### Bookmarks & Export

```sql
bookmarks
  id                uuid PK
  message_id        uuid FK
  note              text nullable
  created_at        timestamptz

export_jobs
  id                uuid PK
  conversation_id   uuid FK
  format            text                 -- markdown | pdf | json
  status            text                 -- pending | complete | failed
  output_path       text nullable
  created_at        timestamptz
  completed_at      timestamptz nullable
```

---

### Sync

```sql
sync_state
  id                uuid PK default gen_random_uuid()
  last_pushed_at    timestamptz nullable
  last_pulled_at    timestamptz nullable
  auto_sync         bool default false
  updated_at        timestamptz

sync_watermarks
  table_name        text PK
  last_synced_at    timestamptz
```

---

## Frontend Layout

### Three-Panel Shell

```
┌───────────────┬─────────────────────────────────┬──────────────────────┐
│  LEFT PANEL   │        CENTER PANEL             │    RIGHT PANEL       │
│  200px        │        flex-1                   │    300px             │
│  (resizable)  │                                 │    (collapsible)     │
│               │  ┌─────────────────────────┐   │                      │
│  [⌘K Search]  │  │  Title (editable)       │   │  ── SESSION ──       │
│               │  │  Profile badge ▾  [⋯]   │   │  Model  [claude ▾]   │
│  ── TODAY ──  │  └─────────────────────────┘   │                      │
│  conv title   │                                 │  MCP Servers         │
│  conv title   │  Message thread                 │  ● filesystem  [×]   │
│               │  (branch nav inline)            │  ● github      [×]   │
│  ── YESTERDAY │                                 │  [+ Add]             │
│  conv title   │                                 │                      │
│               │  Subagent cards                 │  Skills              │
│  ── FOLDERS ──│  (inline, expandable)           │  ◉ code-review [×]   │
│  📁 Work      │                                 │  ○ sql-expert  [×]   │
│  📁 Research  │  Tool call cards                │  [+ Add]             │
│               │  (inline, collapsible)          │                      │
│  ── TAGS ──   │                                 │  ── OVERRIDES ──     │
│  #rust  #ux   │  ┌─────────────────────────┐   │  (delta from profile)│
│               │  │  /  @  📎  [draft...]   │   │                      │
│  ── ──────── ─│  │  [Shift+↵ = newline]    │   │                      │
│  + New Chat   │  │  [↵ = send]  [⌘↵ = alt] │   │                      │
│  Profiles     │  └─────────────────────────┘   │                      │
│  Settings     │                                 │                      │
└───────────────┴─────────────────────────────────┴──────────────────────┘
```

The Marketplace and Settings are **full-screen overlays**, not tabs inside the right panel. This keeps the right panel focused on the active session and prevents the 5-concerns-in-320px problem.

---

### Input Box

The input box is the highest-frequency surface in the app. It deserves a full spec.

| Trigger               | Behaviour                                               |
| --------------------- | ------------------------------------------------------- |
| `↵`                   | Send message                                            |
| `Shift+↵`             | New line                                                |
| `/` at line start     | Open prompt library picker (fuzzy search by name)       |
| `@`                   | Open mention picker: skills, MCP tools, conversations   |
| `📎` or drag-and-drop | Attach file — opens native file picker or accepts drop  |
| `⌘K`                  | Global search overlay                                   |
| `⌘↵`                  | Send with model override (quick picker)                 |
| `↑` (empty input)     | Edit last user message                                  |
| `⌘Z`                  | Undo last send (only if assistant hasn't responded yet) |

Selecting a prompt from `/` opens the variable fill-in form if the prompt has variables. After filling, the resolved text is inserted into the input box — not sent directly.

`@skill-name` inserts a dynamic `loadSkill` instruction that the agent will execute, not a static injection.

---

### Branch Navigation

Branch navigation is inline in the message thread, at the point where branches diverge:

```
  [user message]
       │
  ┌────┴─────────────────────────────┐
  │  ◀  Branch 1 of 3: "approach A" ▶ │   ← inline nav at divergence point
  └────┬─────────────────────────────┘
       │
  [assistant response for this branch]
```

The `< 1/3 >` navigator appears on the message immediately after the edit point. Clicking `▶` switches the active branch (updates `conversation_ui_state.active_branch_id` and re-renders the thread from that point down). Users can name branches via the `[⋯]` menu on the conversation header.

---

### Subagent Cards

Subagents appear inline in the parent thread at the spawn point, not as separate columns:

```
  ┌─────────────────────────────────────────────┐
  │  🤖 Subagent: "Write the test suite"        │
  │  ● Running...                    [Cancel]   │
  │  ▼ Show output                              │
  └─────────────────────────────────────────────┘
```

When complete:

```
  ┌─────────────────────────────────────────────┐
  │  🤖 Subagent: "Write the test suite"   ✓    │
  │  ▼ Show full output   [Merge] [Discard]     │
  └─────────────────────────────────────────────┘
```

Merge inserts the subagent output as a new message (child of the spawn point in the branch tree) and calls `MergeSubagentResults` in the core.

---

### Tool Approval Cards

When `agent:approval_required` fires, the thread pauses and shows:

```
  ┌─────────────────────────────────────────────┐
  │  ⚠️  Tool approval required                  │
  │  Server: filesystem   Tool: delete_file     │
  │  Input: { "path": "/home/user/important" }  │
  │  [Edit input]   [Deny]   [Approve ↵]        │
  └─────────────────────────────────────────────┘
```

"Edit input" opens the JSON inline for modification before approving.

---

### Search Overlay (`⌘K`)

Full-screen overlay with two modes:

**Navigation mode** (default): fuzzy search across conversation titles, folder names, profile names. Keyboard-navigable list.

**Semantic search mode** (toggle or after short pause): fires vector similarity search, returns result cards:

```
  ┌─────────────────────────────────────────────┐
  │  "how does the skill resolver work"         │
  │  ──────────────────────────────────────── │
  │  📄 Tauri agent design discussion    94%   │
  │     "...the priority resolver checks       │
  │      project > personal > superpowers..."  │
  │     2026-03-09  #rust  #architecture       │
  │                                             │
  │  📄 MCP debugging session            87%   │
  │     "...skill shadowing means the first... │
  └─────────────────────────────────────────────┘
```

---

### Marketplace Overlay

Full-screen overlay, three tabs: **MCP Servers**, **Skills**, **Skill Sources**.

**MCP Servers tab:** registry items + locally detected servers side by side. Status badges: `connected` / `available` / `not running`. One-click connect with auto-generated config form.

**Skills tab:** marketplace skill index + locally installed skills. Click to preview SKILL.md content before installing. Install = clone git repo or download tarball into the personal skills directory. The filesystem watcher picks it up immediately.

**Skill Sources tab:** drag-reorderable list of `skill_source_dirs`. Shows path, source type, priority, last scanned time, and skill count. Users can add/remove directories and toggle the filesystem watcher per directory. When a skill is shadowed, a warning badge shows which higher-priority skill is overriding it.

---

### Settings Overlay

Sections: **API Keys**, **Skill Sources** (shortcut to the Marketplace tab), **Sync**, **Model Pricing**, **Appearance**.

**API Keys:** one entry per provider (Anthropic, OpenAI, Google, Ollama base URL). Stored in OS keychain. Validate button fires a test completion. Status indicator per provider.

**Sync:** remote Postgres DSN input, test connection button, last synced timestamp, manual push/pull buttons, auto-sync toggle.

**Model Pricing:** table of `model_pricing` entries, editable. Users can override pricing for models not in the default list or correct stale pricing.

---

### Onboarding (First Run)

Shown when no API key is configured:

```
Step 1/3: Add an API key
  [Anthropic]  [OpenAI]  [Google]  [Ollama local]
  Enter key: [_______________] [Validate]

Step 2/3: Create your first profile
  Name: [_______________]
  Model: [claude-sonnet-4-6 ▾]
  [Create profile]

Step 3/3: You're ready
  [Start chatting →]
```

Each step is skippable. After step 3 the app opens a new conversation with the created profile pre-selected.

---

## Tauri Event Bus

| Event                     | Payload                                       | Consumer                              |
| ------------------------- | --------------------------------------------- | ------------------------------------- |
| `agent:token`             | `{ conversation_id, text }`                   | Appended to message stream            |
| `agent:tool_call`         | `{ tool_call_event_id, server, tool, input }` | Renders inline tool card              |
| `agent:tool_result`       | `{ tool_call_event_id, output, status }`      | Updates tool card                     |
| `agent:approval_required` | `{ tool_call_event_id }`                      | Renders approval card, pauses UI      |
| `agent:done`              | `{ conversation_id, message_id }`             | Finalizes message                     |
| `agent:error`             | `{ conversation_id, error }`                  | Shows error state                     |
| `subagent:spawned`        | `{ subagent_id, parent_conversation_id }`     | Renders subagent card                 |
| `subagent:token`          | `{ subagent_id, text }`                       | Updates subagent card output          |
| `subagent:done`           | `{ subagent_id }`                             | Shows merge/discard actions           |
| `subagent:merged`         | `{ subagent_id, message_id }`                 | Inserts merged message                |
| `skill:loaded`            | `{ conversation_id, skill_name }`             | Updates skills pill list              |
| `skill:scan_complete`     | `{ dir_path, added, updated, removed }`       | Refreshes skill library               |
| `mcp:discovered`          | `{ server }`                                  | Updates local server list             |
| `title:generated`         | `{ conversation_id, title }`                  | Updates conversation title in sidebar |

---

## Error Handling

```rust
pub enum CoreError {
    Model(ModelError),       // API errors, rate limits, auth failures
    Mcp(McpError),           // Transport failures, tool call errors
    Skill(SkillError),       // Parse failures, missing manifests, scan errors
    Db(DbError),             // SeaORM/Postgres errors
    Sync(SyncError),         // Remote unreachable, conflict
    Subagent(SubagentError), // Spawn failures, merge errors
    Io(IoError),             // Filesystem errors (skill dirs, attachments)
    Plugin(PluginError),     // Reserved for v2
}
```

Errors serialize to JSON at the Tauri command boundary. UI shows human-readable messages with an optional "show details" toggle. MCP tool call failures are non-fatal — the error is injected as a tool result and the loop continues.

---

## Testing Strategy

**Unit tests** (`core/src/**/tests`) — mock dependencies for each trait. `MockModelProvider` returns scripted responses; `MockMcpTransport` simulates tool calls; `MockSkillLoader` returns canned skills. No Tauri or Postgres required.

**Integration tests** (`core/tests/`) — `pg_embed` + local Ollama. Covers: profile loading, skill priority resolution, MCP tool dispatch, subagent spawn + merge, message persistence, branching.

**E2E tests** (Tauri WebDriver) — minimal, critical happy paths only: new chat creation, profile switch, MCP connect, skill toggle, branch navigation, subagent spawn.

---

## Out of Scope (v1)

- Dynamic plugin loading (`.so`/`.dll`) — v2
- CRDT-based sync conflict resolution — v2
- Team/org sharing of profiles and skills — v2
- Custom MCP registry hosting — v2
- Git pull for skill updates — v2

---

## Model Support (v1 Built-ins)

| Provider         | Implementation   | Transport        |
| ---------------- | ---------------- | ---------------- |
| Anthropic Claude | `ClaudeProvider` | HTTPS + SSE      |
| OpenAI GPT-4     | `OpenAiProvider` | HTTPS + SSE      |
| Google Gemini    | `GeminiProvider` | HTTPS + SSE      |
| Ollama (local)   | `OllamaProvider` | HTTP (localhost) |

---

## Superpowers Compatibility Summary

| Superpowers Feature                                    | Support | Notes                                                   |
| ------------------------------------------------------ | ------- | ------------------------------------------------------- |
| Flat skill directory (`SKILL.md` + frontmatter)        | ✅ Full | Same format, same filesystem conventions                |
| Discovery via `~/.claude/skills/`                      | ✅ Full | Scanned as `superpowers` priority source                |
| Dynamic skill loading (`loadSkill` tool)               | ✅ Full | Built-in tool in agent loop                             |
| Subagent dispatch                                      | ✅ Full | `spawnSubagent` / `mergeSubagentResults` built-in tools |
| Script execution                                       | ✅ Full | `disk_path` gives agent access to `scripts/` dir        |
| Priority resolution (project > personal > superpowers) | ✅ Full | `skill_source_dirs` table + resolver                    |
| Skill updates via git pull                             | 🔜 v2   | `source_url` stored for future update checks            |
| Marketplace install (git clone / tarball)              | ✅ Full | Installs into personal skills dir, watcher picks up     |
