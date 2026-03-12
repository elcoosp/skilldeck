---

## 📋 Architecture & Design Specification — SkillDeck v1

| Field | Value |
|-------|-------|
| Project | SkillDeck v1 |
| Document | Architecture & Design Specification |
| Version | 0.1 (Draft) |
| Date | 2025-01-15 |
| Author | Project Lead, assisted by AI |
| Status | Draft — Pending Review |
| References | SkillDeck v1 Vision (v0.1), BRS/StRS (v0.1), SRS (v0.1), Implementation Plan (v1.0) |

---

## 1. Context & Scope

### 1.1 Objective

Define the architectural foundation for SkillDeck v1 — a local-first, reactive, event-driven state machine wrapped in a Tauri desktop shell.

### 1.2 Architectural Constraints

| ID              | Constraint                               | Source                  |
| --------------- | ---------------------------------------- | ----------------------- |
| **REQ-CON-001** | Desktop-only (macOS, Windows, Linux)     | Scope decision          |
| **REQ-CON-002** | Tauri 2 framework                        | Technology decision     |
| **REQ-CON-003** | SQLite with WAL mode                     | Local-first requirement |
| **REQ-CON-006** | React frontend communicates only via IPC | Architecture decision   |
| **REQ-CON-007** | All business logic in Rust core          | DDD principle           |

### 1.3 Primary Architectural Constraint: IPC Boundary

The **IPC Boundary** between Rust (source of truth) and React (projection) is the defining architectural constraint of SkillDeck. The system optimizes for data integrity across this boundary through:

1. **Tiered Streaming** — Ring buffer → 50ms debounced emit → `requestAnimationFrame` render
2. **Non-Blocking Supervision** — MCP process health loop runs independently; approval gate via oneshot channels
3. **Graph-Based Orchestration** — Petgraph DiGraph for workflow DAG execution

---

## 2. Goals & Non-Goals

### 2.1 Design Goals

| ID       | Goal                                             | ASR Reference              |
| -------- | ------------------------------------------------ | -------------------------- |
| **DG-1** | Preserve data integrity across IPC boundary      | REQ-REL-001, REQ-REL-002   |
| **DG-2** | Maintain UI responsiveness under load            | REQ-PERF-002, REQ-PERF-003 |
| **DG-3** | Enable seamless streaming from model providers   | REQ-PERF-002, REQ-FUNC-012 |
| **DG-4** | Provide transparent, controllable tool execution | REQ-SEC-002, REQ-FUNC-076  |
| **DG-5** | Support extensible skill and MCP ecosystems      | REQ-FUNC-040, REQ-FUNC-065 |
| **DG-6** | Enable multi-agent workflow orchestration        | REQ-FUNC-085, REQ-FUNC-095 |

### 2.2 Design Non-Goals

| ID        | Non-Goal                           | Rationale                                                |
| --------- | ---------------------------------- | -------------------------------------------------------- |
| **DNG-1** | Cloud synchronization in v1        | Deferred to v2 (architecture supports extension point)   |
| **DNG-2** | Mobile or web deployment           | Desktop-only per REQ-CON-001                             |
| **DNG-3** | Built-in LLM inference             | External providers per REQ-CON-005                       |
| **DNG-4** | Real-time multi-user collaboration | No cloud backend per REQ-CON-004                         |
| **DNG-5** | Microservices architecture         | Monolithic Rust core + UI is appropriate for desktop app |

---

## 3. Architecturally Significant Requirements (ASRs)

### 3.1 Performance ASRs

| ASR ID           | Requirement                              | Impact on Architecture                                                                |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| **ASR-PERF-001** | Message render latency < 100ms (p99)     | Ring buffer + 50ms debounce + requestAnimationFrame rendering; streaming architecture |
| **ASR-PERF-002** | UI maintains 60fps during operations     | All blocking operations off main thread; IPC batching; virtual list rendering         |
| **ASR-PERF-003** | App startup < 3 seconds                  | Lazy loading of non-critical services; background initialization                      |
| **ASR-PERF-004** | Search across 1000 conversations < 500ms | SQLite FTS indexing; pagination                                                       |

### 3.2 Reliability ASRs

| ASR ID          | Requirement                  | Impact on Architecture                                                |
| --------------- | ---------------------------- | --------------------------------------------------------------------- |
| **ASR-REL-001** | No data loss on crash        | SQLite WAL mode; write-ahead logging; crash recovery on startup       |
| **ASR-REL-002** | MCP server supervision       | Health monitoring loop; exponential backoff restart; max retry limits |
| **ASR-REL-003** | Model API retry with backoff | Provider abstraction with retry middleware; error classification      |

### 3.3 Security ASRs

| ASR ID          | Requirement                    | Impact on Architecture                                     |
| --------------- | ------------------------------ | ---------------------------------------------------------- |
| **ASR-SEC-001** | API keys in OS keychain only   | Credential service abstraction; no plaintext in DB/config  |
| **ASR-SEC-002** | Tool call approval gates       | Approval gate mechanism with oneshot channels; UI blocking |
| **ASR-SEC-003** | Symlink skip in skill scanning | Symlink detection in skill scanner; security boundary      |

### 3.4 Structural ASRs

| ASR ID          | Requirement                     | Impact on Architecture                                        |
| --------------- | ------------------------------- | ------------------------------------------------------------- |
| **ASR-STR-001** | All business logic in Rust      | `skilldeck-core` crate with zero Tauri dependencies           |
| **ASR-STR-002** | IPC-only frontend communication | Command pattern; typed API layer; no direct DB access from UI |
| **ASR-STR-003** | Multi-agent workflow support    | Petgraph DAG execution; subagent forking; session isolation   |

---

## 4. Architecture Design

### 4.1 System Overview

SkillDeck is architected as a **Reactive, Event-Driven State Machine** with three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                     REACT FRONTEND                               │
│  (Pure View Layer — communicates only via Tauri IPC)            │
│                                                                  │
│  Zustand (UI state)    TanStack Query (server state)            │
│  shadcn/ui components  React 19                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Tauri IPC (invoke + events)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TAURI SHELL                                  │
│  (Thin OS Integration Layer)                                     │
│                                                                  │
│  AppState registration   Command handlers                        │
│  Event bridging          OS keychain bridge                      │
│  Approval gate queue     Window management                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Direct API calls
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RUST CORE (skilldeck-core)                   │
│  (Pure Library Crate — Zero Tauri Dependency)                    │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Agent Loop  │ │ Skill       │ │ MCP         │               │
│  │             │ │ System      │ │ Client      │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Workflow    │ │ Provider    │ │ Workspace   │               │
│  │ Orchestrator│ │ Abstraction │ │ Detector    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ DB Layer    │ │ TOON        │ │ Search      │               │
│  │ (SeaORM)    │ │ Encoder     │ │ Engine      │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 IPC Boundary Design Decisions

#### 4.2.1 Streaming Pattern

The streaming pattern addresses ASR-PERF-001 (100ms render latency) while respecting the IPC boundary:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STREAMING ARCHITECTURE                             │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │  Model Provider │                                                        │
│  │  (Claude/OpenAI)│                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           │ SSE stream of tokens                                            │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         AGENT LOOP                                   │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    RING BUFFER                               │    │    │
│  │  │                                                              │    │    │
│  │  │  • Fixed-size buffer (capacity: 1000 tokens)                │    │    │
│  │  │  • Accumulates tokens from model stream                     │    │    │
│  │  │  • Thread-safe: crossbeam-queue or tokio::sync::mpsc       │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              │                                       │    │
│  │                              │ buffer not empty                      │    │
│  │                              ▼                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                  DEBOUNCE TIMER                              │    │    │
│  │  │                                                              │    │    │
│  │  │  • 50ms debounce window                                     │    │    │
│  │  │  • Coalesces multiple token arrivals                        │    │    │
│  │  │  • Ensures max 20 IPC events per second                     │    │    │
│  │  │  • Immediate flush on: Done event or buffer > 100 tokens    │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              │                                       │    │
│  │                              │ flush event                          │    │
│  │                              ▼                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    IPC EMIT                                  │    │    │
│  │  │                                                              │    │    │
│  │  │  • AgentEvent::TokenBatch { tokens: Vec<String> }          │    │    │
│  │  │  • Tauri event emission (non-blocking)                      │    │    │
│  │  │  • Async emission to all subscribed frontends              │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    │ Tauri IPC event                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       REACT FRONTEND                                │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                  useAgentStream hook                         │    │    │
│  │  │                                                              │    │    │
│  │  │  • Listens to AgentEvent::TokenBatch                        │    │    │
│  │  │  • Appends to Zustand streamingText (per conversation)      │    │    │
│  │  │  • Uses requestAnimationFrame for DOM updates               │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              │                                       │    │
│  │                              │ rAF callback                         │    │
│  │                              ▼                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                   MESSAGE BUBBLE                             │    │    │
│  │  │                                                              │    │    │
│  │  │  • React renders streamingText                              │    │    │
│  │  │  • Markdown parsed with react-markdown                      │    │    │
│  │  │  • Virtualized list maintains scroll position               │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

LATENCY ANALYSIS:

  Token received from model
           │
           ▼
    Ring buffer (immediate)
           │
           ▼
    Debounce wait (0-50ms)
           │
           ▼
    IPC emit (~1ms)
           │
           ▼
    Event to React (~1ms)
           │
           ▼
    rAF wait (0-16ms)
           │
           ▼
    DOM render (~5ms)

  Total latency: 7-73ms (well under 100ms target)
