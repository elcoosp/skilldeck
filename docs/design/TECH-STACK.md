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
- **Sync**: Design doc mentions optional remote PostgreSQL sync with last-write-wins strategy
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

| Design Feature                    | Libraries Used                                       |
| --------------------------------- | ---------------------------------------------------- |
| **Three‑panel layout**            | `react-resizable-panels`                             |
| **Streaming agent responses**     | AI SDK `useChat`, Tauri events                       |
| **Tool approval UI**              | AI SDK tool approval + Sonner toasts + shadcn Dialog |
| **Subagent cards**                | React components, Zustand for state                  |
| **Inline branch navigation**      | Zustand + UI state in DB                             |
| **MCP discovery & marketplace**   | TanStack Query (server state), shadcn Dialog/Sheet   |
| **Skill management**              | TanStack Query, filesystem watcher events            |
| **Prompt library with variables** | React Hook Form + zod + shadcn form components       |
| **Command menu (`⌘K`)**           | `cmdk`                                               |
| **Mention picker (`@`)**          | `cmdk` + custom logic                                |
| **Real‑time event display**       | Tauri events + Sonner                                |
| **Usage analytics (optional)**    | Recharts                                             |
| **Long list virtualization**      | `react-virtuoso`                                     |
| **Client state persistence**      | `@tauri-apps/plugin-store`                           |

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
| `futures`              | Stream combinators                                 |
| `config`               | Manage configuration (API keys, skill directories) |
| `cargo-machete`        | Detect unused dependencies (dev tool)              |

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

## Summary

SkillDeck combines modern frontend tooling (React 19, TypeScript, Vite) with a curated set of libraries that directly address the UX goals:

- **AI SDK 6** for agent streaming and tool approval [citation:2]
- **shadcn/ui** + **Radix** for accessible, consistent UI [citation:2][citation:10]
- **TanStack Query** + **Zustand** for robust state management [citation:2][citation:4]
- **react-resizable-panels** for the three‑panel layout
- **cmdk** for command and mention experiences
- **Sonner** for non‑intrusive notifications [citation:7]
- **TOON** for token‑efficient LLM communication [citation:2]

Together with a robust Rust backend (Tauri, Tokio, SeaORM 2.0), this stack delivers a high‑performance, extensible AI agent desktop application that is local‑first, developer‑extensible, and compatible with the Superpowers skill ecosystem.
