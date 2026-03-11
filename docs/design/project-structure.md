# SkillDeck Project Structure

**Version:** v1.0  
**Last Updated:** 2026-03-11  
**Audience:** Developers working on SkillDeck

This document describes the complete directory structure of the SkillDeck codebase, explaining the purpose of each major component and how they fit together. It follows the three‑layer architecture defined in [`archi-design.md`](archi-design.md): Rust core (business logic), Tauri shell (OS integration), and React frontend (UI). All frontend file names use **kebab-case** to maintain consistency with shadcn/ui conventions.

---

## Overview

```
skilldeck/
├── src-tauri/          # Tauri shell and Rust core
│   ├── skilldeck-core/ # Standalone library crate
│   └── src/            # Tauri commands, app setup, keychain
├── src/                 # React frontend (kebab-case filenames)
│   ├── components/      # UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # IPC wrappers, utilities
│   ├── store/           # Zustand state
│   └── ...
└── tests/               # Integration tests (Rust)
```

---

## 1. Rust Core (`src-tauri/skilldeck-core/`)

This is a pure Rust library crate with **no Tauri dependency**. It contains all business logic, database models, agent loop, skill management, MCP client, and workflow engine. The core exposes an async API consumed by Tauri commands.

### Directory Tree

```
src-tauri/skilldeck-core/
├── Cargo.toml
├── src/
│   ├── lib.rs               # Re‑exports and core entry point
│   ├── error.rs              # CoreError enum (thiserror)
│   ├── db/
│   │   ├── mod.rs
│   │   ├── connection.rs     # Database pool and migration runner
│   │   └── migrations/       # SeaORM migration files (one per table)
│   ├── models/               # SeaORM entities (generated, one per table)
│   │   ├── conversations.rs
│   │   ├── messages.rs
│   │   ├── tool_call_events.rs
│   │   ├── conversation_branches.rs
│   │   ├── profiles.rs
│   │   ├── profile_mcps.rs
│   │   ├── profile_skills.rs
│   │   ├── conversation_mcp_overrides.rs
│   │   ├── conversation_skill_overrides.rs
│   │   ├── conversation_model_override.rs
│   │   ├── mcp_servers.rs
│   │   ├── mcp_tool_cache.rs
│   │   ├── skills.rs
│   │   ├── skill_source_dirs.rs
│   │   ├── subagent_sessions.rs
│   │   ├── workflow_executions.rs
│   │   ├── workflow_steps.rs
│   │   ├── workspaces.rs
│   │   ├── artifacts.rs
│   │   ├── templates.rs
│   │   ├── folders.rs
│   │   ├── tags.rs
│   │   ├── conversation_tags.rs
│   │   ├── attachments.rs
│   │   ├── prompts.rs
│   │   ├── prompt_variables.rs
│   │   ├── usage_events.rs
│   │   ├── model_pricing.rs
│   │   ├── workspace_state.rs
│   │   ├── conversation_ui_state.rs
│   │   ├── bookmarks.rs
│   │   ├── export_jobs.rs
│   │   ├── message_embeddings.rs
│   │   ├── sync_state.rs
│   │   └── sync_watermarks.rs
│   ├── traits/               # Plugin traits
│   │   ├── mod.rs
│   │   ├── model_provider.rs  # ModelProvider trait + types
│   │   ├── mcp_transport.rs   # McpTransport trait
│   │   ├── skill_loader.rs    # SkillLoader trait
│   │   └── sync_backend.rs    # SyncBackend trait (v2)
│   ├── providers/             # Built‑in model providers
│   │   ├── mod.rs
│   │   ├── claude.rs
│   │   ├── openai.rs
│   │   ├── gemini.rs          # Stub for v1
│   │   └── ollama.rs
│   ├── mcp/                    # Model Context Protocol client
│   │   ├── mod.rs
│   │   ├── client.rs           # JSON‑RPC request/response handling
│   │   ├── stdio_transport.rs  # stdio transport
│   │   ├── sse_transport.rs    # SSE transport (simplified)
│   │   ├── registry.rs         # MCP server registry
│   │   └── discovery.rs        # Local server discovery
│   ├── skills/                 # Skill system
│   │   ├── mod.rs
│   │   ├── loader.rs           # FilesystemSkillLoader, SKILL.md parser
│   │   ├── resolver.rs         # Priority resolver (workspace > personal > superpowers > marketplace)
│   │   ├── watcher.rs          # notify‑based filesystem watcher
│   │   └── scanner.rs          # Scan directory for skills
│   ├── workspace/               # Workspace context
│   │   ├── mod.rs
│   │   ├── detector.rs          # Project type detection (Rust, Node, Python, Generic)
│   │   └── context.rs           # Load CLAUDE.md, README, .gitignore
│   ├── agent/                    # Agent loop
│   │   ├── mod.rs
│   │   ├── loop.rs               # AgentLoop – main orchestration
│   │   ├── context_builder.rs    # Assembles system prompt with skills and workspace
│   │   ├── built_in_tools.rs     # loadSkill, spawnSubagent, mergeSubagentResults schemas
│   │   ├── tool_dispatcher.rs    # Routes tool calls to MCP or built‑ins
│   │   └── subagent.rs           # Subagent session lifecycle
│   ├── workflow/                  # Workflow engine
│   │   ├── mod.rs
│   │   ├── graph.rs               # Build DAG from step config, topological sort
│   │   ├── executor.rs            # WorkflowExecutor (sequential, parallel, eval‑opt)
│   │   ├── sequential.rs          # Sequential step runner
│   │   ├── parallel.rs            # Parallel step runner with aggregation
│   │   └── eval_opt.rs            # Evaluator‑optimizer loop
│   ├── toon.rs                     # Wrapper around `toon_format` crate
│   ├── search.rs                   # Semantic search (sqlite‑vss integration)
│   └── events.rs                    # AgentEvent enum (serializable for Tauri IPC)
```

