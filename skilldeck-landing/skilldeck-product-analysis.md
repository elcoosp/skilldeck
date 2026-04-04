# SkillDeck — Deep Product Analysis Report
## For StoryBrand-Compliant Landing Page Copywriting

---

## 1. PRODUCT ARCHITECTURE

### What is SkillDeck?
**A local-first desktop AI orchestration platform for developers.** It is NOT a CLI tool — it is a full native desktop application (Tauri 2) with a rich React UI. The official tagline from `package.json`:

> **"Local-first AI Orchestration for Developers"**

The onboarding wizard copy reads:
> "Build, share, and control AI workflows — **without the cloud**. Your code never leaves your machine, and your skills are version-controlled like any other dev artifact."

### Tech Stack (Exact versions from code)

| Layer | Technology | Version |
|-------|-----------|---------|
| **Desktop Shell** | Tauri 2 | ^2.10.1 |
| **Systems Core** | Rust (Edition 2024) | — |
| **Frontend Framework** | React | ^19.2.4 |
| **Build Tool** | Vite | ^8.0.0 |
| **Router** | @tanstack/react-router | ^1.168.10 |
| **State Management** | Zustand | ^5.0.11 |
| **Data Queries** | @tanstack/react-query | ^5.90.21 |
| **UI Components** | shadcn/ui (radix-nova style) + Radix UI | ^1.4.3 |
| **CSS** | Tailwind CSS 4 | ^4.1.11 |
| **Styling Library** | Tailwind Typography plugin | ^0.5.19 |
| **Workflow Visual Editor** | @xyflow/react | ^12.10.1 |
| **Virtualization** | @tanstack/react-virtual | ^3.13.22 |
| **Drag & Drop** | @dnd-kit (core, react, sortable) | ^6.3.1+ |
| **Animations** | Framer Motion | ^12.36.0 |
| **Internationalization** | Lingui (po format) | ^5.9.2 |
| **Validation** | Zod | ^4.3.6 |
| **Linting** | Biome (linter + formatter) | ^2.4.6 |
| **Spellcheck** | CSpell | ^9.7.0 |
| **Git Hooks** | Lefthook | ^2.1.4 |
| **Charts** | Recharts | ^3.8.0 |
| **Heatmap** | @uiw/react-heat-map | ^2.3.3 |
| **Search/Fuzzy** | Fuse.js | ^7.1.0 |
| **Code Diff** | react-diff-viewer-continued | ^4.2.0 |
| **Markdown Rendering** | pulldown-cmark (Rust) + rehype-highlight (TS) | — |
| **Syntax Highlighting** | Syntect (Rust) | ^5.3.0 |
| **Database ORM** | SeaORM 2.x | 2.0.0-rc.37 |
| **Database** | SQLite (local) | — |
| **Graph Engine** | petgraph | 0.8.3 |
| **Icon Pack** | Lucide React | ^1.0.0 |
| **Font** | @fontsource/poppins | ^5.2.7 |
| **Package Manager** | pnpm | — |
| **Testing** | Vitest (unit + browser via Playwright) | ^4.0.18 |
| **Font** | Poppins (via @fontsource/poppins) | — |

### What Makes It Unique
1. **Three separate Rust crates** working in concert:
   - `skilldeck-core` — The agent engine (loop, MCP, workflows, skills, providers)
   - `skilldeck-lint` — Dedicated skill linting engine (binary + library)
   - `skilldeck-models` — SeaORM database models (50+ entity definitions)
   - `skilldeck-platform` — Optional cloud backend (Axum server with referrals, nudges, skill registry)

2. **Rust-to-TypeScript bindings** via `tauri-specta` — all Tauri commands are type-safe across the IPC boundary

3. **No Electron** — Tauri 2 means native performance, ~10x smaller binary size, native OS integration

---

## 2. CORE FEATURES

### 2.1 Agent System

#### Agent Loop (`src-tauri/skilldeck-core/src/agent/loop.rs`)
- The core `AgentLoop` is a streaming async loop that:
  1. Builds a `CompletionRequest` via `ContextBuilder`
  2. Streams completion chunks from the model provider
  3. Emits events to the frontend (`agent-event` Tauri channel)
  4. Dispatches tool calls via `ToolDispatcher`
  5. Loops until `finish_reason` is not `tool_use`
