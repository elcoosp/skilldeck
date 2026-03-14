# SkillDeck Tech Stack

This document outlines the technology stack and architectural decisions for the SkillDeck project, derived from codebase exploration and design documentation (see `ux-design.md`). It reflects the actual dependencies as defined in `package.json` and `Cargo.toml`.

## Overview

SkillDeck is a Tauri-based desktop application providing an AI agent chat interface with support for MCP servers, a Superpowers-compatible skill system, branching conversations, and a rich workflow orchestration engine. The stack is chosen for performance, developer experience, accessibility, and full alignment with the UX vision.

---

## Frontend

### Core Framework & Build

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7 (using `@vitejs/plugin-react-swc` for fast SWC-based compilation)
- **Language**: TypeScript (strict mode enabled)
- **Package Manager**: pnpm
- **Routing**: React Router DOM v7 (for layout-based routing)

### Testing

- **Test Runner**: [Vitest](https://vitest.dev/) – A Vite-native unit test framework with fast watch mode, built-in TypeScript support, and Jest-compatible API.
- **Environment**: **Vitest Browser Mode**. Tests run in a real browser environment (Chromium, Firefox, WebKit) using `@vitest/browser` and `playwright` for maximum reliability and real user interaction simulation.
- **Configuration**: Vitest configured in `vite.config.ts` alongside Vite, sharing the same transform pipeline.
- **Coverage**: Vitest provides built-in coverage reports via `v8` or `istanbul`.

### UI Component System

- **Component Library**: [shadcn/ui](https://ui.shadcn.com) – copy‑paste components owned directly in the codebase. Built on Radix UI primitives for accessibility.
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite` plugin; shadcn/ui's theming system via CSS variables.
- **Animations**: [framer-motion](https://www.framer.com/motion/) – used for smooth transitions and micro-interactions.
- **Icon Libraries**:
  - [lucide-react](https://lucide.dev) – primary icon set for UI actions.
  - [@icons-pack/react-simple-icons](https://github.com/icons-pack/react-simple-icons) – brand and technology icons (GitHub, Rust, etc.).
- **Fonts**: [@fontsource/poppins](https://fontsource.org/fonts/poppins) – Poppins font family.

**shadcn/ui Setup**:

- CLI: `pnpm dlx shadcn@latest`
- Components stored in `src/components/ui`
- Global CSS in `src/App.css` with Tailwind directives

### Layout & Interaction

- **Resizable Panels**: [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) – implements the three‑panel design with drag handles and persistence of widths.
- **Command Menu**: [cmdk](https://github.com/pacocoursey/cmdk) – powers global search (`⌘K`) and mention picker (`@`).
- **Virtualization**:
  - [@tanstack/react-virtual](https://tanstack.com/virtual) – virtualizes long conversation threads, skill lists, and marketplace results.
- **Keyboard Shortcuts**: [react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook) – declarative keyboard shortcut bindings, supports customizability and conflict detection.
- **Debouncing / Throttling**: [use-debounce](https://github.com/xnimorz/use-debounce) – for search inputs, auto-save drafts, and resize handlers.
- **Focus Management**: [react-focus-lock](https://github.com/theKashey/react-focus-lock) – for modals and dialogs to trap focus.

### State Management

- **Server State**: [TanStack Query](https://tanstack.com/query/latest) – handles data fetching, caching, and background updates for MCP servers, skills list, conversations, and profiles.
- **Client State**: [Zustand](https://github.com/pmndrs/zustand) – manages UI state: active conversation, panel sizes, right panel collapsed state, input drafts, active branch, feature unlock progress, etc.

### AI Integration

- **Agent‑LLM Communication**: [TOON (Token‑Oriented Object Notation)](https://github.com/toon-format/toon) – compact, human‑readable format for sending structured data (tool inputs, skill contexts, conversation state) to the LLM, reducing token usage by ~40% while maintaining or improving accuracy.
  - *Note*: The TypeScript SDK (`@toon-format/toon`) is not yet installed; planned for future integration.

### Real‑time Updates & Notifications

- **Toast Notifications**: [Sonner](https://sonner.emilkowal.ski/) – official toast library for shadcn/ui; used for tool approvals, skill load events, errors.
- **Tauri Events**: Primary real‑time mechanism – Rust core emits events (`agent:token`, `subagent:spawned`, etc.) that React listens to via `@tauri-apps/api/event`.

### Data Visualization

- **Charts**: [Recharts](https://recharts.org/) – for usage analytics (token consumption, cost trends, model usage).
- **Workflow DAG Visualization**: [@xyflow/react](https://reactflow.dev/) (formerly react-flow) – interactive directed acyclic graph (DAG) visualization for workflow execution monitoring. Shows sequential, parallel, and evaluator-optimizer patterns with real-time step status, metrics, and connections.

### Internationalization

- **Library**: [Lingui](https://lingui.dev/) – A powerful internationalization framework for JavaScript projects. Chosen for its React support, rich-text capabilities, and excellent tooling (CLI, Vite plugin, SWC plugin).
- **Core Package**: `@lingui/core` – Core intl functionality.
- **React Integration**: `@lingui/react` with macro support (`@lingui/macro`) for seamless component-based translations.
- **Message Format**: ICU MessageFormat for plurals, genders, and selects.
- **Workflow**: Messages are extracted using the Lingui CLI, compiled into catalogs, and loaded dynamically. The Vite plugin compiles catalogs on the fly during development.
- **Storage**: Translations stored in JSON or PO files.

### Marketplace & Search

- **Fuzzy Search**: [fuse.js](https://fusejs.io/) – client-side fuzzy search for skill marketplace, command palette, and mention picker.
- **Diff Viewer**: [react-diff-viewer](https://github.com/praneshr/react-diff-viewer) – side‑by‑side diff for comparing shadowed skills (workspace vs personal versions).
- **Markdown Rendering**:
  - [react-markdown](https://github.com/remarkjs/react-markdown) – for previewing `SKILL.md` content.
  - **Enhanced Pipeline**: Uses `remark-gfm` (GitHub Flavored Markdown), `rehype-highlight` (syntax highlighting), and `shiki` via `@shikijs/rehype` for rich code block rendering.
  - **Unified**: `unified` with `remark-parse`, `remark-rehype`, and `rehype-stringify` for custom processing.

### Utilities

- **Date Handling**: [date-fns](https://date-fns.org/) – formatting conversation timestamps.
- **Class Name Composition**: `clsx` + `tailwind-merge` (via `cn()` helper) – standard shadcn/ui pattern.
- **Variant Styling**: [class-variance-authority](https://cva.style/) – used for component variants.
- **Accessibility Primitives**: [Radix UI](https://www.radix-ui.com/) – shadcn/ui is built on Radix, ensuring WAI‑ARIA compliance (via the `radix-ui` meta‑package).

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
  - `skilldeck-models` – shared data models and database entities
  - `migration` – SeaORM migration crate

**Key Dependencies**:
| Crate | Purpose |
|-------|---------|
| `tauri` | Core Tauri framework |
| `tauri-plugin-opener` | Open files/URLs |
| `tauri-plugin-shell` | Execute shell commands (MCP stdio) |
| `tauri-plugin-dialog` | Native dialog boxes |
| `tauri-plugin-store` | Persistent key-value store |
| `tauri-plugin-keyring` | Secure credential storage (OS keychain) |
| `tokio` | Async runtime (full features) |
| `sea-orm` | ORM with SQLite support (`sqlx-sqlite`) |
| `serde` / `serde_json` | Serialization |
| `specta` / `tauri-specta` | Type-safe Tauri commands with TypeScript generation |
| `tracing` | Structured logging |

**Additional Rust Crates**:

| Library                 | Purpose                                                                       |
| :---------------------- | :---------------------------------------------------------------------------- |
| `anyhow` / `thiserror`  | Simplified error handling                                                     |
| `async-trait`           | Async trait support                                                           |
| `backoff`               | Exponential backoff for retries                                               |
| `bytes`                 | Efficient buffer handling                                                     |
| `chrono`                | Date/time handling                                                            |
| `config`                | Manage configuration (API keys, skill directories)                            |
| `dashmap`               | Concurrent HashMap for workflow state tracking                                |
| `dirs-next`             | Platform‑specific directories                                                 |
| `futures`               | Stream combinators and async utilities                                        |
| `glob`                  | Pattern matching for skill discovery                                          |
| `notify`                | Filesystem watching for skill directories                                     |
| `notify-debouncer-mini` | Debounced filesystem events                                                   |
| `petgraph`              | Graph data structures for workflow DAG execution                              |
| `reqwest`               | HTTP client for remote MCP registry and model APIs                            |
| `serde_yaml`            | YAML serialization (skill workflow frontmatter)                               |
| `sha2`                  | Hashing for content‑addressable caching                                       |
| `uuid`                  | Generate UUIDs for database primary keys                                      |
| `sea-orm-migration`     | Migration support                                                             |
| `tempfile`              | Temporary files (dev)                                                         |

**Architectural Layers** (as per design):

1. **Rust Core** (`skilldeck-core`) – domain logic, traits for extensibility
2. **Tauri Shell** – commands, window management, secure storage (OS keychain)
3. **React Frontend** – pure view layer

**Plugin System**:

- Traits defined in core for `ModelProvider`, `McpTransport`, `SkillLoader`, `SyncBackend`
- v1 uses static registration; v2 will support dynamic loading (`.so`/`.dll`)

---

## Database

- **Primary Database**: SQLite
- **ORM**: SeaORM 2.0 (with `sqlx-sqlite` and `runtime-tokio-native-tls`).
  - SeaORM 2.0 is a **major release** introducing breaking changes, new features, and an improved developer experience.
- **Schema Tables** (planned): conversations, messages, profiles, MCP servers, skills, sync state, workflow executions, workflow steps, message_embeddings, tool_approvals, etc.
- **Vector Search** (optional): `sqlite-vss` extension for efficient semantic search over message embeddings (not yet added; fallback to in‑memory cosine similarity with `ndarray` planned).

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
  - `tauri.conf.json` – Tauri app config
  - `tsconfig.json` – TypeScript config (bundler mode, React JSX)
  - `vite.config.ts` – Vite + Vitest config
  - `biome.json` – Biome configuration
  - `lefthook.yml` – Lefthook configuration
  - `commitlint.config.js` – Commitlint configuration
  - `cspell.json` – CSpell configuration
  - `lingui.config.ts` – Lingui configuration
- **Rust Workspace**: Managed via top‑level `Cargo.toml` with workspace members

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
| **MCP discovery & marketplace**     | TanStack Query, shadcn Dialog/Sheet                  |
| **Skill management**                | TanStack Query, filesystem watcher events           |
| **Prompt library with variables**   | *(planned: React Hook Form + zod)*                  |
| **Command menu (`⌘K`)**             | `cmdk`                                              |
| **Mention picker (`@`)**            | `cmdk` + `fuse.js` (fuzzy skill search)             |
| **Fuzzy search (marketplace)**      | `fuse.js`                                           |
| **Skill diff view**                 | `react-diff-viewer`                                 |
| **SKILL.md preview**                | `react-markdown` + remark/rehype plugins + `shiki` |
| **Real‑time event display**         | Tauri events + Sonner                               |
| **Usage analytics (charts)**        | Recharts                                            |
| **Long list virtualization**        | `@tanstack/react-virtual`         |
| **Client state persistence**        | `@tauri-apps/plugin-store`                          |
| **Keyboard shortcuts**              | `react-hotkeys-hook`                                |
| **Debouncing / Throttling**         | `use-debounce`                                      |
| **Workflow performance monitoring** | TanStack Query + Recharts (trends/analytics)        |
| **Internationalization**            | Lingui (`@lingui/core`, `@lingui/react`, CLI, Vite) |
| **Animations**                      | `framer-motion`                                     |
| **Frontend testing**                | Vitest (Browser Mode) + Playwright                   |
| **Linting & Formatting**            | Biome                                               |
| **Git Hooks**                       | Lefthook                                            |
| **Commit Linting**                  | Commitlint                                          |
| **Vector search (semantic)**        | *(planned: `sqlite-vss` or in‑memory `ndarray`)*    |

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

Skills declare workflows via YAML frontmatter, parsed by `SkillLoader` (using `serde_yaml`):

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

- Zod schema (planned) will validate workflow config structure
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

## Gap Analysis & Recommendations

### ✅ Fully Covered (Current Dependencies)

- Core agent loop with streaming (Tauri events)
- Three‑panel UI with resizable layout
- MCP server discovery and integration (planned backend)
- Skill system with priority resolution (planned)
- Workspace context and file scoping (planned)
- Branching conversations (planned)
- Real‑time event bus
- Internationalization (Lingui)
- Frontend testing (Vitest + Browser Mode)
- Fuzzy search (fuse.js)
- Skill diff view (react-diff-viewer)
- SKILL.md preview (react-markdown + remark/rehype + shiki)
- Keyboard shortcuts (react-hotkeys-hook)
- Debouncing (use-debounce)
- Focus management (react-focus-lock)
- Workflow DAG visualization (@xyflow/react)
- Workflow graph execution (petgraph + dashmap)
- Animations (framer-motion)
- Virtualization (@tanstack/react-virtual)
- Type-safe Tauri commands (specta)

### ⚠️ Needs Addition (Libraries Not Yet Installed)

- **TOON SDK** (`@toon-format/toon`) – planned for token‑efficient LLM communication.
- **React Hook Form** + **zod** – for form handling and validation (profile creation, settings, prompt variables).
- **sqlite-vss** – optional vector search extension for semantic search (fallback to `ndarray` in‑memory).
- **rayon** – optional data parallelism for parallel workflow steps (may be added later for performance).
- **vaul** – optional drawer component (if slide‑in panel is preferred over overlay for marketplace/settings).

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

## Action Items

### Immediate (Pre‑v1)

1.  Add missing frontend dependencies: `react-hook-form`, `zod`, `@hookform/resolvers`, `@toon-format/toon`.
2.  Add missing Rust dependencies: `rayon` (optional), `sqlite-vss` (optional), `ndarray` (fallback).
3.  Implement workflow execution core in Rust (petgraph, dashmap).
4.  Add workflow database tables and migrations.
5.  Create workflow visualization components.
6.  Add workflow events to event bus.
7.  Implement basic workflow tests (Rust + Vitest).

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
