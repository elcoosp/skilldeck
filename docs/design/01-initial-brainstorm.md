## Design — Section 1: Architecture Overview

The app is structured as three distinct layers:

**1. Rust Core (`src-tauri/core`)**
A library crate that owns all business logic: the agent loop, model abstraction, MCP client, skill engine, plugin loader, and sync engine. It exposes a clean async API consumed by Tauri commands. This crate has zero Tauri dependency — it's pure domain logic, fully testable in isolation.

**2. Tauri Shell (`src-tauri`)**
Thin Tauri application that wires the Rust core to the OS: registers Tauri commands, manages the app window, handles secure credential storage (via the OS keychain), auto-update, and native menus. Also owns the `pg_embed` lifecycle — starts/stops the bundled Postgres instance.

**3. React Frontend (`src`)**
Pure view layer in React + TypeScript. Communicates exclusively via Tauri's `invoke()` command bridge. No business logic. State management via Zustand or Jotai — lightweight, no Redux overhead.

**Plugin boundary:** A separate `core-plugin-api` crate defines the stable ABI — traits for `ModelProvider`, `McpTransport`, `SkillLoader`, and `SyncBackend`. Dynamic plugins implement these traits and are loaded at runtime via `libloading`. ABI stability is enforced via a C-compatible FFI layer using `safer_ffi` or `abi_stable`.

**Data flow at a glance:**
```
React UI → invoke() → Tauri command → Core (Rust) → [Model API / MCP server / DB / Plugin]
                                                     ↑
                                              dyn Plugin (.so/.dll)
```

Does this architecture layer breakdown look right before we go deeper?