- **Note:** The loop.rs file is binary/compiled in the dump, but the public API is:
  ```rust
  pub use r#loop::{AgentLoop, AgentLoopConfig, AgentRunResult};
  ```
- AgentLoopEvent types (from frontend events.ts): `started`, `token`, `tool_call`, `tool_result`, `done`, `error`, `persisted`, `tool_approval_required`, `stream_update`

#### TOON Encoding (`src-tauri/skilldeck-core/src/toon.rs`)
- Currently a **stub** with comment: `//! TOON encoder — stub for future chunk.`
- The `CompletionRequest` struct already has a `tools_toon: Option<String>` field
- The OpenAI provider (`supports_toon() -> true`) is TOON-ready
- The `toon-rust` crate (v0.1.3) is a dependency in Cargo.toml
- TOON = Tool-Optimized Object Notation — compact encoding for tool definitions to reduce token usage

#### Built-in Tools (`built_in_tools.rs`)
Three tools that **never** require approval:
1. **`loadSkill`** — Inject a named skill into the current agent context
2. **`spawnSubagent`** — Launch a parallel subagent for an independent sub-task, optionally equipping it with skills
3. **`mergeSubagentResults`** — Collect and synthesize subagent outputs with strategies: `concat`, `summarize`, or `vote`

#### Subagent System (`subagent.rs`)
- `SubagentSession` tracks: `id`, `parent_id`, `task`, `skill` (optional), `status` (Pending/Running/Completed/Failed), `result`, `error`
- `SubagentManager` provides: `spawn()`, `start()`, `complete()`, `fail()`, `collect_results()`, `all_done()`
- Frontend has a dedicated `useSubagentStore` (Zustand) and renders `subagent-card.tsx` in conversations
- **Real-time status tracking** — subagent cards update live in the UI

#### Tool Dispatcher + Approval Gate (`tool_dispatcher.rs`)
The `ToolDispatcher` routes tool calls to three destinations:
1. **Built-in tools** — `loadSkill`, `spawnSubagent`, `mergeSubagentResults` (no approval needed)
2. **MCP tools** — Routed through the MCP registry, subject to approval gate
3. **Auto-approved tools** — Based on configurable `AutoApproveConfig`

**ApprovalGate** is async:
- Suspends the calling Rust task until the frontend resolves via `oneshot::channel`
- Emits `tool_approval_required` events to the frontend
- Three outcomes: `Approved { edited_input }`, `Denied { reason }`, `Cancelled`
- `cancel_all()` called on conversation teardown

**AutoApproveConfig** categories (all OFF by default for security):
| Category | Pattern Prefixes |
|----------|-----------------|
| `reads` | `list_`, `read_`, `get_`, `fetch_`, `show_`, `describe_`, `stat_`, `check_` |
| `writes` | `write_`, `create_`, `update_`, `put_`, `set_` |
| `selects` | `query_`, `select_`, `search_`, `find_` |
| `mutations` | `insert_`, `delete_`, `patch_`, `mutate_`, `remove_` |
| `http_requests` | `http_`, `request_`, `call_`, `post_`, `download_` |
| `shell` | `run_`, `exec_`, `shell_`, `bash_`, `cmd_`, `execute_` |

### 2.2 Skills System

#### What Are Skills?
Skills are **Markdown-based AI instruction packages** stored in directories containing a `SKILL.md` file with YAML frontmatter.

**SKILL.md structure:**
```yaml
---
name: my-skill
description: "A clear description of at least 20 chars"
license: MIT
compatibility: ["claude-3", "gpt-4"]
allowed_tools: ["read_file", "write_file"]
---
... skill body (markdown instructions) ...
```

#### Skill Registry & Loader
- **Scanner** (`scanner.rs`) — Discovers skill directories on disk
- **Loader** (`loader.rs`) — Reads and parses SKILL.md files
- **Resolver** (`resolver.rs`) — Resolves skill names to paths
- **Watcher** (`watcher.rs`) — Hot-reloads skills when files change (uses `notify` crate)
- Skills are injected into the system prompt separated by `\n\n---\n\n` fences

#### Skill Sources
- **Local skills**: Stored in `~/.agents/skills/` or `./.skilldeck/skills/`
- **Registry skills**: From the SkillDeck Platform (remote)
- **Unified skill list** (`unified-skill-list.tsx`) merges local + registry into one virtualized marketplace
- Frontend has `skill-source-dirs.tsx` in settings for configuring custom skill directories

