# SkillDeck Tech Stack

This document outlines the technology stack and architectural decisions for the SkillDeck project, derived from codebase exploration and design documentation.

## Overview

SkillDeck is a Tauri-based desktop application providing an AI agent chat interface with support for MCP servers, a Superpowers-compatible skill system, and branching conversations. The stack is chosen for performance, developer experience, and extensibility.

---

## Frontend

### Core Framework & Build

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Language**: TypeScript (strict mode enabled)
- **Package Manager**: pnpm (indicated in `tauri.conf.json`)
- **Routing**: Not required for core experience (panels are layout-based). If needed for settings/marketplace overlays, will use in-memory routing via state or simple conditional rendering.

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
- **Virtualization**: [react-virtuoso](https://github.com/petyosi/react-virtuoso) – virtualizes long conversation threads and skill lists to maintain performance with thousands of items.

### State Management

- **Server State**: [TanStack Query](https://tanstack.com/query/latest) – handles data fetching, caching, and background updates for MCP servers, skills list, conversations, and profiles.
- **Client State**: [Zustand](https://github.com/pmndrs/zustand) – manages UI state: active conversation, panel sizes, right panel collapsed state, input drafts, active branch, etc.

### Forms & Validation

- **Form Handling**: [React Hook Form](https://react-hook-form.com/) – for profile creation, settings, prompt variable filling.
- **Validation**: [zod](https://zod.dev/) + [@hookform/resolvers](https://github.com/react-hook-form/resolvers) – schema validation for forms.

### AI Integration

- **AI SDK**: [Vercel AI SDK 6](https://sdk.vercel.ai/docs) – provides `useChat` hook for streaming responses, tool call handling, and multi‑step agent workflows. Its **agent abstraction** includes built‑in support for **tool approval gates** (pauses the loop until user confirms), matching the design's approval UI [citation:2].
- **Agent‑LLM Communication**: [TOON (Token‑Oriented Object Notation)](https://github.com/toon-format/toon) – compact, human‑readable format for sending structured data (tool inputs, skill contexts, conversation state) to the LLM, reducing token usage by ~40% while maintaining or improving accuracy [citation:2].
  - **Implementation**: Use TypeScript SDK (`@toon-format/toon`) on the frontend when preparing data for Tauri commands that will be forwarded to the LLM.
  - Wrap TOON data in markdown code blocks (```toon) to help the LLM identify the format.

### Real‑time Updates & Notifications

- **Toast Notifications**: [Sonner](https://sonner.emilkowal.ski/) – official toast library for shadcn/ui; used for tool approvals, skill load events, errors [citation:7].
- **Tauri Events**: Primary real‑time mechanism – Rust core emits events (`agent:token`, `subagent:spawned`, etc.) that React listens to via `@tauri-apps/api/event`.

### Data Visualization

- **Charts (optional)**: [Recharts](https://recharts.org/) – for usage analytics (token consumption, cost) if implemented [citation:8].
- **Workflow DAG Visualization**: [@xyflow/react](https://reactflow.dev/) (formerly react-flow) – interactive directed acyclic graph (DAG) visualization for workflow execution monitoring. Shows sequential, parallel, and evaluator-optimizer patterns with real-time step status, metrics, and connections.
  - **Installation**: `pnpm add @xyflow/react`
  - **Use case**: Right panel workflow visualization showing step dependencies, execution status, quality scores, and performance metrics
  - **Features**: Auto-layout, zoom/pan, minimap, collapsible step groups for nested workflows

### Utilities

- **Date Handling**: [date-fns](https://date-fns.org/) – formatting conversation timestamps.
- **Class Name Composition**: `clsx` + `tailwind-merge` (via `cn()` helper) – standard shadcn/ui pattern.
- **Variant Styling**: [class-variance-authority](https://cva.style/) – used for component variants (already part of shadcn).
- **Accessibility Primitives**: [Radix UI](https://www.radix-ui.com/) – shadcn/ui is built on Radix, ensuring WAI‑ARIA compliance.

---

## Backend (Rust)

- **Core Framework**: Tauri 2
- **Language**: Rust (edition 2021)
- **Workspace Structure**:
  - `src-tauri` – main Tauri application shell
  - `skilldeck-core` – separate library crate for business logic (agent loop, MCP, skills, etc.)

**Key Dependencies**:
| Crate | Purpose |
|-------|---------|
| `tauri` | Core Tauri framework |
| `tauri-plugin-opener` | Open files/URLs |
| `tauri-plugin-shell` | Execute shell commands (MCP stdio) |
| `tokio` | Async runtime (full features) |
| `sea-orm` | ORM with SQLite support (`sqlx-sqlite`) |
| `serde` / `serde_json` | Serialization |

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
- **Schema Tables** (planned): conversations, messages, profiles, MCP servers, skills, sync state, etc. (29 tables across 10 domains)

---

## Build & Tooling

- **Build Commands**:
  - `pnpm dev` – runs Vite dev server
  - `pnpm build` – builds frontend
  - `cargo tauri dev` – runs Tauri dev with frontend
- **Configuration Files**:
  - `tauri.conf.json` – Tauri app config (product name, identifier, windows, icons)
  - `tsconfig.json` – TypeScript config (bundler mode, React JSX)
  - `vite.config.ts` – Vite config tailored for Tauri
- **Rust Workspace**: Managed via `Cargo.toml` in root of `src-tauri` with workspace members

---

## Key Design Features & Library Mapping

| Design Feature                      | Libraries Used                                       |
| ----------------------------------- | ---------------------------------------------------- |
| **Three‑panel layout**              | `react-resizable-panels`                             |
| **Streaming agent responses**       | AI SDK `useChat`, Tauri events                       |
| **Tool approval UI**                | AI SDK tool approval + Sonner toasts + shadcn Dialog |
| **Subagent cards**                  | React components, Zustand for state                  |
| **Workflow orchestration**          | Core Rust orchestrator + Tauri events                |
| **Workflow DAG visualization**      | `@xyflow/react` + Zustand                            |
| **Inline branch navigation**        | Zustand + UI state in DB                             |
| **MCP discovery & marketplace**     | TanStack Query (server state), shadcn Dialog/Sheet   |
| **Skill management**                | TanStack Query, filesystem watcher events            |
| **Prompt library with variables**   | React Hook Form + zod + shadcn form components       |
| **Command menu (`⌘K`)**             | `cmdk`                                               |
| **Mention picker (`@`)**            | `cmdk` + custom logic                                |
| **Real‑time event display**         | Tauri events + Sonner                                |
| **Usage analytics (optional)**      | Recharts                                             |
| **Long list virtualization**        | `react-virtuoso`                                     |
| **Client state persistence**        | `@tauri-apps/plugin-store`                           |
| **Workflow performance monitoring** | TanStack Query + Recharts (trends/analytics)         |

---

## Additional Recommended Libraries

### Rust (Backend)

| Library                | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `anyhow` / `thiserror` | Simplified error handling                          |
| `tracing`              | Structured logging                                 |
| `notify`               | Filesystem watching for skill directories          |
| `glob`                 | Pattern matching for skill discovery               |
| `uuid`                 | Generate UUIDs for database primary keys           |
| `chrono` / `time`      | Date/time handling                                 |
| `reqwest`              | HTTP client for remote MCP registry and model APIs |
| `futures`              | Stream combinators and async utilities             |
| `config`               | Manage configuration (API keys, skill directories) |
| `cargo-machete`        | Detect unused dependencies (dev tool)              |
| `petgraph`             | Graph data structures for workflow DAG execution   |
| `dashmap`              | Concurrent HashMap for workflow state tracking     |

### Frontend (TypeScript/React) – Already covered above.

### Dev Tooling

| Tool                    | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `cargo-watch`           | Automatically run tests/lints on file changes |
| `husky` + `lint-staged` | Git hooks for code quality                    |
| `prettier` / `rustfmt`  | Consistent code formatting                    |

---

## Testing Strategy

- **Unit Tests**: In core crate with mocked traits
- **Integration Tests**: Using local Ollama
- **E2E Tests**: Tauri WebDriver for critical paths (minimal)

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

- **AI SDK 6** for agent streaming and tool approval [citation:2]
- **shadcn/ui** + **Radix** for accessible, consistent UI [citation:2][citation:10]
- **TanStack Query** + **Zustand** for robust state management [citation:2][citation:4]
- **react-resizable-panels** for the three‑panel layout
- **cmdk** for command and mention experiences
- **Sonner** for non‑intrusive notifications [citation:7]
- **TOON** for token‑efficient LLM communication [citation:2]
- **@xyflow/react** for workflow DAG visualization
- **petgraph** + **dashmap** for workflow orchestration in Rust

Together with a robust Rust backend (Tauri, Tokio, SeaORM 2.0), this stack delivers a high‑performance, extensible AI agent desktop application that is local‑first, developer‑extensible, and compatible with the Superpowers skill ecosystem.

### Workflow Pattern Support

The stack fully supports the three production-proven workflow patterns:

- **Sequential workflows** for dependent multi-stage tasks
- **Parallel workflows** for concurrent execution and aggregation
- **Evaluator-optimizer workflows** for iterative quality refinement

All patterns are composable, monitorable, and cost-tracked at the per-step level.

---

## Gap Analysis & Recommendations

### Missing Dependencies to Add

#### Frontend

1. **`@xyflow/react`** – Required for workflow DAG visualization (not yet in package.json)

   ```bash
   pnpm add @xyflow/react
   ```

2. **`yaml`** – Parse YAML frontmatter in skill files (unless using `gray-matter` which includes it)

   ```bash
   pnpm add yaml
   ```

3. **`@tanstack/react-virtual`** – Alternative to react-virtuoso if sticking with TanStack ecosystem
   - Current choice: `react-virtuoso` is fine, but worth noting for consistency

#### Rust Backend

1. **`petgraph`** – Graph algorithms for workflow DAG execution

   ```toml
   petgraph = "0.6"
   ```

2. **`dashmap`** – Concurrent hash map for workflow state tracking

   ```toml
   dashmap = "5.5"
   ```

3. **`daggy`** or **`petgraph`** – For workflow dependency resolution
   - Recommendation: Use `petgraph` (more mature, better docs)

4. **`rayon`** – Data parallelism for parallel workflow execution (optional optimization)
   ```toml
   rayon = "1.8"
   ```

### Architecture Considerations

#### 1. Workflow Execution Isolation

**Current gap:** Design doesn't specify how subagent contexts are isolated from parent.

**Recommendation:**

- Each subagent gets a forked conversation context (immutable snapshot)
- Separate tool call authorization scopes (subagent can't approve tools parent requires)
- Memory limits per workflow execution to prevent runaway token usage

#### 2. Workflow Cancellation & Cleanup

**Current gap:** No detailed cancellation strategy for long-running workflows.

**Recommendation:**

- Implement `AbortHandle` pattern in Rust for graceful cancellation
- Store partial results on cancellation for user inspection
- Emit `workflow:cancelled` event with reason and cleanup status
- Add "Cancel workflow" button to UI with confirmation dialog

#### 3. Workflow Retry Logic

**Current gap:** No retry strategy for failed workflow steps.

**Recommendation:**

- Per-step retry configuration: `max_retries`, `backoff_strategy`
- Exponential backoff for transient failures (rate limits, network)
- Dead letter queue for persistently failing steps
- UI shows retry counter and allows manual retry override

#### 4. Nested Workflow Depth Limits

**Current gap:** No protection against deeply nested workflows causing stack overflow or excessive complexity.

**Recommendation:**

- Hard limit: 5 levels of workflow nesting (configurable)
- Emit warning at 3 levels, reject at 6+
- Track total active subagents across all workflows (limit: 50)

#### 5. Workflow Result Caching

**Current gap:** Identical workflows re-execute even if inputs unchanged.

**Recommendation:**

- Hash workflow config + input data → cache key
- Store cached results in `workflow_cache` table with TTL
- Cache hit → instant return (no LLM calls)
- UI indicator: "Using cached result from 2h ago"

#### 6. Workflow Templates & Library

**Current gap:** No UI for browsing/sharing successful workflow patterns.

**Recommendation:**

- Add `workflow_templates` table
- Marketplace includes workflow templates alongside skills
- One-click "Save as template" from executed workflow
- Community ratings and token efficiency metrics

### Testing Additions Needed

#### Unit Tests

- Workflow graph cycle detection
- Parallel aggregation strategies (voting, union, best_of)
- Evaluator-optimizer stopping criteria edge cases
- TOON encoding/decoding for workflow configs

#### Integration Tests

- Sequential workflow with 5+ steps
- Parallel workflow with conflicting outputs
- Evaluator-optimizer hitting max iterations
- Workflow cancellation mid-execution
- Nested workflow (sequential → parallel → eval-opt)

#### Performance Tests

- 10 parallel subagents spawned simultaneously
- 100-step sequential workflow memory usage
- Workflow execution with 1M tokens total
- Database write throughput for workflow events

### Documentation Gaps

#### 1. Workflow Authoring Guide

**Need:** Step-by-step tutorial for skill developers creating workflows

- Examples of each pattern
- Best practices for step granularity
- Performance optimization tips
- Common pitfalls and debugging

#### 2. Workflow Debugging Guide

**Need:** User-facing documentation on debugging failed workflows

- How to read the DAG visualization
- Interpreting quality scores
- Understanding why a step failed
- Replaying individual steps

#### 3. Workflow Performance Guide

**Need:** Cost and latency optimization strategies

- When to use each pattern
- Token budget planning
- Parallelization vs. sequential trade-offs
- Caching strategies

### Optional Enhancements (v2+)

1. **Workflow Versioning** – Track schema evolution, allow rollback
2. **A/B Testing** – Run two workflow variants, compare results
3. **Workflow Scheduling** – Cron-like execution for batch tasks
4. **Human-in-the-Loop** – Pause workflow for manual approval/input
5. **Workflow Marketplace** – Share and monetize successful patterns
6. **Visual Workflow Editor** – Drag-and-drop workflow design (like n8n)
7. **Workflow Analytics Dashboard** – Cost trends, success rates, bottlenecks
8. **Multi-tenant Workflows** – Team-shared workflow configurations

---

## Final Tech Stack Completeness Check

### ✅ Fully Covered

- Core agent loop with streaming
- Three-panel UI with resizable layout
- MCP server discovery and integration
- Skill system with priority resolution
- Workspace context and file scoping
- Branching conversations
- TOON format for token efficiency
- Tool approval flows
- Real-time event bus

### ⚠️ Needs Addition (Libraries)

- `@xyflow/react` – Workflow DAG visualization
- `petgraph` – Workflow graph execution
- `dashmap` – Concurrent workflow state

### 🔄 Needs Design Refinement

- Workflow cancellation strategy
- Nested workflow depth limits
- Workflow result caching
- Retry and error handling for workflows
- Workflow templates/marketplace

### 📚 Needs Documentation

- Workflow authoring guide
- Workflow debugging guide
- Performance optimization guide

---

## Action Items

### Immediate (Pre-v1)

1. Add `@xyflow/react`, `petgraph`, `dashmap` to dependencies
2. Implement workflow execution core in Rust
3. Add workflow database tables and migrations
4. Create workflow visualization components
5. Add workflow events to event bus
6. Implement basic workflow tests

### Short-term (v1.1)

1. Add workflow cancellation with UI
2. Implement workflow result caching
3. Add retry logic for failed steps
4. Create workflow authoring documentation
5. Add workflow templates to marketplace

### Long-term (v2+)

1. Visual workflow editor
2. Workflow A/B testing
3. Workflow scheduling
4. Advanced analytics dashboard
5. Multi-tenant workflow sharing