```

**Design Rationale:**

| Decision                               | Rationale                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| **Ring buffer**                        | Decouples token rate from emission rate; prevents backpressure                   |
| **50ms debounce**                      | Balance between responsiveness (lower latency) and IPC efficiency (fewer events) |
| **Immediate flush on Done/buffer>100** | Ensures responsiveness for short responses and completion events                 |
| **requestAnimationFrame**              | Ensures renders happen in browser frame budget; prevents jank                    |

#### 4.2.2 Approval Gate Pattern

The approval gate pattern addresses ASR-SEC-002 (tool approval) with non-blocking semantics:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPROVAL GATE ARCHITECTURE                            │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │  Tool Call      │                                                        │
│  │  Request        │                                                        │
│  │  (from model)   │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      TOOL DISPATCHER                                 │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │              APPROVAL CHECK                                 │    │    │
│  │  │                                                              │    │    │
│  │  │  if (autoApproveReads && tool.category == "file_read") {    │    │    │
│  │  │      execute_immediately(tool);                             │    │    │
│  │  │  } else {                                                    │    │    │
│  │  │      create_approval_gate(tool);                            │    │    │
│  │  │  }                                                           │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              │                                       │    │
│  │                              │ requires approval                     │    │
│  │                              ▼                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                APPROVAL GATE CREATION                        │    │    │
│  │  │                                                              │    │    │
│  │  │  1. Generate approval_id (UUID)                             │    │    │
│  │  │  2. Create oneshot channel (tx, rx)                         │    │    │
│  │  │  3. Store (approval_id, tx) in DashMap                     │    │    │
│  │  │  4. Store cancel_token in DashMap                           │    │    │
│  │  │  5. Emit ToolCallPending event with approval_id             │    │    │
│  │  │  6. AWAIT rx.recv() (async, non-blocking)                   │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    │ ToolCallPending event                   │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       TAURI SHELL                                    │    │
│  │                                                                      │    │
│  │  Event bridge forwards to React frontend                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    │ Tauri IPC event                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       REACT FRONTEND                                │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │              TOOL APPROVAL CARD                              │    │    │
│  │  │                                                              │    │    │
│  │  │  ┌───────────────────────────────────────────────────────┐  │    │    │
│  │  │  │  Tool: read_file                                       │  │    │    │
│  │  │  │  Parameters: { path: "/workspace/src/main.rs" }       │  │    │    │
│  │  │  │                                                         │  │    │    │
│  │  │  │  [Edit Parameters] [Approve ✓] [Deny ✗]               │  │    │    │
│  │  │  └───────────────────────────────────────────────────────┘  │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                              │                                       │    │
│  │           ┌──────────────────┼──────────────────┐                   │    │
│  │           │                  │                  │                   │    │
│  │           ▼                  ▼                  ▼                   │    │
│  │    [Approve]           [Edit & Approve]    [Deny]                  │    │
│  │           │                  │                  │                   │    │
│  │           │                  │                  │                   │    │
│  │           └──────────────────┼──────────────────┘                   │    │
│  │                              │                                       │    │
│  │                              │ invoke('tool_call_resolve')          │    │
│  │                              ▼                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    │ IPC command                              │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      TAURI SHELL                                     │    │
│  │                                                                      │    │
│  │  command resolve_tool_call(approval_id, result):                    │    │
│  │      1. Lookup tx from DashMap using approval_id                    │    │
│  │      2. if found:                                                    │    │
│  │         a. tx.send(result)  // resolves oneshot                     │    │
│  │         b. remove from DashMap                                      │    │
│  │      3. else:                                                        │    │
│  │         return error("approval not found or cancelled")             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    │ oneshot resolved                        │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      TOOL DISPATCHER                                 │    │
│  │                                                                      │    │
│  │  rx.recv() returns:                                                  │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  case Approved(input):                                       │    │    │
│  │  │      execute_tool(tool, input)                              │    │    │
│  │  │      emit ToolResult                                        │    │    │
│  │  │                                                              │    │    │
│  │  │  case Denied(reason):                                        │    │    │
│  │  │      emit ToolDenied with reason                            │    │    │
│  │  │      model receives denial, may try alternative             │    │    │
│  │  │                                                              │    │    │
│  │  │  case Cancelled (channel closed):                            │    │    │
│  │  │      abort tool execution                                   │    │    │
│  │  │      agent loop may retry or report error                   │    │    │
│  │  │                                                              │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

CANCELLATION SCENARIOS:

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        CANCELLATION FLOW                                 │
  │                                                                          │
  │  Scenario 1: User navigates away from conversation                      │
  │    → React unmounts component                                           │
  │    → useEffect cleanup triggers cancel                                  │
  │    → Tauri command cancel_pending_approvals(conversation_id)            │
  │    → DashMap entries removed; channels closed                           │
  │    → Agent loop receives Cancelled, may suspend                         │
  │                                                                          │
  │  Scenario 2: New message sent (supersedes pending)                      │
  │    → Previous agent loop iteration cancelled                            │
  │    → All pending approvals for that iteration closed                    │
  │    → New iteration starts fresh                                         │
  │                                                                          │
  │  Scenario 3: App shutdown                                                │
  │    → Tauri shutdown hook clears all DashMap entries                     │
  │    → All pending channels closed                                        │
  │    → Clean shutdown without hung tasks                                  │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

| Decision               | Rationale                                                            |
| ---------------------- | -------------------------------------------------------------------- |
| **Oneshot channel**    | Clean async/await semantics; cancellation via channel close          |
| **DashMap storage**    | Thread-safe, concurrent access from multiple agent loops             |
| **UUID approval_id**   | Unique identifier for correlating UI approval with pending tool call |
| **Non-blocking await** | Agent loop can handle multiple tool calls concurrently               |

---

## 5. C4 Model Views

### 5.1 Level 1: System Context (C1)

```
                    ┌─────────────────────────────────┐
                    │         Software Developer      │
                    │         (Primary User)          │
                    └───────────────┬─────────────────┘
                                    │
                                    │ Uses
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        SKILLDECK SYSTEM                         │
│                                                                 │
│  Local-first AI orchestration desktop application providing:    │
│  • Branching conversations                                      │
│  • Filesystem-based skills                                      │
│  • MCP tool integration                                         │
│  • Multi-agent workflow orchestration                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
        │                 │                 │                 │
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    Claude     │ │    OpenAI     │ │    Ollama     │ │ MCP Servers   │
│      API      │ │      API      │ │   (Local)     │ │ (External     │
│               │ │               │ │               │ │  Tools)       │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