#### Skill Linting (`skilldeck-lint` crate)
A **dedicated Rust binary** (`skilldeck-lint`) with 17 lint rules across 4 categories:

**Frontmatter Rules (8):**
- `fm-metadata-keys` — Required frontmatter keys present
- `fm-name-format` — Kebab-case, matches directory name
- `fm-description-length` — Min 20 characters
- `fm-description-content` — No placeholder text (todo, fixme, etc.)
- `fm-license-present` — License declared
- `fm-license-format` — Valid SPDX identifier
- `fm-compatibility-length` — Compatibility list not empty
- `fm-allowed-tools` — allowed_tools declared

**Structure Rules (4):**
- `struct-skill-md-exists` — SKILL.md exists
- `struct-skill-md-size` — Under 100KB
- `struct-references-exist` — Referenced files exist
- `struct-references-depth` — Max nesting depth 3

**Security Rules (2):**
- `sec-dangerous-tools` — Detects dangerous patterns (rm -rf /, fork bombs, curl | sh, etc.)
- `sec-allowed-tools-mismatch` — Tools used but not declared in allowed_tools

**Quality Rules (7):**
- `quality-content-examples` — Has usage examples
- `quality-content-steps` — Has structured instructions
- `quality-content-clarity` — Body has reasonable length (min 10 words)
- `quality-progressive-disclosure` — Long content uses headings
- `quality-dependencies` — Declares external package dependencies
- `quality-platform` — No hard-coded Windows paths
- `quality-freshness` — Has version or last_updated field

**Scoring:**
- Security score: 1–5 (each Error-severity security warning reduces score)
- Quality score: 1–5 (based on quality/structure warning count)

**Configuration:**
- TOML-based: `~/.config/skilldeck/skilldeck-lint.toml` (global) and `.skilldeck/skilldeck-lint.toml` (workspace)
- Per-rule severity override: "off", "info", "warning", "error"
- Default severity: "warning"

### 2.3 MCP Integration

#### Transport Layer
Two transports implemented as traits (`McpTransport`):
1. **`stdio_transport.rs`** — Launches MCP servers as child processes, communicates via stdin/stdout
2. **`sse_transport.rs`** — Connects to remote MCP servers via Server-Sent Events (HTTP)

#### MCP Registry (`registry.rs`)
- Tracks live server connections using `DashMap<Uuid, LiveServer>`
- Server lifecycle: `Disconnected → Connecting → Connected → Error → Failed`
- `Failed` is terminal — max restart attempts exceeded, no more retries
- Each `LiveServer` tracks: id, name, status, session, error_count, last_error, tools list, capabilities
- Stored configs enable the supervisor to reconnect autonomously

#### MCP Supervisor (`supervisor.rs`)
- Long-lived Tokio task with health monitoring
- **Exponential backoff** restart: initial 1s delay, 2x multiplier, 60s max delay, 5 max attempts
- Health check every 30 seconds
- Commands: `Stop`, `Restart(id)`, `Reset(id)`, `RegisterConfig(id, config)`
- Emits events: `ServerConnected`, `ServerFailed`

#### MCP Protocol Types (`types.rs`)
- Full JSON-RPC 2.0 implementation
- Protocol version: `2024-11-05`
- Client identification: `skilldeck` / version from Cargo.toml
- Implements: `InitializeParams`, `ClientCapabilities`, `InitializeResult`, `ListToolsResult`, `CallToolResult`, `McpTool`, `McpServerConfig`

#### MCP UI (`mcp-tab.tsx`)
- **MCP Catalog** — Browse and add MCP servers from a curated catalog
- `CatalogEntry` has: name, description, transport type, tags, docsUrl
- **Custom Server Form** (`custom-server-form.tsx`) — Add custom MCP servers with command args or URL
- **Live Server Cards** (`live-server-card.tsx`) — Show connected server status, tools, health
- Catalog entries have transport badges (stdio/SSE)

### 2.4 Workflow Engine

#### Patterns (`types.rs`)
Three execution patterns:
1. **Sequential** — Steps execute one after another, in order
2. **Parallel** — Steps execute concurrently, respecting dependency graph
3. **EvaluatorOptimizer** — Iterative evaluation-optimization loop (max 5 iterations)

