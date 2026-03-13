---
id: set-up-project-scaffolding-and-directory-structure
title: Set up project scaffolding and directory structure
labels:
  - infrastructure
  - 'priority:must'
  - 'type:chore'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#3-project-scaffolding
state: in-progress
createdAt: '2026-03-12T13:51:42.837Z'
priority: must
effort: 1d
---
## Context

This issue establishes the foundational project structure for SkillDeck v1. The project uses a Tauri 2 desktop application with a Rust core (`skilldeck-core`) and React frontend. Proper scaffolding ensures consistent development workflow and clear separation of concerns.

**Related Plan Section:**
- [Project Scaffolding](../plans/v1.md#3-project-scaffolding) - Canonical file structure

**Related Requirements:**
- [REQ-CON-002](../spec/srs.md#req-con-002) - Tauri 2 framework
- [REQ-CON-006](../spec/srs.md#req-con-006) - React frontend communicates only via Tauri IPC
- [REQ-CON-007](../spec/srs.md#req-con-007) - All business logic in Rust core

**Related Architecture:**
- [ADR-001](../spec/archi.md#adr-001-three-layer-architecture-rust-core--tauri-shell--react-ui) - Three-layer architecture

## Problem Statement

We need to create the complete project scaffolding including the Tauri shell, Rust core library crate, and React frontend with all necessary configuration files, dependencies, and build tooling.

## Solution Approach

### Implementation Details

**Files to create (based on the established tech stack):**

1. **Root configuration files:**
   - `package.json` — Frontend dependencies (React 19, TanStack Query, Zustand, shadcn/ui, Lingui, Vitest, Biome, Lefthook, etc.)
   - `tsconfig.json` — TypeScript configuration with strict mode
   - `vite.config.ts` — Vite build configuration (includes Vitest)
   - `tailwind.config.ts` — Tailwind CSS configuration
   - `postcss.config.js` — PostCSS configuration
   - `biome.json` — Biome configuration (linting & formatting) – replaces ESLint + Prettier
   - `lefthook.yml` — Lefthook Git hooks configuration
   - `commitlint.config.js` — Commitlint for conventional commits
   - `cspell.json` — CSpell configuration
   - `lingui.config.ts` — i18n configuration

2. **Tauri configuration:**
   - `src-tauri/Cargo.toml` — Workspace with `skilldeck-core` member
   - `src-tauri/tauri.conf.json` — Tauri configuration
   - `src-tauri/build.rs` — Build script
   - `src-tauri/src/main.rs` — Entry point
   - `src-tauri/src/lib.rs` — Library root

3. **Rust core library:**
   - `src-tauri/skilldeck-core/Cargo.toml` — Core dependencies
   - `src-tauri/skilldeck-core/src/lib.rs` — Core library entry
   - `src-tauri/skilldeck-core/src/error.rs` — Core error types (stub)
   - Additional modules (agent, mcp, skills, workflow, workspace, etc.) as defined in the plan

4. **Migration crate (separate workspace member):**
   - `src-tauri/migration/Cargo.toml` — Migration crate manifest
   - `src-tauri/migration/src/lib.rs` — Migration registry
   - `src-tauri/migration/src/main.rs` — CLI entry point for migrations
   - `src-tauri/migration/src/m20260313_000001_initial.rs` — Initial migration (35 tables)

5. **Frontend structure:**
   - `src/main.tsx` — React entry point
   - `src/App.tsx` — Root component
   - `src/index.css` — Global styles (Tailwind + shadcn/ui)
   - `src/lib/` — Utility libraries (invoke, events, types)
   - `src/store/` — Zustand stores (ui, settings, unlock)
   - `src/hooks/` — React hooks (use-agent-stream, use-conversations, etc.)
   - `src/components/` — UI components (shadcn/ui + custom)
   - `src/locales/` — i18n messages (Lingui catalogs)
   - `src/test/` — Test setup (Vitest browser mode)

6. **Test directories:**
   - `tests/features/` — BDD feature files
   - `tests/integration/` — Integration tests (Rust + frontend)
   - `tests/performance/` — Performance benchmarks
   - `tests/security/` — Security tests

**Key interfaces:**
- `skilldeck-core` crate must have zero Tauri dependencies
- React frontend must communicate only via `@tauri-apps/api` invoke

## Current State

- ✅ Rust core library (`skilldeck-core`) is scaffolded with module stubs (error, agent, mcp, skills, workflow, workspace, etc.)
- ✅ Migration crate (`migration`) exists and contains the initial migration with all 35 tables
- ✅ Core library builds successfully (`cargo test` passes)
- ❌ Tauri shell (`src-tauri`) is not yet created
- ❌ React frontend is not yet created
- ❌ Root configuration files (package.json, biome.json, lefthook.yml, etc.) are not yet present

## Acceptance Criteria

- [x] Rust core library exists with proper module structure
- [x] Migration crate exists with initial migration
- [ ] Tauri shell exists with workspace configuration
- [ ] React frontend exists with all necessary configuration files
- [ ] `cargo build` succeeds for both Tauri app and skilldeck-core (Tauri app not present)
- [ ] `pnpm install` succeeds with all frontend dependencies (frontend not present)
- [ ] `pnpm tauri dev` launches development server (not present)
- [x] `cargo test` runs without errors (core library tests pass)
- [ ] `pnpm test` runs without errors (no frontend)
- [ ] Biome configuration is valid (not yet added)
- [ ] TypeScript compiles without errors (not present)

## Testing Requirements

**Unit tests:**
- [x] Verify Cargo.toml workspace configuration (core library has its own Cargo.toml)
- [x] Verify migration crate compiles (as part of `cargo test`)

**Integration tests:**
- [ ] Verify Tauri dev server starts

## Dependencies

- **Blocked by:** None
- **Blocks:** All subsequent implementation issues

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d (partial completion)

**Completion Note:** The Rust core library and migration crate are fully scaffolded. The Tauri shell, React frontend, and root configuration files remain to be added. The project scaffolding is partially complete; future issues will add the missing components along with dev tooling (Biome, Lefthook, etc.).