### 5.2 Level 2: Container View (C2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SKILLDECK SYSTEM                                  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    REACT FRONTEND (Container)                         │  │
│  │                                                                        │  │
│  │  Technology: React 19, TypeScript, Vite 7, Tailwind CSS               │  │
│  │  Portability: Could theoretically run in browser (WebContainer)       │  │
│  │                                                                        │  │
│  │  Responsibilities:                                                     │  │
│  │  • Render UI components (conversations, messages, workflows)          │  │
│  │  • Handle user input and navigation                                   │  │
│  │  • Manage client-side UI state (Zustand)                              │  │
│  │  • Cache server state (TanStack Query)                                │  │
│  │  • Stream delta rendering (rAF-based)                                 │  │
│  │                                                                        │  │
│  │  Constraints:                                                          │  │
│  │  • Communicates ONLY via Tauri IPC (no direct DB/filesystem access)   │  │
│  │  • All business logic in Rust core                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      │ Tauri IPC                            │
│                                      │ (invoke + events)                     │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    TAURI SHELL (Container)                             │  │
│  │                                                                        │  │
│  │  Technology: Tauri 2, Rust                                             │  │
│  │  Portability: Desktop-only (macOS, Windows, Linux)                    │  │
│  │                                                                        │  │
│  │  Responsibilities:                                                     │  │
│  │  • Register skilldeck-core into AppState                              │  │
│  │  • Expose IPC commands (thin wrappers around core)                    │  │
│  │  • Bridge events from core to frontend                                │  │
│  │  • Manage OS keychain integration                                     │  │
│  │  • Handle window lifecycle                                            │  │
│  │  • Manage approval gate queue (DashMap)                               │  │
│  │                                                                        │  │
│  │  Constraints:                                                          │  │
│  │  • Thin shell — no business logic                                     │  │
│  │  • All state owned by skilldeck-core                                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      │ Direct API calls                     │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 RUST CORE (skilldeck-core) (Container)                │  │
│  │                                                                        │  │
│  │  Technology: Rust, Tokio, SeaORM 2, Petgraph                           │  │
│  │  Portability: Could run in any Rust environment (CLI, server, etc.)   │  │
│  │                                                                        │  │
│  │  Responsibilities:                                                     │  │
│  │  • Own ALL business logic and state                                   │  │
│  │  • Agent loop orchestration                                           │  │
│  │  • Model provider abstraction (Claude, OpenAI, Ollama)                │  │
│  │  • MCP client implementation and supervision                          │  │
│  │  • Skill loading, resolution, and watching                            │  │
│  │  • Workflow execution (DAG-based)                                     │  │
│  │  • Workspace detection and context loading                            │  │
│  │  • Database operations (SQLite)                                       │  │
│  │  • Search indexing                                                    │  │
│  │                                                                        │  │
│  │  Constraints:                                                          │  │
│  │  • Zero Tauri dependencies (pure library crate)                       │  │
│  │  • Async-first design                                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                         │                    │                    │
                         ▼                    ▼                    ▼
              ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
              │ SQLite Database  │ │ OS Keychain      │ │ Filesystem       │
              │ (Data Store)     │ │ (Secrets)        │ │ (Skills, Exports)│
              └──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 5.3 Level 3: Component View (C3) — Rust Core

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RUST CORE (skilldeck-core)                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        AGENT LAYER                                   │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │    │
│  │  │   AgentLoop     │  │ ContextBuilder  │  │ ToolDispatcher  │    │    │
│  │  │                 │  │                 │  │                 │    │    │
│  │  │ • Ring buffer   │  │ • System prompt │  │ • Route to MCP  │    │    │
│  │  │ • 50ms batch    │  │ • TOON encode   │  │ • Approval gate │    │    │
│  │  │ • Cancellation  │  │ • Skill inject  │  │ • Built-in tools│    │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                          │    │
│  │  │ BuiltInTools    │  │ SubagentManager │                          │    │
│  │  │                 │  │                 │                          │    │
│  │  │ • loadSkill     │  │ • Fork session  │                          │    │
│  │  │ • spawnSubagent │  │ • Lifecycle     │                          │    │
│  │  │ • mergeResults  │  │ • Merge/Discard │                          │    │
│  │  └─────────────────┘  └─────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        SKILL LAYER                                   │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │    │
│  │  │FilesystemLoader │  │  SkillResolver  │  │  SkillWatcher   │    │    │
│  │  │                 │  │                 │  │                 │    │    │
│  │  │ • Parse SKILL.md│  │ • Priority order│  │ • notify +      │    │    │
│  │  │ • YAML parse    │  │ • Shadow detect │  │   200ms debounce│    │    │
│  │  │ • Hash compute  │  │ • Cache result  │  │ • Hot reload    │    │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐                                                │    │
│  │  │  SkillScanner   │                                                │    │
│  │  │                 │                                                │    │
│  │  │ • Dir traversal │                                                │    │
│  │  │ • Symlink skip  │                                                │    │
│  │  │ • DB upsert     │                                                │    │
│  │  └─────────────────┘                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        MCP LAYER                                     │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │    │
│  │  │  MCPClient      │  │  StdioTransport │  │  SSETransport   │    │    │
│  │  │                 │  │                 │  │                 │    │    │
│  │  │ • JSON-RPC 2.0  │  │ • Subprocess    │  │ • HTTP POST     │    │    │
│  │  │ • Tool caching  │  │ • stdin/stdout  │  │ • SSE read      │    │    │
│  │  │ • Session mgmt  │  │ • Timeout       │  │ • Timeout       │    │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                          │    │
│  │  │  MCPRegistry    │  │  MCPSupervisor  │                          │    │
│  │  │                 │  │                 │                          │    │
│  │  │ • DB-backed     │  │ • Health loop   │                          │    │
│  │  │ • Live state    │  │ • Exp backoff   │                          │    │
│  │  │ • Tool catalog  │  │ • Max retries   │                          │    │
│  │  └─────────────────┘  └─────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      WORKFLOW LAYER                                  │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │    │
│  │  │ WorkflowGraph   │  │ WorkflowExecutor│  │ SequentialRunner│    │    │
│  │  │                 │  │                 │  │                 │    │    │
│  │  │ • Petgraph DAG  │  │ • JoinSet      │  │ • Step-by-step  │    │    │
│  │  │ • Topo sort     │  │ • Fan-out/in   │  │ • Error prop    │    │    │
│  │  │ • Cycle detect  │  │ • Panic handle │  │ • State track   │    │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                          │    │
│  │  │ ParallelRunner  │  │ EvalOptRunner   │                          │    │
│  │  │                 │  │                 │                          │    │
│  │  │ • Concurrent    │  │ • Generator/    │                          │    │
│  │  │ • Aggregate     │  │   Evaluator     │                          │    │
│  │  │ • WaitAll       │  │ • Iteration cnt │                          │    │
│  │  └─────────────────┘  └─────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      PROVIDER LAYER                                  │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                ModelProvider Trait                           │    │    │
│  │  │                                                              │    │    │
│  │  │  • complete(CompletionRequest) -> CompletionStream          │    │    │
│  │  │  • id() -> &str                                              │    │    │
│  │  │  • display_name() -> &str                                    │    │    │
│  │  │  • toon_supported() -> bool                                  │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                    △                       △                        │    │
│  │                    │                       │                        │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │    │
│  │  │ ClaudeProvider  │  │ OpenAIProvider  │  │ OllamaProvider  │    │    │
│  │  │                 │  │                 │  │                 │    │    │
│  │  │ • Anthropic API │  │ • OpenAI API    │  │ • Local server  │    │    │
│  │  │ • SSE streaming │  │ • SSE streaming │  │ • OpenAI compat │    │    │
│  │  │ • Exp backoff   │  │ • Exp backoff   │  │ • No retry      │    │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      WORKSPACE LAYER                                 │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                          │    │
│  │  │WorkspaceDetector │  │ ContextLoader   │                          │    │
│  │  │                 │  │                 │                          │    │
│  │  │ • Project type  │  │ • CLAUDE.md     │                          │    │
│  │  │   detection     │  │ • README.md     │                          │    │
│  │  │ • Rust/Node/    │  │ • .gitignore    │                          │    │
│  │  │   Python/Generic│  │ • Context inject│                          │    │
│  │  └─────────────────┘  └─────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      DATA LAYER                                      │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │    │
│  │  │ Database        │  │ SeaORM Entities │  │ Migrations      │    │    │
│  │  │                 │  │                 │  │                 │    │    │
│  │  │ • SQLite pool   │  │ • 35 tables     │  │ • Schema mgmt   │    │    │
│  │  │ • WAL mode      │  │ • Relations     │  │ • Seed data     │    │    │
│  │  │ • Connection    │  │ • Indexes       │  │ • Version track │    │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                          │    │
│  │  │ TOONEncoder     │  │ SearchEngine    │                          │    │
│  │  │                 │  │                 │                          │    │
│  │  │ • JSON fallback │  │ • FTS (sqlite)  │                          │    │
│  │  │ • LLM-optimized │  │ • Embedding opt │                          │    │
│  │  └─────────────────┘  └─────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      PLUGIN TRAITS                                   │    │
│  │                                                                      │    │
│  │  ModelProvider   McpTransport   SkillLoader   Database   SyncBackend│    │
│  │  (DIP interfaces for testability and extensibility)                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Level 3: Component View (C3) — React Frontend

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REACT FRONTEND                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        STATE MANAGEMENT                              │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │    │
│  │  │    Zustand Store (ui)   │  │   TanStack Query Cache          │  │    │
│  │  │                         │  │                                 │  │    │
│  │  │ • activeConversationId  │  │ • conversations (list/get)      │  │    │
│  │  │ • panelSizes            │  │ • messages (per conversation)   │  │    │
│  │  │ • branchId              │  │ • profiles (CRUD)               │  │    │
│  │  │ • drafts (per convo)    │  │ • skills (list/toggle)          │  │    │
│  │  │ • streamingText         │  │ • mcpServers (list/connect)     │  │    │
│  │  │   (per conversation)    │  │ • workflows (status/execute)    │  │    │
│  │  │                         │  │ • analytics (usage stats)       │  │    │
│  │  └─────────────────────────┘  └─────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────┐                                        │    │
│  │  │   Zustand Store (unlock)│                                        │    │
│  │  │                         │                                        │    │
│  │  │ • progressiveUnlockStage│                                        │    │
│  │  │   (1–4)                 │                                        │    │
│  │  └─────────────────────────┘                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        HOOKS LAYER                                   │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │    │
│  │  │useConversations │  │  useMessages    │  │  useProfiles    │    │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │    │
│  │  │   useSkills     │  │  useMcpServers  │  │  useWorkflow    │    │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    useAgentStream                            │    │    │
│  │  │                                                              │    │    │
│  │  │  • Tauri event subscription (AgentEvent)                    │    │    │
│  │  │  • Delta append to Zustand streamingText (per conversation) │    │    │
│  │  │  • requestAnimationFrame-based rendering                    │    │    │
│  │  │  • Cleanup on unmount / conversation switch                 │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      COMPONENT LAYER                                 │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                      LAYOUT COMPONENTS                         │  │    │
│  │  │                                                                │  │    │
│  │  │  app-shell.tsx    left-panel.tsx    center-panel.tsx          │  │    │
│  │  │  (ResizablePanel) (conversations,    (message thread           │  │    │
│  │  │                    folders, tags)     + input)                 │  │    │
│  │  │                                                                │  │    │
│  │  │  right-panel.tsx  (Session / Workflow / Analytics tabs)        │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                   CONVERSATION COMPONENTS                      │  │    │
│  │  │                                                                │  │    │
│  │  │  conversation-list.tsx   message-thread.tsx                   │  │    │
│  │  │  conversation-item.tsx   message-bubble.tsx                   │  │    │
│  │  │  branch-nav.tsx          tool-call-card.tsx                   │  │    │
│  │  │  tool-approval-card.tsx  subagent-card.tsx                    │  │    │
│  │  │  artifact-card.tsx       message-input.tsx                    │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                   RIGHT PANEL COMPONENTS                       │  │    │
│  │  │                                                                │  │    │
│  │  │  session-tab.tsx        workflow-tab.tsx                      │  │    │
│  │  │  workflow-node.tsx      analytics-tab.tsx                     │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                    OVERLAY COMPONENTS                          │  │    │
│  │  │                                                                │  │    │
│  │  │  command-palette.tsx    marketplace-overlay.tsx               │  │    │
│  │  │  settings-overlay.tsx                                          │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                   ONBOARDING COMPONENTS                        │  │    │
│  │  │                                                                │  │    │
│  │  │  onboarding-wizard.tsx  playground-banner.tsx                 │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                     SHARED COMPONENTS                          │  │    │
│  │  │                                                                │  │    │
│  │  │  profile-badge.tsx      unlock-notification.tsx               │  │    │
│  │  │  token-counter.tsx                                            │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        API LAYER                                     │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                   lib/invoke.ts (typed API)                  │    │    │
│  │  │                                                              │    │    │
│  │  │  • conversations: list, get, create, rename, archive        │    │    │
│  │  │  • messages: list, send, stream, approveToolCall            │    │    │
│  │  │  • profiles: list, get, create, update, delete              │    │    │
│  │  │  • skills: list, toggle, install                             │    │    │
│  │  │  • mcp: list, connect, disconnect                            │    │    │
│  │  │  • workflows: start, stop, status                            │    │    │
│  │  │  • settings: getApiKey, setApiKey, validateKey               │    │    │
│  │  │  • export: markdown, json                                    │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                   lib/events.ts (typed events)               │    │    │
│  │  │                                                              │    │    │
│  │  │  • AgentEvent: Token, ToolCall, ToolResult, Done, Error     │    │    │
│  │  │  • WorkflowEvent: StepStarted, StepCompleted, WorkflowDone  │    │    │
│  │  │  • MCPServerEvent: Connected, Disconnected, ToolDiscovered  │    │    │
│  │  │  • SkillEvent: Loaded, Modified, Deleted, Shadowed          │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Key Data Flows

### 6.1 Message Streaming Flow