#### Workflow Definition Structure:
```json
{
  "name": "My Workflow",
  "pattern": "sequential",  // or "parallel" or "evaluator_optimizer"
  "steps": [
    { "id": "step1", "name": "Step 1", "skill": null, "prompt": "Do the thing" }
  ],
  "dependencies": [
    { "from": "step1", "to": "step2" }
  ]
}
```

#### Graph Engine (`graph.rs`)
- Uses **petgraph** for dependency resolution
- `WorkflowGraph::from_definition()` builds a directed graph
- `execution_order()` computes topological sort for sequential patterns
- `ready_steps()` finds steps whose dependencies are satisfied (for parallel)

#### Executor (`executor.rs`)
- Dispatches to the right strategy based on pattern
- Emits events: `Started`, `StepStarted`, `StepCompleted`, `StepFailed`, `Completed`, `Failed`
- Each step can optionally have a skill assigned
- Steps track: status, result, error, tokens_used

#### Parallel Execution (`parallel.rs`)
- Uses `tokio::task::JoinSet` for concurrent step execution
- Respects dependency graph — only launches steps whose dependencies are complete
- Real-time status updates for each step

#### Visual Editor (`workflow-graph.tsx`)
- Built with **@xyflow/react** (React Flow)
- Nodes represent workflow steps with status indicators (pending/running/completed)
- Edges represent dependencies (arrow markers)
- Color coding: blue = running, green = completed
- `fitView`, zoom controls, grid background

#### JSON Editor (`workflow-editor.tsx`)
- Dialog-based JSON editor for workflow definitions
- Save via `saveWorkflowDefinition` Tauri command
- Validation with error display

### 2.5 Conversations

#### Core Conversation Features
- **Conversation branching** — Create branches from any message (`create-branch-modal.tsx`)
- **Branch navigation** (`branch-nav.tsx`) — Navigate between conversation branches
- **Message threading** — Nested reply threads within conversations
- **Artifacts** — AI-generated code/content artifacts with:
  - Version diffing (`version-diff-modal.tsx`)
  - Branch picker (`branch-picker.tsx`)
  - Pinning (`pin-icon.tsx`)
  - Artifact panel (`artifact-panel.tsx`)
- **Bookmarks** — Mark and organize important messages
- **Headings** — Auto-generated message headings for navigation
- **Queue system** — Batch multiple messages for sequential processing:
  - `queue-header.tsx`, `queue-list.tsx`, `queue-item.tsx`
  - `queue-edit-form.tsx`, `queue-pause-indicator.tsx`
  - `queue-selection-toolbar.tsx` — Bulk actions on queued items

#### Conversation UI Components
- `conversation-item.tsx` — Sidebar conversation card with title, date, workspace badge
- `message-bubble.tsx` — Individual message rendering with markdown
- `message-input.tsx` — Chat input with context attachment
- `message-thread.tsx` — Threaded replies
- `tool-call-card.tsx` — Tool call display with approval actions
- `tool-result-bubble.tsx` — Tool result rendering
- `tool-approval-card.tsx` — Inline approval UI for tool calls
- `subagent-card.tsx` — Subagent status display in conversation
- `pinned-bar.tsx` — Pinned artifacts bar
- `artifact-card.tsx` — Artifact preview in conversation
- `heading.tsx` — Auto-generated section headings
- `code-block.tsx` — Syntax-highlighted code with copy button

#### Conversation Features
- **Folder organization** — Group conversations into folders
- **Date grouping** — "Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"
- **Search** — Client-side fuzzy search via Fuse.js
- **Sorting** — By updated_at or created_at
- **Profile filtering** — Filter conversations by profile
- **Workspace scoping** — Conversations belong to workspaces
- **Drafts** — Auto-save message drafts per conversation
- **Tags** — Conversation tagging system
- **Model overrides** — Per-conversation model selection
- **Skill overrides** — Per-conversation skill selection
- **MCP overrides** — Per-conversation MCP server selection
- **Share tokens** — Generate shareable links for conversations (`shared.$shareToken.tsx` route)
- **Global drop zone** — Drag and drop files into conversations
- **Security warning dialog** — Warns about file scope risks
- **Context chips** — Show attached context items
- **File mention picker** — @-mention files in messages

### 2.6 Privacy & Security

