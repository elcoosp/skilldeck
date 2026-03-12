# SkillDeck Tech Stack

This document outlines the technology stack and architectural decisions for the SkillDeck project, derived from codebase exploration and design documentation (see `ux-design.md`).

## Overview

SkillDeck is a Tauri-based desktop application providing an AI agent chat interface with support for MCP servers, a Superpowers-compatible skill system, branching conversations, and a rich workflow orchestration engine. The stack is chosen for performance, developer experience, accessibility, and full alignment with the UX vision.

---

## Frontend

### Core Framework & Build

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Language**: TypeScript (strict mode enabled)
- **Package Manager**: pnpm
- **Routing**: React Router DOM v7 (for layout-based routing if needed, otherwise in-memory state).

### Testing

- **Test Runner**: [Vitest](https://vitest.dev/) – A Vite-native unit test framework with fast watch mode, built-in TypeScript support, and Jest-compatible API.
- **Environment**: **Vitest Browser Mode**. Tests run in a real browser environment (Chromium, Firefox, WebKit) using `@vitest/browser` and `playwright` for maximum reliability and real user interaction simulation.
- **Configuration**: Vitest configured in `vite.config.ts` alongside Vite, sharing the same transform pipeline.
- **Coverage**: Vitest provides built-in coverage reports via `v8` or `istanbul`.

### UI Component System

- **Component Library**: [shadcn/ui](https://ui.shadcn.com) – copy‑paste components owned directly in the codebase. Built on Radix UI primitives for accessibility.
- **Styling**: Tailwind CSS with shadcn/ui's theming system; custom CSS (App.css) replaced by shadcn's global CSS variables.
- **Icon Libraries**:
  - [lucide-react](https://lucide.dev) – primary icon set for UI actions.
  - [@icons-pack/react-simple-icons](https://github.com/icons-pack/react-simple-icons) – brand and technology icons (GitHub, Rust, etc.).
    - **Installation**: `pnpm add @icons-pack/react-simple-icons`
    - **Usage**: Icons exported with `Si` prefix (e.g., `SiReact`).
    - **Default color**: Use `color='default'` or import `SiReactHex`.

**shadcn/ui Setup**:

- CLI: `pnpm dlx shadcn@latest`
- Components stored in `src/components/ui`
- Global CSS in `src/index.css` with Tailwind directives

### Layout & Interaction

- **Resizable Panels**: [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) – implements the three‑panel design with drag handles and persistence of widths.
- **Command Menu**: [cmdk](https://github.com/pacocoursey/cmdk) – powers global search (`⌘K`) and mention picker (`@`).
- **Drawer (optional)**: [vaul](https://github.com/emilkowalski/vaul) – if a slide‑in panel is preferred over a full overlay for marketplace/settings.
- **Virtualization**: [react-virtuoso](https://github.com/petyosi/react-virtuoso) – virtualizes long conversation threads, skill lists, and marketplace results to maintain performance with thousands of items.
- **Keyboard Shortcuts**: [react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook) – declarative keyboard shortcut bindings, supports customizability and conflict detection.
- **Debouncing / Throttling**: [use-debounce](https://github.com/xnimorz/use-debounce) or `lodash.debounce` – for search inputs, auto-save drafts, and resize handlers.

### State Management

- **Server State**: [TanStack Query](https://tanstack.com/query/latest) – handles data fetching, caching, and background updates for MCP servers, skills list, conversations, and profiles.
- **Client State**: [Zustand](https://github.com/pmndrs/zustand) – manages UI state: active conversation, panel sizes, right panel collapsed state, input drafts, active branch, feature unlock progress, etc.

### Forms & Validation

- **Form Handling**: [React Hook Form](https://react-hook-form.com/) – for profile creation, settings, prompt variable filling.
- **Validation**: [zod](https://zod.dev/) + [@hookform/resolvers](https://github.com/react-hook-form/resolvers) – schema validation for forms.

### AI Integration

- **Agent‑LLM Communication**: [TOON (Token‑Oriented Object Notation)](https://github.com/toon-format/toon) – compact, human‑readable format for sending structured data (tool inputs, skill contexts, conversation state) to the LLM, reducing token usage by ~40% while maintaining or improving accuracy.
  - **Implementation**: Use TypeScript SDK (`@toon-format/toon`) on the frontend when preparing data for Tauri commands that will be forwarded to the LLM.
  - Wrap TOON data in markdown code blocks (```toon) to help the LLM identify the format.

### Real‑time Updates & Notifications

- **Toast Notifications**: [Sonner](https://sonner.emilkowal.ski/) – official toast library for shadcn/ui; used for tool approvals, skill load events, errors.
- **Tauri Events**: Primary real‑time mechanism – Rust core emits events (`agent:token`, `subagent:spawned`, etc.) that React listens to via `@tauri-apps/api/event`.

### Data Visualization

- **Charts**: [Recharts](https://recharts.org/) – for usage analytics (token consumption, cost trends, model usage).
- **Workflow DAG Visualization**: [@xyflow/react](https://reactflow.dev/) (formerly react-flow) – interactive directed acyclic graph (DAG) visualization for workflow execution monitoring. Shows sequential, parallel, and evaluator-optimizer patterns with real-time step status, metrics, and connections.
  - **Installation**: `pnpm add @xyflow/react`
  - **Use case**: Right panel workflow visualization showing step dependencies, execution status, quality scores, and performance metrics.
  - **Features**: Auto-layout, zoom/pan, minimap, collapsible step groups for nested workflows.

### Internationalization

- **Library**: [Lingui](https://lingui.dev/) – A powerful internationalization framework for JavaScript projects. Chosen for its React support, rich-text capabilities, and excellent tooling (CLI, Vite plugin, ESLint plugin).
- **Core Package**: `@lingui/core` – Core intl functionality for any JavaScript project.
- **React Integration**: `@lingui/react` with macro support (`@lingui/react/macro`) for seamless component-based translations, including React Server Components (RSC).
- **Message Format**: Uses ICU MessageFormat for plurals, genders, and selects, ensuring proper localization.
- **Workflow**: Messages are extracted using the Lingui CLI, compiled into catalogs, and loaded dynamically. The Vite plugin compiles catalogs on the fly during development.
- **AI Translation Ready**: Lingui's format allows adding descriptions to messages, providing context for AI-powered translations.
- **Storage**: Translations stored in JSON or PO files, compatible with most translation platforms.
- **Installation**: `pnpm add @lingui/core @lingui/react` and `pnpm add -D @lingui/cli @lingui/vite-plugin @lingui/macro`

### Marketplace & Search

- **Fuzzy Search**: [fuse.js](https://fusejs.io/) – client-side fuzzy search for skill marketplace, command palette, and mention picker.
- **Diff Viewer**: [react-diff-viewer](https://github.com/praneshr/react-diff-viewer) – side‑by‑side diff for comparing shadowed skills (workspace vs personal versions).
- **Markdown Rendering**: [react-markdown](https://github.com/remarkjs/react-markdown) – for previewing `SKILL.md` content in the marketplace detail view.

### Utilities

- **Date Handling**: [date-fns](https://date-fns.org/) – formatting conversation timestamps.
- **Class Name Composition**: `clsx` + `tailwind-merge` (via `cn()` helper) – standard shadcn/ui pattern.
- **Variant Styling**: [class-variance-authority](https://cva.style/) – used for component variants (already part of shadcn).
- **Accessibility Primitives**: [Radix UI](https://www.radix-ui.com/) – shadcn/ui is built on Radix, ensuring WAI‑ARIA compliance.
- **Focus Management**: [react-focus-lock](https://github.com/theKashey/react-focus-lock) – for modals and dialogs to trap focus.
- **Vim‑style Input (optional)**: [@uiw/react-textarea-code-editor](https://uiwjs.github.io/react-textarea-code-editor/) – can be integrated for Vim mode in the input area; not required for v1.

### Quality Control (Dev Tooling)

| Tool                          | Purpose                                                                        |
| :---------------------------- | :----------------------------------------------------------------------------- |
| **Biome**                     | Unified linter and formatter for JS/TS/JSON/CSS. Replaces ESLint and Prettier. |
| **Lefthook**                  | Fast, powerful Git hooks manager. Replaces Husky.                              |
| **Commitlint**                | Lints commit messages to enforce Conventional Commits standard.                |
| **CSpell**                    | Code spell checker to catch typos in documentation and code.                   |
| **@elcoosp-configs/lefthook** | Shared presets for Lefthook configuration (Biome, CSpell, Commitlint).         |

---

## Backend (Rust)

- **Core Framework**: Tauri 2
- **Language**: Rust (edition 2021)
- **Workspace Structure**:
  - `src-tauri` – main Tauri application shell
  - `skilldeck-core` – separate library crate for business logic (agent loop, MCP, skills, workflows, etc.)

**Key Dependencies**:
| Crate | Purpose |
|-------|---------|
| `tauri` | Core Tauri framework |
| `tauri-plugin-opener` | Open files/URLs |
| `tauri-plugin-shell` | Execute shell commands (MCP stdio) |
| `tokio` | Async runtime (full features) |
| `sea-orm` | ORM with SQLite support (`sqlx-sqlite`) |
| `serde` / `serde_json` | Serialization |

**Additional Rust Crates**:

| Library                 | Purpose                                                                       |
| :---------------------- | :---------------------------------------------------------------------------- |
| `anyhow` / `thiserror`  | Simplified error handling                                                     |
| `tracing`               | Structured logging                                                            |
| `notify`                | Filesystem watching for skill directories                                     |
| `glob`                  | Pattern matching for skill discovery                                          |
| `uuid`                  | Generate UUIDs for database primary keys                                      |
| `chrono` / `time`       | Date/time handling                                                            |
| `reqwest`               | HTTP client for remote MCP registry and model APIs                            |
| `futures`               | Stream combinators and async utilities                                        |
| `config`                | Manage configuration (API keys, skill directories)                            |
| `cargo-machete`         | Detect unused dependencies (dev tool)                                         |
| `petgraph`              | Graph data structures for workflow DAG execution                              |
| `dashmap`               | Concurrent HashMap for workflow state tracking                                |
| `rayon` (optional)      | Data parallelism for parallel workflow execution                              |
| `sqlite-vss` (optional) | Vector search extension for SQLite – for semantic search across conversations |

**Architectural Layers** (as per design):

1. **Rust Core** (`skilldeck-core`) – domain logic, traits for extensibility
2. **Tauri Shell** – commands, window management, secure storage (OS keychain)
3. **React Frontend** – pure view layer

**Plugin System**:

- Traits defined in core for `ModelProvider`, `McpTransport`, `SkillLoader`, `SyncBackend`
- v1 uses static registration; v2 will support dynamic loading (`.so`/`.dll`)

---

## Database

- **Primary Database**: SQLite (inferred from `sea-orm` feature `sqlx-sqlite` and no `pg_embed` in dependencies)
- **ORM**: SeaORM 2.0 (with `sqlx-sqlite` and `runtime-tokio-native-tls`).
  - SeaORM 2.0 is a **major release** introducing breaking changes, new features, and an improved developer experience.
  - **Migration**: When upgrading from 1.x, refer to the official [What's New in SeaORM 2.0](https://www.sea-ql.org/SeaORM/docs/introduction/whats-new/) guide.
- **Schema Tables** (planned): conversations, messages, profiles, MCP servers, skills, sync state, workflow executions, workflow steps, message_embeddings (for semantic search), tool_approvals, etc. (29+ tables across 10 domains).
- **Vector Search** (optional): `sqlite-vss` extension for efficient semantic search over message embeddings. If not available, fallback to in‑memory cosine similarity with `ndarray`.

---

## Build & Tooling

- **Build Commands**:
  - `pnpm dev` – runs Vite dev server
  - `pnpm build` – builds frontend
  - `pnpm test` – runs Vitest tests (Browser Mode)
  - `pnpm test:ui` – runs Vitest with UI
  - `pnpm coverage` – runs Vitest with coverage
  - `cargo tauri dev` – runs Tauri dev with frontend
- **Configuration Files**:
  - `tauri.conf.json` – Tauri app config (product name, identifier, windows, icons)
  - `tsconfig.json` – TypeScript config (bundler mode, React JSX)
  - `vite.config.ts` – Vite config tailored for Tauri, also includes Vitest configuration
  - `biome.json` – Biome configuration (Linting & Formatting)
  - `lefthook.yml` – Lefthook configuration (Git Hooks)
  - `commitlint.config.js` – Commitlint configuration
  - `cspell.json` – CSpell configuration
- **Rust Workspace**: Managed via `Cargo.toml` in root of `src-tauri` with workspace members

---

## Key Design Features & Library Mapping

| Design Feature                      | Libraries Used                                      |
| :---------------------------------- | :-------------------------------------------------- |
| **Three‑panel layout**              | `react-resizable-panels`                            |
| **Streaming agent responses**       | Tauri events                                        |
| **Tool approval UI**                | Sonner toasts + shadcn Dialog                       |
| **Subagent cards**                  | React components, Zustand for state                 |
| **Workflow orchestration**          | Core Rust orchestrator + Tauri events               |
| **Workflow DAG visualization**      | `@xyflow/react` + Zustand                           |
| **Inline branch navigation**        | Zustand + UI state in DB                            |
| **MCP discovery & marketplace**     | TanStack Query (server state), shadcn Dialog/Sheet  |
| **Skill management**                | TanStack Query, filesystem watcher events           |
| **Prompt library with variables**   | React Hook Form + zod + shadcn form components      |
| **Command menu (`⌘K`)**             | `cmdk`                                              |
| **Mention picker (`@`)**            | `cmdk` + `fuse.js` (fuzzy skill search)             |
| **Fuzzy search (marketplace)**      | `fuse.js`                                           |
| **Skill diff view**                 | `react-diff-viewer`                                 |
| **SKILL.md preview**                | `react-markdown`                                    |
| **Real‑time event display**         | Tauri events + Sonner                               |
| **Usage analytics (charts)**        | Recharts                                            |
| **Long list virtualization**        | `react-virtuoso`                                    |
| **Client state persistence**        | `@tauri-apps/plugin-store`                          |
| **Keyboard shortcuts**              | `react-hotkeys-hook`                                |
| **Debouncing / Throttling**         | `use-debounce`                                      |
| **Workflow performance monitoring** | TanStack Query + Recharts (trends/analytics)        |
| **Internationalization**            | Lingui (`@lingui/core`, `@lingui/react`, CLI, Vite) |
| **Frontend testing**                | **Vitest (Browser Mode) + Playwright**              |
| **Linting & Formatting**            | **Biome**                                           |
| **Git Hooks**                       | **Lefthook**                                        |
| **Commit Linting**                  | **Commitlint**                                      |
| **Vector search (semantic)**        | `sqlite-vss` (Rust) or in‑memory with `ndarray`     |

---

## Additional Recommended Libraries

### Rust (Backend) – already covered above.

### Frontend (TypeScript/React) – already covered above.

### Dev Tooling

| Tool            | Purpose                                       |
| :-------------- | :-------------------------------------------- |
| `cargo-watch`   | Automatically run tests/lints on file changes |
| `cargo-machete` | Detect unused Rust dependencies               |

---

## Testing Strategy

- **Unit Tests**:
  - Rust: In core crate with mocked traits
  - Frontend: Vitest for component and utility tests (Browser Mode)
- **Integration Tests**:
  - Rust: Using local Ollama for agent workflows
  - Frontend: Vitest with `@vitest/browser` for integration of components with state in a real browser environment
- **E2E Tests**: Tauri WebDriver for critical paths (minimal)
- **Coverage**: Vitest provides coverage reports; Rust uses `tarpaulin` or `grcov`.

---

## Current State vs. Design

The current scaffolding is minimal (Tauri + React starter) but includes:

- Workspace setup with `skilldeck-core`
- Basic Tauri commands (`greet` in `lib.rs`)
- SeaORM dependency with SQLite
- Design documents in `docs/` detailing the full vision

Planned additions include the agent core, MCP discovery, skill loading, and the three‑panel UI built with the libraries listed above.

---

## Workflow Pattern Implementation

### Core Workflow Engine (Rust)

The workflow orchestrator lives in `skilldeck-core` and manages execution of the three primary patterns:

**Key Components:**

- `WorkflowExecutor` – main orchestration struct, manages state machine
- `WorkflowGraph` – uses `petgraph::DiGraph` for DAG representation and dependency resolution
- `WorkflowStepRunner` – executes individual steps, spawns subagents
- `WorkflowAggregator` – implements merge strategies for parallel workflows
- `QualityEvaluator` – trait for evaluator-optimizer feedback loops

**State Management:**

- Active workflow state stored in `DashMap<Uuid, WorkflowState>` for concurrent access
- Database persistence via `workflow_executions` and `workflow_steps` tables
- Event-driven updates to frontend via Tauri event bus

**Execution Flow:**

```rust
pub struct WorkflowExecutor {
    graph: WorkflowGraph,
    state: Arc<DashMap<Uuid, WorkflowState>>,
    db: Arc<DatabaseConnection>,
    event_emitter: EventEmitter,
}

impl WorkflowExecutor {
    pub async fn execute(&self, config: WorkflowConfig) -> Result<WorkflowResult> {
        match config.workflow_type {
            WorkflowType::Sequential => self.execute_sequential(config).await,
            WorkflowType::Parallel => self.execute_parallel(config).await,
            WorkflowType::EvaluatorOptimizer => self.execute_eval_opt(config).await,
        }
    }
}
```

### Frontend Workflow Visualization

**DAG Rendering** (`@xyflow/react`):

- Custom node components for each step type (agent, evaluator, aggregator)
- Color-coded status indicators (pending/running/completed/failed)
- Real-time metric overlays (tokens, latency, quality score)
- Automatic layout using dagre algorithm

**React Component Structure:**

```tsx
<WorkflowVisualization>
  <ReactFlow nodes={workflowNodes} edges={workflowEdges}>
    <StepNode type="agent" />
    <StepNode type="evaluator" />
    <StepNode type="aggregator" />
    <Background />
    <Controls />
    <MiniMap />
  </ReactFlow>
  <WorkflowMetrics execution={currentWorkflow} />
  <StopButton onClick={handleStop} />
</WorkflowVisualization>
```

**State Synchronization:**

- Zustand store for UI state (`activeWorkflowId`, `expandedSteps`, etc.)
- TanStack Query for server state (workflow executions, step history)
- Tauri event listeners update React state in real-time

### Skill Workflow Configuration

Skills declare workflows via YAML frontmatter, parsed by `SkillLoader`:

```yaml
---
name: comprehensive-code-review
workflow:
  type: sequential
  steps:
    - name: security
      workflow:
        type: parallel
        agents:
          - skill: sql-injection-checker
          - skill: xss-vulnerability-scanner
        merge_strategy: union
    - name: refine
      workflow:
        type: evaluator-optimizer
        max_iterations: 3
        quality_threshold: 0.9
        generator_skill: code-refiner
        evaluator_skill: style-checker
---
```

**Validation:**

- Zod schema validates workflow config structure
- Rust-side validation checks skill references exist
- Cycle detection prevents infinite loops in dependencies

### Performance Monitoring

**Metrics Collection:**

- Per-step token usage tracked in `workflow_steps.tokens_used`
- Latency measured from `started_at` to `completed_at`
- Cost calculated using `model_pricing` table lookups
- Quality scores stored for trend analysis

**Analytics Queries:**

- Average workflow duration by type
- Token efficiency (tokens per quality score improvement)
- Bottleneck identification (slowest steps)
- Cost breakdown by workflow pattern

**UI Displays:**

- Real-time progress bars on workflow cards
- Historical trend charts (Recharts) in analytics panel
- Comparative analysis (sequential vs parallel for same task)

---

## Summary

SkillDeck combines modern frontend tooling (React 19, TypeScript, Vite) with a curated set of libraries that directly address the UX goals:

- **Biome** for fast, unified linting and formatting.
- **Lefthook** for efficient, managed Git hooks.
- **Vitest Browser Mode** for reliable, real-environment testing.
- **shadcn/ui** + **Radix** for accessible, consistent UI
- **TanStack Query** + **Zustand** for robust state management
- **react-resizable-panels** for the three‑panel layout
- **cmdk** for command and mention experiences
- **Sonner** for non‑intrusive notifications
- **TOON** for token‑efficient LLM communication
- **@xyflow/react** for workflow DAG visualization
- **Lingui** for internationalization
- **fuse.js** for fuzzy search (marketplace, skill picker)
- **react-diff-viewer** for skill comparison
- **react-markdown** for SKILL.md preview
- **react-hotkeys-hook** for declarative keyboard shortcuts
- **use-debounce** for input debouncing
- **petgraph** + **dashmap** for workflow orchestration in Rust
- **sqlite-vss** (optional) for vector‑based semantic search

Together with a robust Rust backend (Tauri, Tokio, SeaORM 2.0), this stack delivers a high-performance, extensible AI agent desktop application that is local‑first, developer‑extensible, and compatible with the Superpowers skill ecosystem.

### Workflow Pattern Support

The stack fully supports the three production-proven workflow patterns:

- **Sequential workflows** for dependent multi-stage tasks
- **Parallel workflows** for concurrent execution and aggregation
- **Evaluator-optimizer workflows** for iterative quality refinement

All patterns are composable, monitorable, and cost-tracked at the per-step level.

---

## Gap Analysis & Recommendations

### ✅ Fully Covered

- Core agent loop with streaming
- Three‑panel UI with resizable layout
- MCP server discovery and integration
- Skill system with priority resolution
- Workspace context and file scoping
- Branching conversations
- TOON format for token efficiency
- Tool approval flows
- Real‑time event bus
- Internationalization (Lingui)
- **Linting & Formatting (Biome)**
- **Git Hooks (Lefthook)**
- **Frontend testing (Vitest Browser Mode)**
- Fuzzy search (fuse.js)
- Skill diff view (react-diff-viewer)
- SKILL.md preview (react-markdown)
- Keyboard shortcuts (react-hotkeys-hook)
- Debouncing (use-debounce)
- Focus management (react-focus-lock)
- Workflow DAG visualization (@xyflow/react)
- Workflow graph execution (petgraph + dashmap)
- Semantic search (sqlite‑vss or in‑memory)

### ⚠️ Needs Addition (Libraries)

_All previously identified libraries have been integrated._

### 🔄 Needs Design Refinement (from UX design)

- Workflow Execution Isolation – Each subagent gets a forked conversation context; separate tool call authorization scopes; memory limits.
- Workflow Cancellation & Cleanup – Implement `AbortHandle` pattern; store partial results; emit cancellation events.
- Workflow Retry Logic – Per-step retry with exponential backoff; dead letter queue.
- Nested Workflow Depth Limits – Hard limit of 5 levels; warning at 3; track total active subagents.
- Workflow Result Caching – Hash + cache with TTL; UI indicator for cached results.
- Workflow Templates & Library – Add `workflow_templates` table; marketplace integration; one‑click save as template.

### 📚 Needs Documentation

- Workflow authoring guide (patterns, best practices, debugging).
- Workflow debugging guide (reading DAG, interpreting scores).
- Performance optimization guide (token budget, parallel vs sequential).

---

## Final Tech Stack Completeness Check

### ✅ Fully Covered

- Core agent loop with streaming
- Three‑panel UI with resizable layout
- MCP server discovery and integration
- Skill system with priority resolution
- Workspace context and file scoping
- Branching conversations
- TOON format for token efficiency
- Tool approval flows
- Real‑time event bus
- Internationalization (Lingui)
- Frontend testing (Vitest + Browser Mode)
- Fuzzy search (fuse.js)
- Skill diff view (react-diff-viewer)
- SKILL.md preview (react-markdown)
- Keyboard shortcuts (react-hotkeys-hook)
- Debouncing (use-debounce)
- Focus management (react-focus-lock)
- Workflow DAG visualization (@xyflow/react)
- Workflow graph execution (petgraph + dashmap)
- Semantic search (sqlite‑vss or in‑memory)

---

## Action Items

### Immediate (Pre‑v1)

1.  Add all missing frontend and Rust dependencies (fuse.js, react-diff-viewer, react-markdown, react-hotkeys-hook, use-debounce, react-focus-lock, petgraph, dashmap, sqlite‑vss).
2.  Add Lingui and configure Vite plugin.
3.  Add Vitest and configure in `vite.config.ts`.
4.  Implement workflow execution core in Rust.
5.  Add workflow database tables and migrations.
6.  Create workflow visualization components.
7.  Add workflow events to event bus.
8.  Implement basic workflow tests (Rust + Vitest).

### Short‑term (v1.1)

1.  Add workflow cancellation with UI.
2.  Implement workflow result caching.
3.  Add retry logic for failed steps.
4.  Create workflow authoring documentation.
5.  Add workflow templates to marketplace.

### Long‑term (v2+)

1.  Visual workflow editor.
2.  Workflow A/B testing.
3.  Workflow scheduling.
4.  Advanced analytics dashboard.
5.  Multi‑tenant workflow sharing.