```
User Input                Agent Loop                 Model Provider           UI
    │                         │                           │                    │
    │  sendMessage()          │                           │                    │
    │────────────────────────▶│                           │                    │
    │                         │                           │                    │
    │                         │ build context             │                    │
    │                         │ (skills, history, TOON)   │                    │
    │                         │                           │                    │
    │                         │ complete(request)         │                    │
    │                         │──────────────────────────▶│                    │
    │                         │                           │                    │
    │                         │                           │ SSE stream         │
    │                         │◀─────────────────────────│                    │
    │                         │                           │                    │
    │                         │ ring buffer accumulate    │                    │
    │                         │ 50ms debounce             │                    │
    │                         │                           │                    │
    │                         │ AgentEvent::Token         │                    │
    │                         │─────────────────────────────────────────────▶│
    │                         │                           │                    │
    │                         │                           │                    │ rAF render
    │                         │                           │                    │ append to streamingText
    │                         │                           │                    │
    │                         │ AgentEvent::ToolCall      │                    │
    │                         │─────────────────────────────────────────────▶│
    │                         │                           │                    │
    │                         │                           │                    │ display approval card
    │◀─────────────────────────────────────────────────────────────────────│
    │                         │                           │                    │
    │ approve/deny            │                           │                    │
    │────────────────────────────────────────────────────────────────────▶│
    │                         │                           │                    │
    │                         │ (if approved)             │                    │
    │                         │──────────┐                │                    │
    │                         │          │                │                    │
    │                         │          │ execute tool   │                    │
    │                         │          │ (MCP or built-in)                  │
    │                         │          │                │                    │
    │                         │◀─────────┘                │                    │
    │                         │                           │                    │
    │                         │ AgentEvent::ToolResult    │                    │
    │                         │─────────────────────────────────────────────▶│
    │                         │                           │                    │
    │                         │ AgentEvent::Done          │                    │
    │                         │─────────────────────────────────────────────▶│
    │                         │                           │                    │
    │                         │                           │                    │ persist message
    │                         │                           │                    │ clear streamingText
    │                         │                           │                    │ update token counts
```

### 6.2 Tool Approval Gate Flow

```
Tool Call Request                    Approval Gate                      UI
       │                                 │                               │
       │ model requests tool             │                               │
       │────────────────────────────────▶│                               │
       │                                 │                               │
       │                                 │ generate approval_id          │
       │                                 │ store in DashMap              │
       │                                 │                               │
       │                                 │ emit ToolCallPending event    │
       │                                 │──────────────────────────────▶│
       │                                 │                               │
       │                                 │                               │ display approval card
       │                                 │                               │ user action: approve/edit/deny
       │                                 │                               │
       │                                 │◀──────────────────────────────│
       │                                 │ resolve(approval_id, result)  │
       │                                 │                               │
       │                                 │ remove from DashMap           │
       │                                 │                               │
       │                                 │ (if cancelled)                │
       │                                 │ cancel tx closed              │
       │                                 │ oneshot receiver gets error   │
       │                                 │                               │
       │◀────────────────────────────────│                               │
       │ return result or error          │                               │
```

### 6.3 MCP Server Connection and Supervision Flow

```
User Action              MCP Registry           MCPSupervisor          MCPTransport        MCP Server
     │                        │                      │                      │                   │
     │ connect(server_id)     │                      │                      │                   │
     │───────────────────────▶│                      │                      │                   │
     │                        │                      │                      │                   │
     │                        │ get server config    │                      │                   │
     │                        │ from DB              │                      │                   │
     │                        │                      │                      │                   │
     │                        │ spawn_connection()   │                      │                   │
     │                        │─────────────────────▶│                      │                   │
     │                        │                      │                      │                   │
     │                        │                      │ connect(config)      │                   │
     │                        │                      │─────────────────────▶│                   │
     │                        │                      │                      │                   │
     │                        │                      │                      │ spawn subprocess  │
     │                        │                      │                      │ or HTTP POST      │
     │                        │                      │                      │──────────────────▶│
     │                        │                      │                      │                   │
     │                        │                      │                      │ initialize()      │
     │                        │                      │                      │──────────────────▶│
     │                        │                      │                      │                   │
     │                        │                      │                      │◄──────────────────│
     │                        │                      │                      │ capabilities      │
     │                        │                      │                      │                   │
     │                        │                      │                      │ tools/list()      │
     │                        │                      │                      │──────────────────▶│
     │                        │                      │                      │                   │
     │                        │                      │                      │◄──────────────────│
     │                        │                      │                      │ tools[]           │
     │                        │                      │                      │                   │
     │                        │                      │ session created      │                   │
     │                        │                      │◀─────────────────────│                   │
     │                        │                      │                      │                   │
     │                        │ update status        │                      │                   │
     │                        │ to "connected"       │                      │                   │
     │                        │                      │                      │                   │
     │◀───────────────────────│ emit Connected event │                      │                   │
     │                        │                      │                      │                   │
     │                        │                      │ start_health_loop()  │                   │
     │                        │                      │──────────┐           │                   │
     │                        │                      │          │           │                   │
     │                        │                      │          │ periodic  │                   │
     │                        │                      │          │ health    │                   │
     │                        │                      │          │ check     │                   │
     │                        │                      │          │           │                   │
     │                        │                      │          │<──────────│                   │
     │                        │                      │          │           │                   │
     │                        │                      │          │ process   │                   │
     │                        │                      │          │ exits     │                   │
     │                        │                      │          │           │                   │
     │                        │                      │◀─────────┘           │                   │
     │                        │                      │ detect failure       │                   │
     │                        │                      │                      │                   │
     │                        │                      │ restart with backoff │                   │
     │                        │                      │─────────────────────▶│                   │
     │                        │                      │                      │                   │
     │                        │                      │                      │ spawn subprocess  │
     │                        │                      │                      │──────────────────▶│
     │                        │                      │                      │                   │
     │                        │                      │                      │                   │
     │                        │                      │ retry_count++        │                   │
     │                        │                      │ if retry_count > 5:  │                   │
     │                        │                      │   mark as "failed"   │                   │
     │                        │                      │   emit Failed event  │                   │
     │                        │                      │                      │                   │
     │◀───────────────────────│──────────────────────│──────────────────────│                   │
     │ notify user            │                      │                      │                   │
```

### 6.4 Model Provider Retry Flow (Exponential Backoff)

```
Agent Loop               Provider              HTTP Client            Model API
     │                       │                      │                      │
     │ complete(request)     │                      │                      │
     │──────────────────────▶│                      │                      │
     │                       │                      │                      │
     │                       │ POST /v1/messages    │                      │
     │                       │─────────────────────▶│                      │
     │                       │                      │                      │
     │                       │                      │─────────────────────▶│
     │                       │                      │                      │
     │                       │                      │◀─────────────────────│
     │                       │                      │  429 Too Many Requests
     │                       │                      │  Retry-After: 30     │
     │                       │                      │                      │
     │                       │                      │ classify error       │
     │                       │                      │ is_retryable = true  │
     │                       │◀─────────────────────│                      │
     │                       │ RetryableError       │                      │
     │                       │                      │                      │
     │                       │ backoff.wait(1s)     │                      │
     │                       │──────────────────────│                      │
     │                       │                      │                      │
     │                       │                      │                      │
     │                       │ POST /v1/messages    │                      │
     │                       │─────────────────────▶│                      │
     │                       │                      │                      │
     │                       │                      │─────────────────────▶│
     │                       │                      │                      │
     │                       │                      │◀─────────────────────│
     │                       │                      │  500 Internal Error  │
     │                       │                      │                      │
     │                       │◀─────────────────────│ RetryableError       │
     │                       │                      │                      │
     │                       │ backoff.wait(2s)     │                      │
     │                       │──────────────────────│                      │
     │                       │                      │                      │
     │                       │                      │                      │
     │                       │ POST /v1/messages    │                      │
     │                       │─────────────────────▶│                      │
     │                       │                      │                      │
     │                       │                      │─────────────────────▶│
     │                       │                      │                      │
     │                       │                      │◀─────────────────────│
     │                       │                      │  200 OK + SSE stream │
     │                       │                      │                      │
     │                       │◀─────────────────────│ SSE chunks           │
     │                       │                      │                      │
     │◀──────────────────────│ CompletionStream     │                      │
     │                       │                      │                      │
     │                       │                      │                      │

BACKOFF PARAMETERS:

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        EXPONENTIAL BACKOFF                               │
  │                                                                          │
  │  Initial delay:     1 second                                            │
  │  Multiplier:        2x                                                   │
  │  Maximum delay:     30 seconds                                          │
  │  Maximum retries:   3                                                    │
  │  Jitter:            ±10% random                                         │
  │                                                                          │
  │  Retry sequence:    1s → 2s → 4s → (max 3 retries)                     │
  │                                                                          │
  │  Retriable errors:                                                       │
  │  • 429 Too Many Requests (respect Retry-After header if present)       │
  │  • 500 Internal Server Error                                            │
  │  • 502 Bad Gateway                                                       │
  │  • 503 Service Unavailable                                              │
  │  • 504 Gateway Timeout                                                   │
  │  • Network timeout (30s)                                                │
  │  • Connection reset                                                      │
  │                                                                          │
  │  Non-retriable errors (fail immediately):                               │
  │  • 400 Bad Request                                                       │
  │  • 401 Unauthorized                                                      │
  │  • 403 Forbidden                                                         │
  │  • 404 Not Found                                                         │
  │  • 4xx (all other client errors)                                        │
  │                                                                          │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Branch Creation and Navigation Flow

```
User Action              Conversation Store        Message Store            UI
     │                         │                        │                    │
     │ create_branch(message_id)                        │                    │
     │────────────────────────▶│                        │                    │
     │                         │                        │                    │
     │                         │ get_message(message_id)│                    │
     │                         │───────────────────────▶│                    │
     │                         │                        │                    │
     │                         │◀───────────────────────│                    │
     │                         │ parent_message         │                    │
     │                         │                        │                    │
     │                         │ create_branch_record() │                    │
     │                         │ branch_id = UUID       │                    │
     │                         │ parent_id = message_id │                    │
     │                         │                        │                    │
     │                         │ insert into conversation_branches            │
     │                         │                        │                    │
     │                         │                        │                    │
     │                         │ get_children(message_id)                    │
     │                         │───────────────────────▶│                    │
     │                         │                        │                    │
     │                         │◀───────────────────────│                    │
     │                         │ children[] (all branches)                   │
     │                         │                        │                    │
     │◀────────────────────────│ emit BranchCreated     │                    │
     │                         │                        │                    │
     │                         │                        │                    │
     │                         │                        │                    │ display branch navigator
     │                         │                        │                    │ show "1 of N"
     │                         │                        │                    │
     │                         │                        │                    │
     │ navigate_branch(direction)                       │                    │
     │────────────────────────▶│                        │                    │
     │                         │                        │                    │
     │                         │ get_current_branch()   │                    │
     │                         │                        │                    │
     │                         │ get_sibling_branch(direction)               │
     │                         │───────────────────────▶│                    │
     │                         │                        │                    │
     │                         │◀───────────────────────│                    │
     │                         │ sibling_branch_id      │                    │
     │                         │                        │                    │
     │                         │ set_active_branch(sibling_branch_id)        │
     │                         │                        │                    │
     │                         │ get_messages_for_branch(sibling_branch_id)  │
     │                         │───────────────────────▶│                    │
     │                         │                        │                    │
     │                         │◀───────────────────────│                    │
     │                         │ branch_messages[]      │                    │
     │                         │                        │                    │
     │◀────────────────────────│ emit BranchNavigated   │                    │
     │                         │                        │                    │
     │                         │                        │                    │
     │                         │                        │                    │ update message thread
     │                         │                        │                    │ preserve scroll position
     │                         │                        │                    │ in shared prefix
     │                         │                        │                    │
     │                         │                        │                    │
     │ merge_branch(branch_id) │                        │                    │
     │────────────────────────▶│                        │                    │
     │                         │                        │                    │
     │                         │ get_branch_messages(branch_id)               │
     │                         │───────────────────────▶│                    │
     │                         │                        │                    │
     │                         │◀───────────────────────│                    │
     │                         │ branch_messages[]      │                    │
     │                         │                        │                    │
     │                         │ for each message in branch:                 │
     │                         │   update parent_id to main thread           │
     │                         │                        │                    │
     │                         │ mark_branch_merged(branch_id)               │
     │                         │                        │                    │
     │◀────────────────────────│ emit BranchMerged      │                    │
     │                         │                        │                    │
     │                         │                        │                    │
     │                         │                        │                    │ remove branch navigator
     │                         │                        │                    │ append branch messages
     │                         │                        │                    │ to main thread