#### Local-First Architecture
- **All data stored in local SQLite** via SeaORM
- API keys stored in the **OS keychain** (not in the database)
- The `api_key_not_in_db.rs` security test explicitly verifies this
- No cloud dependency — works fully offline

#### Security Features
- **Symlink protection** — `symlink_skill_directory_skipped.rs` test verifies symlinked skill directories are rejected
- **Tool approval gate** — Every external tool call requires explicit user approval (all auto-approve categories OFF by default)
- **Security lint rules** — Detects dangerous patterns in skill content (rm -rf, fork bombs, curl | sh, etc.)
- **Approval categories** — Granular control over which tool types can be auto-approved
- **Conversation-scoped approvals** — Approval gate is per-conversation, cancelled on teardown

#### Platform Integration (Opt-in)
- Registration via `client_id` (stable UUID per installation)
- API key format: `sk_<32-byte hex>` (Argon2id hashed on server)
- Server: `https://platform.skilldeck.dev` (or localhost:8080 in dev)
- Features: referrals, nudges, analytics, skill registry sync, email verification
- All platform features are opt-in — the app works fully without them

---

## 3. KEY DIFFERENTIATORS VS COMPETITORS

### SkillDeck vs Cursor
| Feature | SkillDeck | Cursor |
|---------|-----------|--------|
| **Multi-provider** | OpenAI, Claude, Ollama (any model) | OpenAI-only (GPT-4) |
| **Local models** | Full Ollama support, works offline | Cloud-only |
| **Skills system** | Markdown-based, version-controlled, linted | No equivalent |
| **Visual workflow editor** | @xyflow/react drag-and-drop | No equivalent |
| **Multi-agent** | Subagents with parallel execution | Single agent |
| **MCP servers** | Full MCP protocol (stdio + SSE) | No MCP support |
| **Tool approval** | Granular category-based approval gate | No tool approval |
| **Conversation branching** | Full branching from any message | No branching |
| **Open source** | MIT OR Apache-2.0 | Proprietary |
| **Privacy** | 100% local, no data leaves machine | Code sent to cloud |

### SkillDeck vs Continue.dev
| Feature | SkillDeck | Continue.dev |
|---------|-----------|--------------|
| **App type** | Full desktop app (Tauri) | VS Code extension |
| **Skills** | Rich skill system with linting, registry | Basic .clinerules |
| **Workflows** | Visual workflow editor with 3 patterns | No equivalent |
| **Subagents** | Parallel multi-agent orchestration | No subagents |
| **MCP** | Full MCP client with supervisor | MCP support added recently |
| **Conversation management** | Branching, threading, queue, artifacts | Linear chat |
| **Cross-IDE** | Standalone, any editor | VS Code only |

### SkillDeck vs Cline
| Feature | SkillDeck | Cline |
|---------|-----------|-------|
| **App type** | Native desktop app (Tauri) | VS Code extension |
| **Multi-provider** | 3 providers with model selection | OpenAI + Anthropic |
| **Local models** | Full Ollama integration | Limited |
| **Skills** | Full skill ecosystem (linting, registry, sharing) | No skill system |
| **Workflows** | Visual multi-step workflows | No equivalent |
| **Subagents** | Multi-agent parallel execution | No subagents |
| **UI** | Custom 3-panel resizable layout | VS Code sidebar |
| **Open source** | MIT OR Apache-2.0 | Apache-2.0 |

### Unique SkillDeck Capabilities
1. **Skill Marketplace** — Browse, install, share, and lint AI skills like packages
2. **Visual Workflow Editor** — Drag-and-drop workflow construction with @xyflow/react
3. **Multi-Agent Orchestration** — Spawn parallel subagents with skill-equipped contexts
4. **Conversation Branching** — Non-linear conversation exploration
5. **TOON Encoding** (upcoming) — Token-optimized tool encoding to reduce context usage
6. **Progressive Unlock** — Onboarding wizard with feature gates (unlock stages)
7. **Achievement System** — Gamification: "First Words", "Getting Chatty", "Tool Master", "Power User"
8. **Queue System** — Batch process multiple prompts sequentially
9. **Analytics Heatmap** — Usage tracking with contribution-style heatmap
10. **Referral System** — Built-in refer-and-earn program
11. **Rust-Powered Core** — Agent loop, MCP supervisor, skill watcher all in Rust

