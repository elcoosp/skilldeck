# SkillDeck Tech Stack

This document outlines the technology stack and architectural decisions for the SkillDeck project, derived from codebase exploration and design documentation.

## Overview

SkillDeck is a Tauri-based desktop application providing an AI agent chat interface with support for MCP servers, a Superpowers-compatible skill system, and branching conversations. The stack is chosen for performance, developer experience, and extensibility.

---

## Frontend

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Language**: TypeScript (strict mode enabled)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com) – a collection of reusable components that are added as source code, allowing full customization. Components follow accessibility best practices and are styled with Tailwind CSS.
- **Icon Libraries**:
  - [lucide-react](https://lucide.dev) – primary icon set for consistent, crisp icons
  - [@icons-pack/react-simple-icons](https://github.com/icons-pack/react-simple-icons) – for brand and technology icons (e.g., GitHub, Twitter, Rust, etc.)
    - **Installation**: `pnpm add @icons-pack/react-simple-icons`
    - **Usage**: Icons are exported with the `Si` prefix and use upperCamelCase naming (e.g., `SiReact` for React, `SiAzuredevops` for Azure DevOps).
    - **Basic example**:

      ```tsx
      import { SiReact } from "@icons-pack/react-simple-icons";

      function Example() {
        return <SiReact color="#61DAFB" size={24} />;
      }
      ```

    - **Default brand color**: Set `color='default'` to use the icon's official brand color, or import the hex value directly (e.g., `SiReactHex`) for custom styling.
    - **TypeScript support**: The package includes built-in type declarations.

- **Styling**: Tailwind CSS with shadcn/ui's theming system; custom CSS (App.css) will be replaced by shadcn's global CSS variables defined in the Tailwind configuration.
- **State Management**: Lightweight solution (Zustand or Jotai as mentioned in design docs) — not yet visible in current scaffolding
- **Tauri Integration**: `@tauri-apps/api` for invoking backend commands and event handling
- **Package Manager**: pnpm (indicated in `tauri.conf.json`)

**Key Frontend Files**:

- `src/App.tsx` – basic starter component with greet functionality (to be replaced with shadcn/ui components)
- `src/main.tsx` – entry point
- `vite.config.ts` – configured for Tauri with custom server port (1420) and HMR settings

**shadcn/ui Setup**:

- Project uses `pnpm dlx shadcn@latest` for CLI commands
- Components are added via `pnpm dlx shadcn@latest add <component>` and stored in `src/components/ui`
- Global CSS is managed in the project's main CSS file (e.g., `src/index.css`) with Tailwind directives and CSS variables

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
2. **Tauri Shell** – commands, window management, secure storage, `pg_embed` lifecycle (though SQLite may be used locally)
3. **React Frontend** – pure view layer

**Plugin System**:

- Traits defined in core for `ModelProvider`, `McpTransport`, `SkillLoader`, `SyncBackend`
- v1 uses static registration; v2 will support dynamic loading (`.so`/`.dll`)

---

## Database

- **Primary Database**: SQLite (inferred from `sea-orm` feature `sqlx-sqlite` and no `pg_embed` in dependencies)
- **ORM**: SeaORM 2.0 (with `sqlx-sqlite` and `runtime-tokio-native-tls`).
  - SeaORM 2.0 is a **major release** introducing breaking changes, new features, and an improved developer experience.
  - **Migration**: When upgrading from 1.x, refer to the official [What's New in SeaORM 2.0](https://www.sea-ql.org/SeaORM/docs/introduction/whats-new/) guide for detailed migration steps and feature highlights, including integration with SeaORM Pro, SeaQuery updates, and full-stack Rust application support.
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

## Key Design Features

| Feature                    | Implementation                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Agent Loop**             | Async Rust loop with tool dispatch, streaming events via Tauri                                                    |
| **MCP Discovery**          | Local port scanner + remote registry browser                                                                      |
| **Skill System**           | Superpowers-compatible `SKILL.md` files with priority resolution (project > personal > superpowers > marketplace) |
| **Profiles**               | Saved configurations with model, MCP servers, skills                                                              |
| **Conversation Branching** | Tree structure via `parent_id` in messages; inline branch navigation                                              |
| **Subagents**              | Concurrent agent instances with merge strategies                                                                  |
| **Tool Approval**          | Pause loop for destructive tool calls, user approval UI                                                           |
| **Sync**                   | Manual/auto sync with remote Postgres (planned)                                                                   |

---

## Testing Strategy

- **Unit Tests**: In core crate with mocked traits
- **Integration Tests**: local Ollama
- **E2E Tests**: Tauri WebDriver for critical paths (minimal)

---

## Current State vs. Design

The current scaffolding is minimal (Tauri + React starter) but includes:

- Workspace setup with `skilldeck-core`
- Basic Tauri commands (`greet` in `lib.rs`)
- SeaORM dependency with SQLite
- Design documents in `docs/` detailing the full vision

Planned additions (from design) include the agent core, MCP discovery, skill loading, and the three-panel UI built with shadcn/ui components.

---

## Summary

SkillDeck combines modern frontend tooling (React, TypeScript, Vite, shadcn/ui, lucide-react, @icons-pack/react-simple-icons) with a robust Rust backend (Tauri, Tokio, SeaORM 2.0) to deliver a high-performance, extensible AI agent desktop application. The stack prioritizes local-first data, developer extensibility via traits/plugins, and compatibility with the Superpowers skill ecosystem.