```

### 6.6 Skill Resolution Flow

```
Workspace Open              Skill Scanner            Skill Resolver          Context Builder
      │                          │                         │                      │
      │ scan skill directories   │                         │                      │
      │─────────────────────────▶│                         │                      │
      │                          │                         │                      │
      │                          │ for each SKILL.md:      │                      │
      │                          │   parse frontmatter     │                      │
      │                          │   compute hash          │                      │
      │                          │   upsert to DB          │                      │
      │                          │                         │                      │
      │                          │ return Skill[]          │                      │
      │◀─────────────────────────│                         │                      │
      │                          │                         │                      │
      │ resolve_skills(sources)  │                         │                      │
      │───────────────────────────────────────────────────▶│                      │
      │                          │                         │                      │
      │                          │                         │ priority sort        │
      │                          │                         │ detect shadows       │
      │                          │                         │                      │
      │                          │                         │ return (resolved,    │
      │                          │                         │        shadowed)     │
      │◀───────────────────────────────────────────────────│                      │
      │                          │                         │                      │
      │ build_system_prompt()    │                         │                      │
      │───────────────────────────────────────────────────────────────────────────▶│
      │                          │                         │                      │
      │                          │                         │                      │ inject resolved skills
      │                          │                         │                      │ encode with TOON
      │                          │                         │                      │
      │◀───────────────────────────────────────────────────────────────────────────│
```

---

## 7. Data Model & Storage

### 7.1 Database Schema Overview

| Category         | Tables                                                                                                                                    | Purpose                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Core**         | `conversations`, `messages`, `tool_call_events`, `conversation_branches`                                                                  | Conversation data            |
| **Profile**      | `profiles`, `profile_mcps`, `profile_skills`, `conversation_mcp_overrides`, `conversation_skill_overrides`, `conversation_model_override` | Configuration                |
| **MCP**          | `mcp_servers`, `mcp_tool_cache`                                                                                                           | MCP server management        |
| **Skills**       | `skills`, `skill_source_dirs`                                                                                                             | Skill management             |
| **Workflow**     | `subagent_sessions`, `workflow_executions`, `workflow_steps`                                                                              | Workflow execution           |
| **Workspace**    | `workspaces`, `artifacts`, `templates`                                                                                                    | Workspace context            |
| **Organization** | `folders`, `tags`, `conversation_tags`, `attachments`                                                                                     | Conversation organization    |
| **Prompts**      | `prompts`, `prompt_variables`                                                                                                             | Saved prompts                |
| **Analytics**    | `usage_events`, `model_pricing`                                                                                                           | Usage tracking               |
| **State**        | `workspace_state`, `conversation_ui_state`, `bookmarks`, `export_jobs`                                                                    | UI state persistence         |
| **Search**       | `message_embeddings`                                                                                                                      | Embedding storage (optional) |
| **Sync**         | `sync_state`, `sync_watermarks`                                                                                                           | Future sync support          |

### 7.2 Key Entity Relationships

```
profiles
    │
    ├──▶ profile_mcps ──▶ mcp_servers
    │
    └──▶ profile_skills ──▶ skills

conversations
    │
    ├──▶ messages ──▶ tool_call_events
    │         │
    │         └──▶ conversation_branches
    │
    ├──▶ conversation_mcp_overrides
    │
    ├──▶ conversation_skill_overrides
    │
    ├──▶ conversation_model_override
    │
    ├──▶ conversation_tags ──▶ tags
    │
    ├──▶ artifacts
    │
    └──▶ subagent_sessions

workflow_executions
    │
    └──▶ workflow_steps

workspaces
    │
    └──▶ workspace_state

usage_events
    │
    └──▶ model_pricing
```

### 7.3 WAL Mode Configuration

From ASR-REL-001:

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA busy_timeout=5000;
PRAGMA foreign_keys=ON;
```

---

## 8. Security Architecture

### 8.1 Security Model Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY BOUNDARIES                                 │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    TRUST BOUNDARY: USER SPACE                         │  │
│  │                                                                        │  │
│  │  User can:                                                             │  │
│  │  • View and edit all conversation data                                │  │
│  │  • Configure profiles and settings                                    │  │
│  │  • Approve/deny tool calls                                            │  │
│  │  • Access exported files                                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      │ IPC                                   │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   TRUST BOUNDARY: APPLICATION                          │  │
│  │                                                                        │  │
│  │  Application enforces:                                                 │  │
│  │  • API keys in OS keychain (never in DB/files)                        │  │
│  │  • Tool approval gates for external access                            │  │
│  │  • Symlink skip in skill scanning                                     │  │
│  │  • File access restricted to workspace                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      │ Network                               │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   TRUST BOUNDARY: EXTERNAL                              │  │
│  │                                                                        │  │
│  │  External systems:                                                     │  │
│  │  • Model providers (Claude, OpenAI) — TLS 1.2+                        │  │
│  │  • MCP servers — local subprocess or HTTP                             │  │
│  │  • Ollama — local HTTP, no auth                                       │  │
│  │                                                                        │  │
│  │  User must approve:                                                    │  │
│  │  • File system access via MCP tools                                   │  │
│  │  • Network requests via MCP tools                                     │  │
│  │  • Database queries via MCP tools                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 STRIDE Threat Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STRIDE THREAT ANALYSIS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ S - SPOOFING                                                          │  │
│  │                                                                        │  │
│  │ Threats:                                                               │  │
│  │  • Attacker gains access to API keys                                  │  │
│  │  • Malicious MCP server impersonates legitimate server                │  │
│  │  • Attacker modifies skill files to inject malicious instructions     │  │
│  │                                                                        │  │
│  │ Mitigations:                                                           │  │
│  │  • API keys stored in OS keychain, never in plaintext                │  │
│  │  • MCP server connections require explicit user approval              │  │
│  │  • Skills scanned from filesystem only (no network sources in v1)     │  │
│  │  • Symlink detection prevents directory traversal                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ T - TAMPERING                                                         │  │
│  │                                                                        │  │
│  │ Threats:                                                               │  │
│  │  • Attacker modifies conversation history in database                │  │
│  │  • Skill files modified by attacker to change behavior               │  │
│  │  • MCP server tool results tampered in transit                       │  │
│  │                                                                        │  │
│  │ Mitigations:                                                           │  │
│  │  • SQLite database in user-owned directory, OS permissions           │  │
│  │  • Skill file content hash tracked for change detection              │  │
│  │  • MCP tool results validated against schemas                        │  │
│  │  • Conversation branch history preserved (append-only)               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ R - REPUDIATION                                                       │  │
│  │                                                                        │  │
│  │ Threats:                                                               │  │
│  │  • User denies performing sensitive action                            │  │
│  │  • No record of tool call approvals/denials                           │  │
│  │                                                                        │  │
│  │ Mitigations:                                                           │  │
│  │  • All tool call decisions logged with timestamp                     │  │
│  │  • Conversation history preserved with timestamps                    │  │
│  │  • Approval/denial actions recorded in tool_call_events table        │  │
│  │  • (Future: Audit log export for compliance)                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ I - INFORMATION DISCLOSURE                                            │  │
│  │                                                                        │  │
│  │ Threats:                                                               │  │
│  │  • API keys logged or stored in plaintext                            │  │
│  │  • Conversation data exposed to unauthorized users                   │  │
│  │  • Sensitive file contents read via MCP tools                        │  │
│  │  • Telemetry data leaks user information                             │  │
│  │                                                                        │  │
│  │ Mitigations:                                                           │  │
│  │  • API keys in OS keychain only (never in DB, logs, or config)       │  │
│  │  • Single-user application (no multi-tenancy)                        │  │
│  │  • Tool approval gates for file/network access                       │  │
│  │  • Telemetry opt-in only (disabled by default)                       │  │
│  │  • TLS 1.2+ for all external connections                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ D - DENIAL OF SERVICE                                                 │  │
│  │                                                                        │  │
│  │ Threats:                                                               │  │
│  │  • MCP server crashes cause application hang                         │  │
│  │  • Model API rate limits block all operations                        │  │
│  │  • Malformed skill files cause parser crash                          │  │
│  │  • Unbounded conversation history causes memory exhaustion           │  │
│  │                                                                        │  │
│  │ Mitigations:                                                           │  │
│  │  • MCP supervision with exponential backoff and max retries          │  │
│  │  • Model API retry with backoff and graceful degradation             │  │
│  │  • Skill parser robust to malformed files (skip with warning)        │  │
│  │  • Virtualized message rendering limits DOM size                    │  │
│  │  • Agent loop cancellation for long-running requests                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ E - ELEVATION OF PRIVILEGE                                            │  │
│  │                                                                        │  │
│  │ Threats:                                                               │  │
│  │  • Malicious skill executes arbitrary code                           │  │
│  │  • MCP server executes shell commands without approval               │  │
│  │  • Symlink traversal reads files outside workspace                   │  │
│  │                                                                        │  │
│  │ Mitigations:                                                           │  │
│  │  • Skills are instruction text only (no code execution)              │  │
│  │  • All tool calls require approval unless explicitly configured      │  │
│  │  • Shell command tool calls always require approval                  │  │
│  │  • Symlink detection in skill scanning                               │  │
│  │  • File access tools respect workspace boundaries                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Threat Mitigation Summary