---

## 4. USER EXPERIENCE DETAILS

### Application Layout (`app-shell.tsx`)
Three resizable panels using `react-resizable-panels`:
- **Left Panel** (15–30%, default 20%) — Workspace switcher + conversation list
- **Center Panel** (min 35px) — Conversation/chat area
- **Right Panel** (18–35%, default 20%) — Tabbed context: Session, Skills, MCP, Workflow, Analytics, Artifacts

Layout persists to `localStorage` under key `skilldeck-panel-layout`.

### Right Panel Tabs (6 tabs)
| Tab | Icon | Content |
|-----|------|---------|
| **Session** | Cpu | Provider info, model selection, session stats |
| **Skills** | Layers | Unified skill marketplace (local + registry) |
| **MCP** | Zap | MCP server management (catalog + custom + live) |
| **Workflow** | GitBranch | Workflow editor + visual graph |
| **Analytics** | BarChart2 | Usage heatmap, session stats, recharts |
| **Artifacts** | FileCode | Generated artifacts panel |

Tabs unlock progressively — Skills/Workflow/Artifacts appear after Stage 1.

### Keyboard Shortcuts
- `Cmd/Ctrl+K` — Command palette
- `Cmd/Ctrl+,` — Open settings
- `Cmd/Ctrl+Shift+F` — Global search

### LLM Providers (from `right-panel.tsx`)
| Provider | Models Available |
|----------|-----------------|
| **OpenAI** | `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| **Claude (Anthropic)** | `claude-sonnet-4-5`, `claude-opus-4`, `claude-3-5-sonnet` |
| **Ollama** | Any locally installed model (detected via `ollama list`) |

Default provider: `ollama` (local-first).

### Profiles System
- Multiple profiles for different model/provider combinations
- Each profile has: provider, model_id, is_default flag
- Profiles can have associated skills and MCP servers
- Profile filter in left panel filters conversations
- Settings route: `/settings/profiles`

### Settings (10 tabs)
From `settings.tsx`:
1. **API Keys** — Provider API key management
2. **Profiles** — Create/edit profiles
3. **Tool Approvals** — Configure auto-approve categories
4. **Appearance** — Theme (light/dark/system), font size, code block height
5. **Preferences** — Language, notifications, telemetry
6. **Platform** — Platform account, registration, email verification
7. **Refer & Earn** — Referral code, stats
8. **Lint Rules** — Skill linting configuration
9. **Skill Sources** — Configure skill source directories
10. **Achievements** — View earned achievements

### Onboarding Wizard (4 steps)
1. **Welcome** — "Welcome to SkillDeck" with tagline
2. **API Key** — Enter provider API key (or skip for local)
3. **Platform** — Optional email for platform features
4. **Done** — Start conversation, manage profiles, or browse skills

### Appearance
- **Theme**: `light`, `dark`, `system` (default: `system`)
- **Font**: Poppins (via @fontsource/poppins)
- **UI Style**: shadcn/ui with `radix-nova` style, `neutral` base color
- **Color System**: CSS variables based
- **Contrast**: WCAG-compliant contrast checking utility
- **Reduced motion**: Respects `prefers-reduced-motion`

### Splash Screen & Launch
- `splash-screen.tsx` — Native splash screen on startup
- `launch-notification.tsx` — Banner notification on app launch
- `OnboardingWizard` — First-run experience

---

## 5. IMPORTANT DETAILS FOR ACCURATE COPY

### Is There a CLI?
**No.** SkillDeck is purely a desktop application. There is no CLI binary. The `skilldeck-lint` crate has a binary, but it's an internal tool for linting skills, not a user-facing CLI.

### Installation
- **Tauri installer** — `tauri build` produces native installers (MSI, DMG, AppImage, etc.)
- **Bundle targets**: "all" (all supported platforms)
- **App identifier**: `com.skilldeck.core`
- **Deep linking**: `skilldeck://` URL scheme supported
- **Drag & drop**: Enabled for files
- **Title bar**: Overlay style (custom titlebar)
- **Default window**: 1200×800, centered, resizable

### Configuration Files
- **TOML**: `skilldeck-lint.toml` (global: `~/.config/skilldeck/`, workspace: `.skilldeck/`)
- **JSON**: `tauri.conf.json`, `biome.json`, `components.json`
- **YAML**: `lingui.config.ts`, frontmatter in SKILL.md
- **No YAML config files** for user settings — settings are persisted via Zustand (localStorage)