### Key Points

- **Pure library**: All code in `skilldeck-core` is agnostic of Tauri; it can be tested in isolation.
- **Database**: SeaORM + SQLite, with migrations in `db/migrations`. The full schema (31 tables) is defined in the initial migration.
- **Traits**: Four core traits (`ModelProvider`, `McpTransport`, `SkillLoader`, `SyncBackend`) define extension points.
- **Providers**: Built‑in implementations for Anthropic Claude, OpenAI, Gemini (stub), and Ollama.
- **MCP**: Implements JSON‑RPC over stdio and SSE; stores tool schemas in `mcp_tool_cache`.
- **Skills**: Scans directories, watches for changes, resolves priorities, and flags shadowed skills.
- **Workspace**: Detects project type, injects `CLAUDE.md`/`README.md` into system prompt, respects `.gitignore` for file access.
- **Agent loop**: Streams tokens, dispatches tool calls, handles approval gates, emits events.
- **Workflow engine**: Builds a `petgraph::DiGraph` from step configs; supports sequential, parallel, and evaluator‑optimizer patterns.
- **TOON**: All structured data sent to LLMs is encoded using the `toon_format` crate, saving ~40% tokens.

---

## 2. Tauri Shell (`src-tauri/`)

This layer depends on `skilldeck-core` and provides the OS‑specific integration: Tauri commands, event bus, keychain access, and file system watcher lifecycle.

### Directory Tree

```
src-tauri/
├── Cargo.toml
├── src/
│   ├── lib.rs                 # App setup, state (AppState), command registration
│   ├── credentials.rs          # OS keychain abstraction (tauri‑plugin‑keychain)
│   └── commands/               # All Tauri IPC commands
│       ├── mod.rs
│       ├── conversations.rs    # CRUD + branch ops
│       ├── messages.rs         # send, stream, approve tool calls, merge subagents
│       ├── profiles.rs         # CRUD profiles
│       ├── skills.rs           # list, toggle, install (marketplace)
│       ├── mcp.rs              # list, connect MCP servers
│       ├── workspaces.rs       # open, close, detect
│       ├── workflows.rs        # start, stop, status
│       ├── analytics.rs        # usage stats
│       ├── settings.rs         # API keys (keychain), app config
│       └── export.rs           # markdown/json/pdf export
```

### Key Points

- **AppState**: Holds `Arc<DatabaseConnection>` and `ApprovalGate` (dashmap for pending approvals).
- **Credentials**: Uses `tauri‑plugin‑keychain` to store API keys securely.
- **Commands**: Each command receives the app state and optionally the `AppHandle` for emitting events.
- **Event bus**: The agent loop emits events (`agent:token`, `agent:tool_call`, etc.) which are forwarded to the frontend via `app.emit_all`.
- **Background tasks**: Title generation and token counting run as separate Tokio tasks after each response.

---

## 3. React Frontend (`src/`) – Kebab‑Case Filenames

The frontend is a pure view layer, communicating exclusively via `invoke()` and Tauri event subscriptions. It uses **React 19**, **TypeScript**, **Vite**, and **shadcn/ui**. All file names are in **kebab-case** to match shadcn conventions.

### Directory Tree