| Threat Category                 | Primary Mitigation             | Secondary Mitigation               |
| ------------------------------- | ------------------------------ | ---------------------------------- |
| **API key theft**               | OS keychain storage            | Never logged/stored in DB          |
| **Unauthorized tool execution** | Approval gates                 | Category-based auto-approve config |
| **Skill injection**             | Filesystem-only sources        | Symlink detection; content hash    |
| **MCP server spoofing**         | Explicit connection approval   | User must initiate connection      |
| **Conversation tampering**      | SQLite permissions             | Branch history preservation        |
| **Data exfiltration**           | Tool approval for file/network | Workspace boundary enforcement     |
| **DoS via MCP failure**         | Supervision with backoff       | Graceful degradation               |
| **Malformed input**             | Robust parsers                 | Skip with warning, never crash     |

### 8.4 Credential Management

| Platform | Service            | Storage Location           |
| -------- | ------------------ | -------------------------- |
| macOS    | Keychain           | `~/Library/Keychains/`     |
| Windows  | Credential Manager | Windows Credential Store   |
| Linux    | libsecret          | `~/.local/share/keyrings/` |

### 8.5 Tool Approval Categories

| Category           | Default          | Risks                                   | Auto-Approve Config       |
| ------------------ | ---------------- | --------------------------------------- | ------------------------- |
| File reads         | Require approval | Data exfiltration                       | `autoApproveReads`        |
| File writes        | Require approval | Data modification, deletion             | `autoApproveWrites`       |
| Database SELECT    | Require approval | Data exfiltration                       | `autoApproveSelects`      |
| Database mutations | Require approval | Data modification, deletion             | `autoApproveMutations`    |
| HTTP requests      | Require approval | Data exfiltration, external interaction | `autoApproveHttpRequests` |
| Shell commands     | Require approval | Arbitrary code execution                | `autoApproveShell`        |
| Built-in tools     | Auto-approve     | Safe by design                          | Not configurable          |

---

## 9. Architecture Decision Records (ADRs)

### ADR-001: Three-Layer Architecture (Rust Core + Tauri Shell + React UI)

| Aspect                 | Details                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**            | SkillDeck needs a local-first desktop application with complex business logic (agent loop, workflow orchestration, MCP supervision) and a responsive UI.                                                    |
| **Decision Drivers**   | ASR-STR-001 (business logic in Rust), ASR-PERF-002 (60fps UI), ASR-REL-001 (crash recovery), REQ-CON-006 (IPC-only frontend)                                                                                |
| **Considered Options** | **A. Three-layer (Rust + Tauri + React)** — chosen; **B. Electron + Node.js backend** — slower startup, higher memory; **C. Pure Rust UI (egui/iced)** — less mature ecosystem, harder UI iteration         |
| **Decision**           | Adopt Option A: Three-layer architecture with `skilldeck-core` as pure Rust library, Tauri 2 as thin shell, React as pure view layer.                                                                       |
| **Consequences**       | (+) Clear separation of concerns; (+) Testable Rust core without Tauri dependency; (+) Best-in-class desktop performance; (–) IPC serialization overhead; (–) More complex state management across boundary |
| **Status**             | Accepted                                                                                                                                                                                                    |
| **Traceability**       | REQ-CON-006, REQ-CON-007, ASR-STR-001                                                                                                                                                                       |

### ADR-002: Tiered Streaming for IPC Boundary

| Aspect                 | Details                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Context**            | Model provider responses stream as SSE tokens. UI needs to render tokens in real-time. Direct emission per token would overwhelm IPC and UI.           |
| **Decision Drivers**   | ASR-PERF-001 (100ms render latency), ASR-PERF-002 (60fps UI), REQ-FUNC-012 (streaming display)                                                         |
| **Considered Options** | **A. Ring buffer + 50ms debounce** — chosen; **B. Per-token emission** — too many IPC calls; **C. Fixed-size batching (10 tokens)** — variable latency |
| **Decision**           | Adopt Option A: Ring buffer accumulates tokens; 50ms debounced emit to IPC; UI uses requestAnimationFrame for rendering.                               |
| **Consequences**       | (+) Controlled IPC traffic; (+) Predictable latency; (+) Smooth 60fps rendering; (–) Up to 50ms additional latency per chunk                           |
| **Status**             | Accepted                                                                                                                                               |
| **Traceability**       | ASR-PERF-001, REQ-PERF-002                                                                                                                             |

### ADR-003: SQLite with WAL Mode for Local Storage

| Aspect                 | Details                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Context**            | SkillDeck needs persistent local storage for conversations, profiles, and configuration. Must survive crashes without data loss.                                                                                                           |
| **Decision Drivers**   | ASR-REL-001 (crash recovery), REQ-CON-003 (SQLite), ASR-PERF-004 (search performance)                                                                                                                                                      |
| **Considered Options** | **A. SQLite with WAL mode** — chosen; **B. SQLite with default journal** — less concurrent; **C. Embedded key-value store (sled/RocksDB)** — no structured queries; **D. PostgreSQL (local)** — deployment complexity                      |
| **Decision**           | Adopt Option A: SQLite with WAL mode for all persistent storage.                                                                                                                                                                           |
| **Consequences**       | (+) Simple deployment (single file); (+) Crash recovery via WAL; (+) Concurrent reads; (+) FTS support for search; (–) SQLite limitations for very large datasets; (–) No built-in replication (future sync would need different approach) |
| **Status**             | Accepted                                                                                                                                                                                                                                   |
| **Traceability**       | ASR-REL-001, REQ-CON-003, REQ-REL-002                                                                                                                                                                                                      |

### ADR-004: Plugin Trait Abstractions for Providers and MCP

| Aspect                 | Details                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**            | SkillDeck must support multiple model providers (Claude, OpenAI, Ollama) and multiple MCP transport types (stdio, SSE) with consistent interfaces.                            |
| **Decision Drivers**   | ASR-STR-001 (testable core), JTBD-005 (provider flexibility), REQ-REL-003 (retry logic)                                                                                       |
| **Considered Options** | **A. Trait abstractions (ModelProvider, McpTransport)** — chosen; **B. Enum-based dispatch** — harder to test; **C. Conditional compilation** — complex, not runtime-flexible |
| **Decision**           | Adopt Option A: Define `ModelProvider` and `McpTransport` traits with multiple implementations.                                                                               |
| **Consequences**       | (+) Easy to mock for testing; (+) Extensible to new providers; (+) Isolated error handling per provider; (–) Slight abstraction overhead; (–) Trait object dynamic dispatch   |
| **Status**             | Accepted                                                                                                                                                                      |
| **Traceability**       | REQ-REL-003, ASR-STR-001                                                                                                                                                      |

### ADR-005: Approval Gate via Oneshot Channels

| Aspect                 | Details                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**            | Tool calls requiring user approval must block the agent loop until user responds. Cancellation must be supported.                                                         |
| **Decision Drivers**   | ASR-SEC-002 (tool approval), REQ-FUNC-076 (approval card), REQ-FUNC-079 (denial handling)                                                                                 |
| **Considered Options** | **A. Oneshot channels with cancellation** — chosen; **B. Polling with DashMap** — race conditions; **C. Mutex + condvar** — blocking UI thread risk                       |
| **Decision**           | Adopt Option A: Use `tokio::sync::oneshot` channels with sender stored in DashMap; cancellation closes sender, receiver gets error.                                       |
| **Consequences**       | (+) Non-blocking agent loop; (+) Clean cancellation semantics; (+) No race conditions; (–) Requires careful lifetime management; (–) DashMap memory for pending approvals |
| **Status**             | Accepted                                                                                                                                                                  |
| **Traceability**       | ASR-SEC-002, REQ-FUNC-076                                                                                                                                                 |

### ADR-006: Petgraph for Workflow DAG Execution

| Aspect                 | Details                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Context**            | Workflows are defined as directed acyclic graphs with dependencies. Must support parallel execution, topological ordering, and cycle detection.                    |
| **Decision Drivers**   | REQ-FUNC-085 (workflow definition), REQ-FUNC-086 (cycle detection), REQ-FUNC-091 (parallel execution)                                                              |
| **Considered Options** | **A. Petgraph for DAG** — chosen; **B. Custom graph implementation** — reinventing the wheel; **C. DAG execution library (daggy)** — similar to petgraph           |
| **Decision**           | Adopt Option A: Use `petgraph::DiGraph` for workflow representation and topological sort.                                                                          |
| **Consequences**       | (+) Mature, well-tested library; (+) Built-in topological sort; (+) Cycle detection algorithms; (–) Additional dependency; (–) Learning curve for graph algorithms |
| **Status**             | Accepted                                                                                                                                                           |
| **Traceability**       | REQ-FUNC-085, REQ-FUNC-086                                                                                                                                         |

### ADR-007: Skill Priority Resolution Order

| Aspect                 | Details                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**            | Skills can come from multiple sources (workspace, personal, superpowers, marketplace). Same-named skills need deterministic resolution.                                    |
| **Decision Drivers**   | BR-002 (skill priority), JTBD-003 (skill portability), REQ-FUNC-045 (resolution order)                                                                                     |
| **Considered Options** | **A. Fixed priority: workspace > personal > superpowers > marketplace** — chosen; **B. User-configurable priority** — deferred; **C. Last-loaded wins** — unpredictable    |
| **Decision**           | Adopt Option A: Fixed priority order with workspace skills taking highest precedence.                                                                                      |
| **Consequences**       | (+) Predictable resolution; (+) Workspace-specific overrides; (+) Easy to reason about; (–) Less flexibility than user-configurable; (–) Shadowed skills may confuse users |
| **Status**             | Accepted                                                                                                                                                                   |
| **Traceability**       | BR-002, REQ-FUNC-045                                                                                                                                                       |

### ADR-008: MCP Server Supervision with Exponential Backoff