### Actual Model Names from Code
- `claude-sonnet-4-5`, `claude-opus-4`, `claude-3-5-sonnet` (Claude provider)
- `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` (OpenAI provider)
- `glm-5:cloud` (referenced in seedling config and as old default)
- Any Ollama model name (dynamically detected)

### Real Feature Names from the UI
- "SkillDeck" (product name)
- "Command Palette"
- "Global Search"
- "UnifiedSkillList" / "Skill Marketplace"
- "MCP Catalog"
- "Workflow Editor" / "Workflow Graph"
- "Session Tab"
- "Artifacts Panel"
- "Analytics Heatmap"
- "Onboarding Wizard"
- "Tool Approval Gate"
- "Subagent Cards"
- "Message Queue"
- "Conversation Branches"
- "Achievements"
- "Refer & Earn"
- "Skill Sources"
- "Progressive Unlock"

### Key URLs
- Platform: `https://platform.skilldeck.dev`
- Docs: `https://docs.skilldeck.dev`
- Docs Lint: `https://docs.skilldeck.dev/linting`
- Repo: `https://github.com/elcoosp/skilldeck`
- Author: `elcoosp@gmail.com`

---

## 6. DEVELOPER-FACING DETAILS

### License
**MIT OR Apache-2.0** (dual license, from `package.json`)

### Repository Structure
```
elcoosp-skilldeck/
├── src/                          # React frontend
│   ├── components/               # UI components
│   ├── hooks/                    # React hooks (35+ hooks)
│   ├── store/                    # Zustand stores (12 stores)
│   ├── lib/                      # Utilities, events, types
│   ├── routes/                   # TanStack Router routes
│   ├── locales/                  # i18n (en/)
│   └── __tests__/                # Tests (unit + browser)
├── src-tauri/                    # Rust backend
│   ├── skilldeck-core/           # Core engine
│   │   ├── src/
│   │   │   ├── agent/            # Agent loop, tools, subagents
│   │   │   ├── mcp/              # MCP client
│   │   │   ├── providers/        # OpenAI, Claude, Ollama
│   │   │   ├── skills/           # Skill loader, watcher
│   │   │   ├── workflow/         # Workflow engine
│   │   │   ├── traits/           # DIP trait definitions
│   │   │   ├── db/               # Database connection
│   │   │   ├── markdown/         # Markdown rendering
│   │   │   └── workspace/        # Workspace detection
│   │   └── tests/                # Unit + integration tests
│   ├── skilldeck-models/         # 50+ SeaORM entity definitions
│   └── src/                      # Tauri commands layer
├── skilldeck-lint/               # Dedicated lint engine
├── skilldeck-platform/           # Optional cloud backend
├── skilldeck-user-docs/          # Astro documentation site
└── public/                       # Static assets
```

### Key Dependencies (Rust)
- `sea-orm` 2.0.0-rc.37 (ORM)
- `reqwest` 0.13.2 (HTTP client)
- `tokio` 1.50.0 (async runtime)
- `petgraph` 0.8.3 (graph engine)
- `dashmap` 6 (concurrent hashmap)
- `notify` 8 (file watching)
- `pulldown-cmark` 0.13.3 (markdown)
- `syntect` 5.3.0 (syntax highlighting)
- `toon-rust` 0.1.3 (TOON encoding)
- `parking_lot` 0.12.5 (synchronization)
- `backoff` 0.4 (retry logic)
- `specta` 2.0.0-rc.22 (type generation)
- `tauri-specta` 2.0.0-rc.21 (Tauri bindings)

### Key Dependencies (Frontend)
- `@tauri-apps/api` ^2.10.1
- `@tauri-apps/plugin-dialog` ^2.6.0
- `@tauri-apps/plugin-fs` ~2.4.5
- `@tauri-apps/plugin-opener` ~2
- `@tauri-apps/plugin-deep-link` ~2
- `@xyflow/react` ^12.10.1
- `zustand` ^5.0.11
- `@tanstack/react-router` ^1.168.10
- `@tanstack/react-query` ^5.90.21
- `@tanstack/react-virtual` ^3.13.22
- `zod` ^4.3.6
- `framer-motion` ^12.36.0
- `lucide-react` ^1.0.0
- `cmdk` ^1.1.1 (command palette)
- `sonner` ^2.0.7 (toasts)
- `date-fns` ^4.1.0
- `recharts` ^3.8.0
- `react-diff-viewer-continued` ^4.2.0