```
src/
├── main.tsx
├── index.css                     # Tailwind + shadcn CSS variables
├── lib/
│   ├── invoke.ts                  # Typed wrappers around Tauri `invoke` (api object)
│   ├── events.ts                   # Typed Tauri event listeners
│   └── utils.ts                     # `cn()` helper, date‑fns, misc
├── store/
│   ├── ui.ts                        # Zustand: active conversation, panel sizes, drafts, branch
│   └── unlock.ts                    # Zustand: progressive unlock stage
├── hooks/
│   ├── use-conversations.ts          # TanStack Query: list/get conversations
│   ├── use-messages.ts               # TanStack Query: messages for active conversation
│   ├── use-profiles.ts               # TanStack Query: profiles
│   ├── use-skills.ts                 # TanStack Query: skills
│   ├── use-mcp-servers.ts            # TanStack Query: MCP servers
│   ├── use-workflow.ts               # TanStack Query: workflow executions
│   ├── use-analytics.ts              # TanStack Query: usage stats
│   └── use-agent-stream.ts            # Subscribes to agent events, manages streaming state
├── components/
│   ├── ui/                           # shadcn generated components (do not edit)
│   ├── layout/
│   │   ├── app-shell.tsx               # ResizablePanelGroup root (three panels)
│   │   ├── left-panel.tsx              # Conversations, folders, tags
│   │   ├── center-panel.tsx            # Message thread + input
│   │   └── right-panel.tsx             # Context/insights tabs (Session, Workflow, Analytics)
│   ├── conversation/
│   │   ├── conversation-list.tsx       # Virtualized list (react‑virtuoso)
│   │   ├── conversation-item.tsx       # Single row in sidebar
│   │   ├── message-thread.tsx          # Virtualized message thread
│   │   ├── message-bubble.tsx          # User/assistant/system message with markdown
│   │   ├── branch-nav.tsx              # Inline ◀ 1/3 ▶ navigator
│   │   ├── tool-call-card.tsx          # Collapsible tool call/result
│   │   ├── tool-approval-card.tsx      # Approval gate UI
│   │   ├── subagent-card.tsx           # Inline subagent card with merge/discard
│   │   ├── artifact-card.tsx           # Code/file artifact viewer
│   │   └── message-input.tsx           # Enhanced input (/, @, #, attachments)
│   ├── right-panel/
│   │   ├── session-tab.tsx              # Model, MCP servers, active skills, overrides
│   │   ├── workflow-tab.tsx             # DAG visualization (@xyflow/react)
│   │   ├── workflow-node.tsx            # Custom node for each step type
│   │   └── analytics-tab.tsx            # Token/cost charts (Recharts)
│   ├── overlays/
│   │   ├── command-palette.tsx          # ⌘K (cmdk)
│   │   ├── marketplace-overlay.tsx      # Full‑screen marketplace (MCP, Skills, Sources tabs)
│   │   ├── skills-tab.tsx               # Skill marketplace tab (with fuzzy search + preview)
│   │   ├── mcp-tab.tsx                  # MCP server marketplace tab
│   │   ├── skill-sources-tab.tsx        # Skill source directories tab
│   │   └── settings-overlay.tsx         # Full‑screen settings (API keys, advanced)
│   ├── onboarding/
│   │   ├── onboarding-wizard.tsx        # 3‑step first‑run flow
│   │   └── playground-banner.tsx        # Playground mode banner + tooltips
│   └── shared/
│       ├── profile-badge.tsx            # Colored chip with icon
│       ├── unlock-notification.tsx      # Stage unlock toast/banner
│       └── token-counter.tsx            # Context window usage bar
```

### Key Points

- **IPC**: `invoke.ts` provides a fully typed `api` object mirroring all Tauri commands.
- **State management**: Zustand stores for UI state (`ui.ts`) and progressive unlock (`unlock.ts`). TanStack Query for server state.
- **Events**: `use-agent-stream` subscribes to `agent:token`, `agent:done`, etc., and updates the message thread in real time.
- **Layout**: Three‑panel layout with `react‑resizable‑panels`; panel widths persist to DB.
- **Components**: shadcn components are used extensively; custom components follow atomic design.
- **Accessibility**: ARIA labels, keyboard navigation, and focus management are built into all interactive elements.
- **Kebab‑case**: All React component files use `kebab-case.tsx` to maintain consistency with shadcn/ui imports.

---

## 4. Integration Tests (`tests/`)

Rust integration tests live in the root `tests/` directory and test the core library with real (in‑memory) databases.

```
tests/
├── agent_loop.rs            # Streaming, tool calls, approval gate
├── skill_resolver.rs        # Priority resolution and shadowing
├── workflow_sequential.rs   # Sequential workflow step execution
├── workflow_parallel.rs     # Parallel workflow with multiple agents
└── workflow_eval_opt.rs     # Evaluator‑optimizer loop with threshold
```

---

## 5. Supporting Files

- `vite.config.ts` – Vite configuration (including Vitest setup).
- `tailwind.config.js` – Tailwind configuration (extending shadcn theme).
- `tsconfig.json` – TypeScript configuration.
- `.gitignore` – Standard ignores plus `skilldeck.db`.
- `README.md` – Project overview, setup instructions, and contribution guide.

---

## Summary

The SkillDeck project is organized into three clear layers:

- **Rust core** – business logic, database, agent loop, workflows.
- **Tauri shell** – OS integration, IPC commands, event bus.
- **React frontend** – pure UI, using TanStack Query for data and Zustand for local state, with kebab-case filenames for consistency.

This separation ensures testability, maintainability, and a clean developer experience. All new features should respect this structure and add code to the appropriate layer.