| Aspect                 | Details                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**            | MCP servers are external processes that may crash or become unresponsive. Must be supervised with automatic restart.                                                |
| **Decision Drivers**   | ASR-REL-002 (MCP supervision), REQ-FUNC-070 (health monitoring), REQ-FUNC-071 (restart backoff)                                                                     |
| **Considered Options** | **A. Exponential backoff with max retries** — chosen; **B. Immediate restart** — thrashing risk; **C. No restart, user intervention required** — poor UX            |
| **Decision**           | Adopt Option A: Exponential backoff restart starting at 1s, max 60s, max 5 attempts.                                                                                |
| **Consequences**       | (+) Graceful handling of transient failures; (+) Prevents thrashing; (+) Clear failure state for user intervention; (–) Increased latency for intermittent failures |
| **Status**             | Accepted                                                                                                                                                            |
| **Traceability**       | ASR-REL-002, REQ-FUNC-071                                                                                                                                           |

### ADR-009: OS Keychain for API Key Storage

| Aspect                 | Details                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**            | API keys must be stored securely, never in database or configuration files.                                                                                                            |
| **Decision Drivers**   | ASR-SEC-001 (keychain storage), REQ-SEC-001 (no plaintext keys)                                                                                                                        |
| **Considered Options** | **A. OS keychain (Keychain/Credential Manager/libsecret)** — chosen; **B. Encrypted database field** — key management problem; **C. Environment variables** — not suitable for GUI app |
| **Decision**           | Adopt Option A: Use OS keychain via Tauri's keyring plugin.                                                                                                                            |
| **Consequences**       | (+) Platform-standard security; (+) Keys not in app data; (+) User can manage via OS tools; (–) Platform-specific behavior; (–) Requires keychain access permissions                   |
| **Status**             | Accepted                                                                                                                                                                               |
| **Traceability**       | ASR-SEC-001, REQ-SEC-001                                                                                                                                                               |

### ADR-010: React Virtualization for Message Threads

| Aspect                 | Details                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context**            | Conversations can have 500+ messages. Rendering all messages would cause performance issues.                                                                                 |
| **Decision Drivers**   | ASR-PERF-002 (60fps UI), REQ-PERF-003 (16ms response), REQ-PERF-005 (load conversations < 2s)                                                                                |
| **Considered Options** | **A. react-virtuoso for virtualized lists** — chosen; **B. react-window** — less feature-rich; **C. Pagination without virtualization** — worse UX                           |
| **Decision**           | Adopt Option A: Use react-virtuoso for message threads and conversation lists.                                                                                               |
| **Consequences**       | (+) Smooth scrolling for large conversations; (+) Reduced DOM size; (+) Built-in infinite scroll; (–) Additional library dependency; (–) Some complexity for dynamic heights |
| **Status**             | Accepted                                                                                                                                                                     |
| **Traceability**       | ASR-PERF-002, REQ-PERF-003                                                                                                                                                   |

---

## 10. API & Interface Contracts

### 10.1 IPC Command Contract (Summary)

| Command                | Input                         | Output           | Events Emitted              |
| ---------------------- | ----------------------------- | ---------------- | --------------------------- |
| `conversations_list`   | `profile_id?`                 | `Conversation[]` | —                           |
| `conversations_get`    | `id`                          | `Conversation`   | —                           |
| `conversations_create` | `profile_id`                  | `Conversation`   | —                           |
| `messages_send`        | `conversation_id, content`    | `Message`        | `AgentEvent::*`             |
| `tool_call_approve`    | `tool_call_id, edited_input?` | `ToolResult`     | `AgentEvent::ToolResult`    |
| `tool_call_deny`       | `tool_call_id, reason?`       | —                | `AgentEvent::ToolDenied`    |
| `profiles_list`        | —                             | `Profile[]`      | —                           |
| `skills_list`          | `source?`                     | `Skill[]`        | —                           |
| `mcp_connect`          | `server_id`                   | `MCPStatus`      | `MCPServerEvent::Connected` |
| `workflow_start`       | `workflow_def`                | `Execution`      | `WorkflowEvent::*`          |

### 10.2 Event Contracts

| Event Type                     | Payload                             | When Emitted             |
| ------------------------------ | ----------------------------------- | ------------------------ |
| `AgentEvent::Token`            | `{ conversation_id, delta }`        | Model streams token      |
| `AgentEvent::ToolCall`         | `{ tool_call_id, name, input }`     | Model requests tool      |
| `AgentEvent::ToolResult`       | `{ tool_call_id, result }`          | Tool execution completes |
| `AgentEvent::Done`             | `{ conversation_id, usage }`        | Model response complete  |
| `AgentEvent::Error`            | `{ conversation_id, error }`        | Error in agent loop      |
| `WorkflowEvent::StepStarted`   | `{ execution_id, step_id }`         | Workflow step begins     |
| `WorkflowEvent::StepCompleted` | `{ execution_id, step_id, result }` | Workflow step ends       |
| `MCPServerEvent::Connected`    | `{ server_id, tools }`              | MCP server connects      |
| `SkillEvent::Loaded`           | `{ skill_name, source }`            | Skill loaded from disk   |

### 10.3 Model Provider Contract

```rust
pub struct CompletionRequest {
    pub messages: Vec<ChatMessage>,
    pub system: Option<String>,
    pub tools: Vec<ToolSchema>,
    pub model_params: ModelParams,
}

pub enum CompletionChunk {
    Token(String),
    ToolCall { call_id: String, tool_name: String, input_json: Value },
    Done { input_tokens: u32, output_tokens: u32, cache_read_tokens: u32, cache_write_tokens: u32 },
}

pub trait ModelProvider: Send + Sync {
    fn id(&self) -> &str;
    fn display_name(&self) -> &str;
    fn toon_supported(&self) -> bool { true }
    async fn complete(&self, req: CompletionRequest) -> Result<CompletionStream, CoreError>;
}
```

---

## 11. Cross-Cutting Concerns

### 11.1 Observability

| Concern           | Implementation                                                             | Traceability |
| ----------------- | -------------------------------------------------------------------------- | ------------ |
| **Logging**       | `tracing` crate with structured logs; log levels: debug, info, warn, error | REQ-MAIN-001 |
| **Metrics**       | Usage events stored in `usage_events` table; token counts per message      | REQ-FUNC-013 |
| **Tracing**       | Request IDs propagated through agent loop; conversation-level correlation  | —            |
| **Health Checks** | MCP server health monitoring; model provider availability                  | REQ-FUNC-070 |

### 11.2 Error Handling

| Error Category                  | Handling Strategy                      | User Message                                                 |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| **Model API errors (4xx)**      | Fail immediately; no retry             | "The AI provider rejected your request: [reason]"            |
| **Model API errors (5xx, 429)** | Exponential backoff retry (max 3)      | "The AI provider is experiencing issues. Retrying..."        |
| **MCP server errors**           | Supervision restart; notify user       | "MCP server [name] encountered an error. Restarting..."      |
| **Database errors**             | Log; graceful degradation              | "A database error occurred. Please restart the application." |
| **Filesystem errors**           | Log; display specific error            | "Cannot access file: [path]. [OS error message]"             |
| **Tool execution errors**       | Return error to model; model may retry | Displayed in tool result card                                |

### 11.3 Internationalization

| Aspect                  | Implementation                                                      |
| ----------------------- | ------------------------------------------------------------------- |
| **Framework**           | Lingui (macro-based message extraction)                             |
| **Supported languages** | English (default); additional languages via community contributions |
| **String extraction**   | All UI strings wrapped in `<Trans>` or `t()` macro                  |
| **Message catalog**     | Generated during build; stored in `src/locales/`                    |
| **RTL support**         | Architecture supports; initial release LTR only                     |

### 11.4 Accessibility

| Concern                   | Implementation                                                                |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Keyboard navigation**   | All interactive elements focusable; Tab order logical; ⌘K for command palette |
| **Screen reader support** | ARIA labels on interactive elements; semantic HTML                            |
| **Color contrast**        | WCAG 2.1 AA compliance; high contrast mode support                            |
| **Focus indicators**      | Visible focus ring on all interactive elements                                |
| **Error announcements**   | Screen reader announcements for errors and toasts                             |