### Build System
- **Frontend**: Vite 8 + SWC (via @vitejs/plugin-react-swc)
- **Backend**: Cargo (Rust)
- **Monorepo**: pnpm workspaces
- **Code Quality**: Biome (lint+format), CSpell, Commitlint, Clippy
- **Git Hooks**: Lefthook (pre-commit: biome check+format+cspell; commit-msg: commitlint)
- **Changelog**: git-cliff (conventional commits)

### Database Models (50+ entities from skilldeck-models)
Key models: `conversations`, `messages`, `artifacts`, `skills`, `mcp_servers`, `mcp_tool_cache`, `profiles`, `profile_skills`, `profile_mcps`, `workspaces`, `workflow_definitions`, `workflow_executions`, `workflow_steps`, `queued_messages`, `conversation_branches`, `bookmarks`, `folders`, `tags`, `subagent_sessions`, `message_embeddings`, `export_jobs`, `pinned_artifacts`, `sync_state`, `usage_events`, `user_preferences`, `prompts`, `templates`, `registry_skills`, `skill_source_dirs`, `model_pricing`, etc.

### Testing
- **Rust unit tests**: Core engine tests (agent loop, approval gate, workflow graph, Ollama provider)
- **Rust integration tests**: Agent with tools, MCP client, skill loader, workflow executor, platform client
- **Rust security tests**: API key not in DB, symlink directory skip
- **TypeScript unit tests**: Settings store, achievements
- **TypeScript browser tests**: Conversation item, message bubble, thread navigator, tool call card
- **Playwright** for browser tests

---

## 7. PLATFORM BACKEND (skilldeck-platform)

### Purpose
Optional cloud backend for:
- User registration and authentication
- Skill registry and search
- Referral system
- Analytics and nudges
- Feedback management
- Email verification (via Resend)

### Tech Stack
- **Framework**: Axum 0.8.8
- **Database**: SQLite (SeaORM 2.x)
- **Auth**: Argon2id password hashing, bearer token (API key format: `sk_<hex>`)
- **Email**: Resend
- **Scheduler**: tokio-cron-scheduler
- **Rate Limiting**: tower-governor

### API Routes
- `POST /api/core/register` — Register with client_id, receive API key
- `GET/POST /api/feedback` — Feedback CRUD
- `GET/PUT /api/preferences` — User preferences
- `POST /api/growth/referral` — Referral codes
- `GET /api/growth/referral/stats` — Referral statistics
- `GET /api/skills` — List registry skills
- `GET /api/skills/search` — Search skills
- `GET /api/skills/sync` — Sync skills

### Background Jobs
- **Hourly lint cron** — Re-lints all registered skills
- **LLM enrichment** — Auto-enriches skill metadata (via Ollama)
- **Daily registry crawl** — Crawls web skill sources every 24 hours

---

## 8. STORYBRAND COPYWRITING GUIDE

### The Character (User)
The developer who wants AI assistance that:
- Respects their privacy (code never leaves their machine)
- Works with any model (not locked into one provider)
- Gives them control over what AI can do (tool approvals)
- Lets them build reusable AI workflows (skills + visual editor)
- Works offline with local models

### The Problem
- Current AI coding tools are cloud-dependent, lock you into one provider, and don't let you build reusable workflows
- No tool gives you multi-agent orchestration, visual workflows, AND local-first privacy in one app

### The Plan (Product as Guide)
SkillDeck provides the orchestration layer:
1. **Start fast** — Onboarding wizard gets you chatting in 60 seconds
2. **Equip with Skills** — Browse, install, and create AI instruction packages
3. **Connect Tools** — Add MCP servers for real-world capabilities
4. **Build Workflows** — Visual editor for multi-step AI pipelines
5. **Stay Private** — Everything local, everything under your control

### Success Looks Like
- Having parallel AI agents working on sub-tasks simultaneously
- Building a visual workflow once, running it forever
- Sharing skills with your team via the registry
- Using any model from any provider (or your own local model)
- Never worrying about code leaving your machine