### 11.5 Deployment and Release Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT & RELEASE PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      DEVELOPMENT WORKFLOW                              │  │
│  │                                                                        │  │
│  │  1. Feature branch from main                                          │  │
│  │  2. Implement feature + tests                                         │  │
│  │  3. Pull Request with:                                                 │  │
│  │     • All CI checks passing                                           │  │
│  │     • Code review approval                                            │  │
│  │     • Documentation updated                                           │  │
│  │  4. Merge to main                                                     │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        CI/CD PIPELINE                                  │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    CONTINUOUS INTEGRATION                        │  │  │
│  │  │                                                                  │  │  │
│  │  │  • Rust: cargo test, cargo clippy, cargo fmt --check           │  │  │
│  │  │  • Frontend: pnpm test, pnpm lint, pnpm build                 │  │  │
│  │  │  • Security: cargo audit, npm audit                            │  │  │
│  │  │  • Coverage: cargo tarpaulin, Vitest coverage                  │  │  │
│  │  │                                                                  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                         │  │
│  │                              │ all checks pass                        │  │
│  │                              ▼                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                  CONTINUOUS DEPLOYMENT                           │  │  │
│  │  │                                                                  │  │  │
│  │  │  On main branch push:                                            │  │  │
│  │  │  • Build for all platforms (macOS x64/ARM, Windows, Linux)      │  │  │
│  │  │  • Run integration tests                                        │  │  │
│  │  │  • Generate API documentation                                   │  │  │
│  │  │  • Create release artifacts                                     │  │  │
│  │  │                                                                  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                         │  │
│  │                              │ tagged release                         │  │
│  │                              ▼                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                     RELEASE AUTOMATION                           │  │  │
│  │  │                                                                  │  │  │
│  │  │  1. Code signing (platform-specific):                           │  │  │
│  │  │     • macOS: codesign + notarization (Apple Developer cert)    │  │  │
│  │  │     • Windows: codesign (Authenticode certificate)             │  │  │
│  │  │     • Linux: GPG signature (optional)                           │  │  │
│  │  │                                                                  │  │  │
│  │  │  2. Package distribution:                                       │  │  │
│  │  │     • macOS: .dmg, .app                                         │  │  │
│  │  │     • Windows: .msi, .exe                                       │  │  │
│  │  │     • Linux: .AppImage, .deb, .rpm                              │  │  │
│  │  │                                                                  │  │  │
│  │  │  3. GitHub Release:                                             │  │  │
│  │  │     • Attach all platform binaries                              │  │  │
│  │  │     • Auto-generate release notes from PRs                      │  │  │
│  │  │     • Include checksums (SHA256)                                │  │  │
│  │  │                                                                  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      RELEASE CHANNELS                                  │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │     STABLE      │  │     BETA        │  │      NIGHTLY    │       │  │
│  │  │                 │  │                 │  │                 │       │  │
│  │  │ • v1.0.x tags   │  │ • v1.1-beta.x   │  │ • main builds   │       │  │
│  │  │ • Full QA       │  │ • Feature       │  │ • Latest fixes  │       │  │
│  │  │ • Production    │  │   preview       │  │ • Experimental  │       │  │
│  │  │   ready         │  │ • Limited QA    │  │ • No QA         │       │  │
│  │  │                 │  │                 │  │                 │       │  │
│  │  │ Default for     │  │ For early       │  │ For developers  │       │  │
│  │  │ most users      │  │ adopters        │  │ and testers     │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     UPDATE MECHANISM                                   │  │
│  │                                                                        │  │
│  │  Built-in auto-updater (Tauri):                                        │  │
│  │                                                                        │  │
│  │  1. On app startup:                                                    │  │
│  │     • Check GitHub releases for newer version                         │  │
│  │     • Compare semver with current version                             │  │
│  │                                                                        │  │
│  │  2. If update available:                                               │  │
│  │     • Download in background                                          │  │
│  │     • Verify signature/checksum                                       │  │
│  │     • Prompt user to install                                          │  │
│  │                                                                        │  │
│  │  3. Installation:                                                      │  │
│  │     • macOS: Replace .app bundle                                      │  │
│  │     • Windows: MSI upgrade                                            │  │
│  │     • Linux: User re-downloads or package manager                    │  │
│  │                                                                        │  │
│  │  Update frequency configurable:                                        │  │
│  │     • Stable channel: Notify on stable releases                       │  │
│  │     • Beta channel: Notify on beta + stable releases                  │  │
│  │     • Nightly: Notify on every build (opt-in only)                    │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   VERSIONING STRATEGY                                  │  │
│  │                                                                        │  │
│  │  Semantic Versioning (MAJOR.MINOR.PATCH):                             │  │
│  │                                                                        │  │
│  │  • MAJOR: Breaking changes (e.g., database schema migration required) │  │
│  │  • MINOR: New features, backward-compatible                           │  │
│  │  • PATCH: Bug fixes, backward-compatible                              │  │
│  │                                                                        │  │
│  │  Database migrations:                                                  │  │
│  │  • Forward-only migrations (no rollback)                              │  │
│  │  • Version embedded in schema version table                           │  │
│  │  • Migration runs on first startup of new version                     │  │
│  │  • Backup database before migration (automatic)                       │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

RELEASE ARTIFACTS:

  ┌───────────────────────────────────────────────────────────────────────────┐
  │                         ARTIFACT MATRIX                                    │
  │                                                                           │
  │  Platform        │ Artifact      │ Size     │ Signing                     │
  │  ────────────────────────────────────────────────────────────────────────  │
  │  macOS (Intel)   │ .dmg          │ ~25MB    │ Apple Developer cert        │
  │  macOS (ARM)     │ .dmg          │ ~25MB    │ Apple Developer cert        │
  │  Windows (x64)   │ .msi, .exe    │ ~20MB    │ Authenticode certificate    │
  │  Linux (x64)     │ .AppImage     │ ~30MB    │ GPG (optional)              │
  │  Linux (x64)     │ .deb          │ ~18MB    │ GPG (optional)              │
  │  Linux (x64)     │ .rpm          │ ~18MB    │ GPG (optional)              │
  │                                                                           │
  │  All artifacts include:                                                   │
  │  • SHA256 checksum file                                                   │
  │  • Release notes (auto-generated)                                         │
  │  • Embedded version info                                                  │
  │                                                                           │
  └───────────────────────────────────────────────────────────────────────────┘
```

### 11.6 Testing Strategy

| Test Type             | Scope                                              | Tooling                  |
| --------------------- | -------------------------------------------------- | ------------------------ |
| **Unit tests**        | Rust core modules (agent loop, resolver, executor) | `cargo test`             |
| **Integration tests** | Core + DB interactions; MCP client                 | `tests/` directory       |
| **Contract tests**    | IPC commands and events                            | Custom test harness      |
| **UI tests**          | Component rendering, user flows                    | Vitest + Testing Library |
| **E2E tests**         | Full application workflows                         | Tauri WebDriver          |
| **Performance tests** | Startup time, render latency, search               | Criterion benchmarks     |

---

## 12. Alternatives Considered

### 12.1 Alternative: Electron + Node.js Backend

| Aspect           | Electron                                              | SkillDeck (Tauri) |
| ---------------- | ----------------------------------------------------- | ----------------- |
| **Binary size**  | ~150MB                                                | ~20MB             |
| **Memory usage** | 500MB+ baseline                                       | 100MB baseline    |
| **Startup time** | 3-5 seconds                                           | < 2 seconds       |
| **Language**     | JavaScript/TypeScript                                 | Rust + TypeScript |
| **Ecosystem**    | Mature, large                                         | Growing           |
| **Decision**     | Rejected due to resource consumption and startup time |

### 12.2 Alternative: Embedded Key-Value Store (sled/RocksDB)

| Aspect                | Key-Value Store                                     | SQLite       |
| --------------------- | --------------------------------------------------- | ------------ |
| **Query flexibility** | Limited (key lookups)                               | Full SQL     |
| **Search**            | External indexing needed                            | Built-in FTS |
| **Relations**         | Manual                                              | Native       |
| **Tooling**           | Limited                                             | Mature       |
| **Decision**          | Rejected due to need for relational queries and FTS |

### 12.3 Alternative: Server-Based Architecture with Local Client

| Aspect                 | Server-Based                                                    | Local-First     |
| ---------------------- | --------------------------------------------------------------- | --------------- |
| **Offline capability** | Limited                                                         | Full            |
| **Data sovereignty**   | Cloud dependency                                                | User-controlled |
| **Deployment**         | Server + client                                                 | Single binary   |
| **Collaboration**      | Built-in                                                        | Deferred to v2  |
| **Decision**           | Rejected for v1; violates core value proposition of local-first |

### 12.4 Alternative: Pure Rust UI (egui/iced)

| Aspect                     | Rust UI                                                  | React + Tauri    |
| -------------------------- | -------------------------------------------------------- | ---------------- |
| **Development speed**      | Slower                                                   | Faster           |
| **UI component ecosystem** | Limited                                                  | Rich (shadcn/ui) |
| **Iteration time**         | Compile required                                         | Hot reload       |
| **Hiring**                 | Smaller pool                                             | Larger pool      |
| **Decision**               | Rejected due to ecosystem maturity and development speed |

---

## 13. Traceability

### 13.1 ASR → Design Decision Traceability

| ASR          | Design Decision                           | ADR              |
| ------------ | ----------------------------------------- | ---------------- |
| ASR-PERF-001 | Tiered streaming (ring buffer + debounce) | ADR-002          |
| ASR-PERF-002 | React virtualization + IPC batching       | ADR-010, ADR-002 |
| ASR-PERF-003 | Lazy loading in Tauri shell               | —                |
| ASR-PERF-004 | SQLite FTS indexing                       | ADR-003          |
| ASR-REL-001  | SQLite WAL mode                           | ADR-003          |
| ASR-REL-002  | MCP supervision with backoff              | ADR-008          |
| ASR-REL-003  | Provider trait abstraction + retry        | ADR-004          |
| ASR-SEC-001  | OS keychain storage                       | ADR-009          |
| ASR-SEC-002  | Oneshot channel approval gates            | ADR-005          |
| ASR-SEC-003  | Symlink skip in scanner                   | —                |
| ASR-STR-001  | Three-layer architecture + traits         | ADR-001, ADR-004 |
| ASR-STR-002  | IPC command pattern                       | ADR-001          |
| ASR-STR-003  | Petgraph DAG + subagent forking           | ADR-006          |

### 13.2 Goal Coverage

| Goal                     | ASR                        | ADR              | Status |
| ------------------------ | -------------------------- | ---------------- | ------ |
| DG-1 (Data integrity)    | ASR-REL-001                | ADR-003          | ✓      |
| DG-2 (UI responsiveness) | ASR-PERF-001, ASR-PERF-002 | ADR-002, ADR-010 | ✓      |
| DG-3 (Streaming)         | ASR-PERF-001               | ADR-002          | ✓      |
| DG-4 (Tool transparency) | ASR-SEC-002                | ADR-005          | ✓      |
| DG-5 (Extensibility)     | ASR-STR-001                | ADR-004          | ✓      |
| DG-6 (Multi-agent)       | ASR-STR-003                | ADR-006          | ✓      |

---

## Summary

### Document Statistics

| Category                                 | Count                         |
| ---------------------------------------- | ----------------------------- |
| Design Goals                             | 6                             |
| Design Non-Goals                         | 5                             |
| Architecturally Significant Requirements | 13                            |
| ADRs                                     | 10                            |
| C4 Views                                 | 4 (C1, C2, C3-Rust, C3-React) |
| Data Flow Diagrams                       | 6                             |
| Security Boundaries                      | 3                             |
| STRIDE Threat Categories                 | 6                             |
| Alternatives Considered                  | 4                             |

### Architecture Summary

SkillDeck v1 is architected as a **three-layer reactive system**:

1. **Rust Core (`skilldeck-core`)** — Pure library crate with zero Tauri dependencies, owning all business logic and state
2. **Tauri Shell** — Thin OS integration layer exposing core via IPC, managing keychain and approval gates
3. **React Frontend** — Pure view layer communicating only via IPC, using Zustand and TanStack Query for state

Key architectural patterns:

- **Tiered streaming** for responsive token rendering across IPC
- **Oneshot channel approval gates** for non-blocking tool approval
- **Petgraph DAG execution** for multi-agent workflows
- **Trait abstractions** for testable, extensible provider/MCP interfaces
- **SQLite WAL mode** for crash-resistant local storage
