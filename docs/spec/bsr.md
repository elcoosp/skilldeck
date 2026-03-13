# 📋 Business & Stakeholder Requirements Specification — SkillDeck v1

## 1. Business Context

### 1.1 Business Purpose

Build a **local-first AI orchestration platform** that gives software developers privacy-respecting AI assistance with branching conversations, composable filesystem-based skills, and multi-agent workflow orchestration.

### 1.2 Business Problem / Opportunity

Modern AI-assisted development tools suffer from three fundamental limitations:

1. **Cloud Dependency** — Most tools require internet connectivity and transmit code to cloud infrastructure, creating security, privacy, and reliability concerns.
2. **Single-Threaded Interaction** — Current AI assistants operate as a single conversational agent, requiring manual orchestration for complex multi-step tasks.
3. **Opaque Tool Integration** — Limited visibility into tool calls, skill composition, and workflow debugging.

### 1.3 Business Scope

**In Scope:**

- Desktop application for macOS, Windows, and Linux
- Branching conversation system with full history
- Filesystem-based skill system with priority resolution
- Multi-agent workflow orchestration (sequential, parallel, evaluator-optimizer)
- MCP server discovery, supervision, and tool integration
- Unified model provider interface (Claude, OpenAI, Ollama)
- Local SQLite database for all conversation and configuration data

**Out of Scope (v1):**

- Cloud sync and real-time collaboration
- Mobile or web versions
- Enterprise SSO/SAML/compliance features
- Built-in local LLM inference (Ollama integration provides this)
- Native IDE extensions

### 1.4 Competitive Positioning

| Competitor         | Strengths                                     | Weaknesses                                                       | SkillDeck Differentiation                                        |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Cursor**         | Deep IDE integration, fast iteration, popular | Cloud-dependent, single-threaded, proprietary extension system   | Local-first, branching, filesystem skills, multi-agent workflows |
| **Windsurf**       | AI-native IDE, good code context              | Cloud-dependent, limited workflow orchestration                  | Desktop control, MCP-first tooling, workflow patterns            |
| **Continue.dev**   | Open-source, IDE-embedded, customizable       | Single-threaded, limited orchestration, cloud-leaning            | Standalone desktop, branching, multi-agent workflows             |
| **Claude Desktop** | Native MCP support, clean UX                  | Single-threaded, no branching, no workflow orchestration         | Branching, workflows, skills, provider flexibility               |
| **Aider**          | CLI-native, git-aware, powerful               | CLI-only, steep learning curve, no GUI workflow visualization    | GUI with workflow DAG, approachable for mainstream devs          |
| **Jupyter AI**     | Notebook integration, research-friendly       | Notebook-centric, not dev-tooling focused, limited orchestration | Native desktop, developer-focused UX, MCP ecosystem              |

**Competitive Moat:** SkillDeck uniquely combines **local-first privacy**, **branching conversations**, **filesystem-based skills**, and **multi-agent orchestration** — no competitor offers all four in a cohesive package.

### 1.5 Business Environment

- **MCP ecosystem** maturing rapidly with dozens of high-quality servers
- **Local LLM capabilities** (Ollama) reaching production quality
- **Multi-agent research** producing practical orchestration patterns
- **Developer privacy concerns** increasing with regulatory scrutiny
- **Open-source AI tooling** gaining enterprise acceptance

---

## 2. Business Goals, Objectives & Success Metrics

### 2.1 Business Outcomes with Fit Criteria

| ID       | Business Outcome                                                                 | Key Results                                                                       | Fit Criterion                                                |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **BO-1** | Establish SkillDeck as leading open-source local-first AI orchestration platform | KR-1.1: 1,000+ GitHub stars within 6 months                                       | GitHub API query; verified by public count                   |
|          |                                                                                  | KR-1.2: 50+ community-contributed skills in shared repositories within 6 months   | Manual curation of community skill repos with ≥10 stars each |
|          |                                                                                  | KR-1.3: Featured in 3+ major developer newsletters/publications                   | Press monitoring; articles with >5K subscribers              |
| **BO-2** | Validate market demand for privacy-respecting AI development tools               | KR-2.1: 500+ active monthly users within 3 months of v1 release                   | Opt-in analytics; unique client IDs                          |
|          |                                                                                  | KR-2.2: 20+ users reporting daily active usage (10+ sessions/week)                | Opt-in analytics; session count aggregation                  |
|          |                                                                                  | KR-2.3: NPS score ≥ 40 from opt-in user surveys                                   | Survey with ≥50 responses; calculated NPS                    |
| **BO-3** | Create foundation for future commercial offerings                                | KR-3.1: Architecture supports cloud sync extension point (validated by prototype) | Technical review; working prototype demonstrates extension   |
|          |                                                                                  | KR-3.2: 5+ enterprise organizations express interest in team/enterprise features  | Lead tracking; documented inbound inquiries                  |
|          |                                                                                  | KR-3.3: Clear product roadmap for v2 based on user feedback                       | Published roadmap with ≥10 user-suggested items prioritized  |

### 2.2 Quality & Stability Goals

| ID       | Quality Goal                                | Key Results                                                | Fit Criterion                                            |
| -------- | ------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| **QG-1** | Zero critical data-loss bugs in first month | KR-1.1: No issues filed with "data loss" label             | GitHub issue triage; verified by manual review           |
|          |                                             | KR-1.2: SQLite WAL mode corruption rate = 0                | Database integrity checks in test suite; production logs |
| **QG-2** | High release quality                        | KR-2.1: Zero P0 bugs blocking release                      | Pre-release testing checklist; no blocker issues         |
|          |                                             | KR-2.2: All automated tests pass before merge              | CI pipeline; 100% test pass rate                         |
| **QG-3** | Responsive user experience                  | KR-3.1: Message render latency < 100ms                     | Performance testing; p99 measurement                     |
|          |                                             | KR-3.2: App startup time < 3 seconds on reference hardware | Performance testing; average of 10 runs                  |
| **QG-4** | Graceful degradation                        | KR-4.1: App remains responsive when offline                | Manual testing; no ANR (application not responding)      |
|          |                                             | KR-4.2: Partial failures don't corrupt data                | Chaos testing; database integrity verification           |

---

## 3. Business Model & Processes

### 3.1 Value Stream Definition

SkillDeck enables three interconnected value streams:

| Value Stream                               | Primary Stakeholder               | Value Delivered                                                         |
| ------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------- |
| **Developer Productivity Enhancement**     | Individual developers             | Reduces time from idea to working code through AI-assisted development  |
| **AI Orchestration Complexity Management** | Developers handling complex tasks | Makes multi-agent workflows accessible and manageable                   |
| **Skill & Knowledge Sharing**              | Teams and community               | Creates reusable AI behaviors that can be version-controlled and shared |

### 3.2 Core Business Processes

1. **User Acquisition** — GitHub release download → first-run onboarding → Playground activation → daily usage
2. **Model Provider Integration** — API key management → profile configuration → provider selection → streaming inference
3. **Skill Lifecycle** — Discovery (file scan) → Resolution (priority) → Activation → Usage → Evolution
4. **MCP Server Lifecycle** — Discovery (localhost scan) → Connection → Tool discovery → Supervision → Recovery
5. **Conversation Lifecycle** — Create → Message exchange → Branch → Navigate → Archive → Export
6. **Workflow Lifecycle** — Define → Execute → Monitor → Review → Iterate
7. **Multi-Workspace Management** — Open workspace → Detect context → Load workspace-specific skills → Switch workspace

### 3.3 Big Picture Event Storming

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SKILLDECK VALUE STREAM                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   [Domain Event]              [Command]                  [Aggregate]            │
│   ───────────────             ─────────                 ───────────             │
│                                                                                  │
│   User Installed App          Install                   → User                   │
│   ─────────────────────────────────────────────────────────────────────         │
│                                                                                  │
│   API Key Added               AddApiKey                → Profile                 │
│   Profile Created             CreateProfile            → Profile                 │
│   Profile Selected            SelectProfile            → User                    │
│   ─────────────────────────────────────────────────────────────────────         │
│                                                                                  │
│   Workspace Opened            OpenWorkspace            → Workspace               │
│   Project Type Detected       DetectProjectType        → Workspace               │
│   Context Files Loaded        LoadContextFiles         → Workspace               │
│   Workspace Closed            CloseWorkspace           → Workspace               │
│   ─────────────────────────────────────────────────────────────────────         │
│                                                                                  │
│   Skills Discovered           ScanSkillDirectories     → SkillRegistry           │
│   Skill Created               CreateSkill              → Skill                   │
│   Skill Modified              ModifySkill              → Skill                   │
│   Skill Deleted               DeleteSkill              → Skill                   │
│   Skill Shadowed              ResolveSkills            → SkillRegistry           │
│   ─────────────────────────────────────────────────────────────────────         │
│                                                                                  │
│   MCP Server Discovered       DiscoverMCPServers       → MCPRegistry             │
│   MCP Server Connected        ConnectMCPServer         → MCPServer               │
│   MCP Tools Available         ListMCPTools             → MCPServer               │
│   MCP Server Disconnected     DisconnectMCPServer      → MCPServer               │
│   MCP Server Restarted        RestartMCPServer         → MCPServer               │
│   ─────────────────────────────────────────────────────────────────────         │
│                                                                                  │
│   Conversation Started        StartConversation        → Conversation            │
│   Message Sent                SendMessage              → Conversation            │
│   Response Streamed           StreamResponse           → Conversation            │
│   Tool Call Requested         RequestToolCall          → ToolCall                │
│   Tool Call Approved          ApproveToolCall          → ToolCall                │
│   Tool Call Denied            DenyToolCall             → ToolCall                │
│   Tool Call Executed          ExecuteToolCall          → ToolCall                │
│   Branch Created              CreateBranch             → Conversation            │
│   Branch Navigated            NavigateBranch           → Conversation            │
│   Conversation Archived       ArchiveConversation      → Conversation            │
│   Conversation Exported       ExportConversation       → Conversation            │
│   ─────────────────────────────────────────────────────────────────────         │
│                                                                                  │
│   Workflow Defined            DefineWorkflow           → Workflow                │
│   Workflow Started            StartWorkflow            → Workflow                │
│   Subagent Spawned            SpawnSubagent            → Subagent                │
│   Subagent Completed          CompleteSubagent         → Subagent                │
│   Subagent Merged             MergeSubagent            → Subagent                │
│   Subagent Discarded          DiscardSubagent          → Subagent                │
│   Workflow Step Completed     CompleteStep             → WorkflowStep            │
│   Workflow Completed          CompleteWorkflow         → Workflow                │
│   Workflow Failed             FailWorkflow             → Workflow                │
│   ─────────────────────────────────────────────────────────────────────         │
│                                                                                  │
│   Artifacts Created           CreateArtifact           → Artifact                │
│   Artifact Downloaded         DownloadArtifact         → Artifact                │
│                                                                                  │
│   ─────────────────────────────────────────────────────────────────────         │
│                                                                                  │
│   [External System]           [Policy]                  [Read Model]            │
│   ──────────────────          ──────────               ────────────            │
│                                                                                  │
│   Claude API                  RateLimitPolicy          ConversationListView     │
│   OpenAI API                  RetryPolicy              MessageThreadView        │
│   Ollama API                  ApprovalGatePolicy       WorkflowStatusView       │
│   MCP Servers                 SupervisionPolicy        SkillListView            │
│   Filesystem                  WatchPolicy              MCPServerListView         │
│   OS Keychain                 EncryptionPolicy         UsageAnalyticsView       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

LEGEND:
  [Domain Event]    Orange sticky    — something that happened that domain experts care about
  [Command]         Blue sticky      — an intent to change state
  [Aggregate]       Yellow sticky    — consistency boundary for state changes
  [External System] Light blue       — systems outside our control
  [Policy]          Purple sticky    — reactions triggered by events
  [Read Model]      Green sticky     — data projections for queries
```

### 3.4 Hot Spots Identified

| Hot Spot                | Concern                                       | Resolution Strategy                              |
| ----------------------- | --------------------------------------------- | ------------------------------------------------ |
| Tool Call Approval Gate | Users may want auto-approve for trusted tools | Make BR-003 configurable per tool category       |
| MCP Server Failures     | External servers may crash silently           | Supervision with exponential backoff restart     |
| Skill Conflicts         | Same-named skills from different sources      | Shadow warning + resolution priority display     |
| Subagent Coordination   | Subagents may produce conflicting results     | Clear merge/discard options with diff view       |
| Token Budget            | Long conversations may exceed model limits    | Context window progress bar + summarization hint |

---

## 4. Business Rules & Policies

### 4.1 Business Rules Catalog

| ID         | Business Rule                                                                             | Source                | Category        | Configurable?                            |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------- | --------------- | ---------------------------------------- |
| **BR-001** | User API keys must be stored in OS keychain, never in database                            | Architecture decision | Security        | No                                       |
| **BR-002** | Skill resolution priority: workspace > personal > superpowers > marketplace               | Architecture decision | Skill system    | No                                       |
| **BR-003** | Tool calls requiring external access must present approval gate to user                   | Architecture decision | Transparency    | **Yes** — auto-approve per tool category |
| **BR-004** | Conversation branches are append-only; deletions only at conversation level               | Data integrity        | Branching       | No                                       |
| **BR-005** | MCP servers are supervised; unhealthy servers are auto-restarted with exponential backoff | Architecture decision | MCP             | Yes — backoff parameters                 |
| **BR-006** | Usage telemetry is opt-in only; disabled by default                                       | Privacy principle     | Data collection | Yes — granular controls                  |
| **BR-007** | Skills must be defined in SKILL.md format with YAML frontmatter                           | Architecture decision | Skill system    | No                                       |
| **BR-008** | Model provider responses are streamed with 50ms debounce to UI                            | Architecture decision | Performance     | Yes — debounce interval                  |
| **BR-009** | Workflow steps execute in topological order respecting dependencies                       | Architecture decision | Workflows       | No                                       |
| **BR-010** | Profile configuration includes model selection and enabled MCP/skills                     | Architecture decision | Configuration   | No                                       |

### 4.2 BR-003: Tool Approval Gate Configuration

**Default Behavior:** All tool calls requiring external access (file system, network, database queries) present an approval gate showing the tool name, parameters, and expected impact.

**Configuration Options:**

| Tool Category                             | Default          | Configurable Setting               |
| ----------------------------------------- | ---------------- | ---------------------------------- |
| File read operations                      | Require approval | `autoApproveReads: boolean`        |
| File write operations                     | Require approval | `autoApproveWrites: boolean`       |
| Database queries (SELECT)                 | Require approval | `autoApproveSelects: boolean`      |
| Database mutations (INSERT/UPDATE/DELETE) | Require approval | `autoApproveMutations: boolean`    |
| HTTP requests                             | Require approval | `autoApproveHttpRequests: boolean` |
| Shell commands                            | Require approval | `autoApproveShell: boolean`        |
| Built-in tools (loadSkill, spawnSubagent) | Auto-approve     | Not configurable (safe by design)  |

**User Experience:** Settings UI exposes a "Tool Approvals" section with toggles for each category. A "Safe Mode" preset enables all approvals; a "Trusted Environment" preset auto-approves reads and selects.

---

## 5. Stakeholders & User Classes

### 5.1 Stakeholder Map

| Stakeholder               | Role                | Primary Concerns                                   | Influence      | Communication               |
| ------------------------- | ------------------- | -------------------------------------------------- | -------------- | --------------------------- |
| **Project Lead**          | Creator & architect | Vision alignment, technical quality, user adoption | High           | Direct                      |
| **Core Contributors**     | Engineers           | Code quality, architecture, sustainable pace       | High           | GitHub PR/Issues            |
| **Community Users**       | Adopters            | Features, stability, documentation                 | Medium         | GitHub Discussions, Discord |
| **Model Providers**       | API vendors         | Usage volume, terms compliance                     | Low (external) | Status pages, changelogs    |
| **MCP Server Developers** | Ecosystem partners  | Integration quality, discoverability               | Medium         | MCP community channels      |

### 5.2 User Classes

| Class                     | Priority        | Description                                       | Characteristics                                                     |
| ------------------------- | --------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| **Individual Developers** | PRIMARY         | Software developers using AI assistance daily     | Technical, value privacy, want control, use multiple AI tools       |
| **Power Users**           | SECONDARY       | Automation enthusiasts creating complex workflows | Highly technical, want maximum configurability, create custom tools |
| **Enterprise Teams**      | DISFAVORED (v1) | Organizations requiring centralized management    | Need SSO, compliance, team features — deferred to v2                |

### 5.3 Primary Persona: Alex — The Privacy-Conscious Developer

#### Profile

| Attribute         | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| **Name**          | Alex Chen                                                             |
| **Role**          | Senior Software Engineer                                              |
| **Organization**  | Mid-sized tech company (50-200 employees)                             |
| **Experience**    | 8 years in software development                                       |
| **Tech Stack**    | TypeScript/Node.js, Python, PostgreSQL, AWS                           |
| **AI Tool Usage** | Daily user of Claude and ChatGPT for coding, debugging, documentation |

#### Goals

- Ship features faster with AI-assisted development
- Maintain control over sensitive codebase access
- Create reusable AI behaviors for project conventions
- Understand what AI tools are doing with their code

#### Frustrations

- "I can't use AI tools on my company's code because of data policies"
- "I keep repeating the same prompts for project-specific conventions"
- "I don't know what files the AI is reading when I ask it to understand my codebase"
- "When I'm exploring multiple solutions, I lose context or have to start over"
- "I want to use Claude for reasoning and GPT for speed, but managing two apps is annoying"

#### Behaviors

- Keeps AI assistant open in a side window alongside IDE
- Copies code snippets between IDE and AI chat frequently
- Creates prompt templates for repetitive tasks
- Reviews AI-generated code carefully before committing
- Experiments with different models for different tasks

#### Jobs to Be Done (Alex's)

| JTBD        | Statement                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy     | "When I'm working on proprietary code, I want AI assistance without uploading to external clouds, so my company's IP stays protected."         |
| Efficiency  | "When I'm implementing a new feature, I want to decompose it into parallel subtasks and let specialized agents handle each, so I ship faster." |
| Consistency | "When I've documented my team's coding conventions, I want to capture them as a skill that the AI always follows, so I don't repeat myself."   |
| Control     | "When the AI wants to run a database query, I want to see and approve it first, so I understand what's happening to my data."                  |
| Flexibility | "When I need deep reasoning, I want to use Claude; when I need speed, I want to use GPT; when I'm offline, I want Ollama — all in one app."    |

#### Day in the Life

1. **Morning** — Opens SkillDeck alongside VS Code, selects their "Work" profile with company MCP servers enabled
2. **Task Start** — Starts a new conversation, SkillDeck auto-loads project skills from `.skilldeck/skills/`
3. **Code Review** — Asks AI to review a PR diff; AI proposes explanations, Alex approves file-read tool calls
4. **Implementation** — Defines a 4-step workflow: analyze requirements → design → implement → test; runs parallel analysis
5. **Exploration** — Branches conversation to explore two different implementation approaches
6. **Wrap-up** — Merges preferred branch, exports conversation to Markdown for documentation

---

## 6. Glossary & Ubiquitous Language

### 6.1 Core Domain Terms

| Term                             | Definition                                                                                                             | Notes                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Agent**                        | An AI assistant instance processing a conversation, capable of calling tools and spawning subagents                    | DDD: Aggregate root    |
| **Agent Loop**                   | The core processing cycle: receive message → build context → call model → stream response → handle tool calls → repeat | Implementation concept |
| **Artifact**                     | A file or code snippet generated by the AI and presented to the user for download/copy                                 | UI element             |
| **Branch**                       | An alternative conversation path diverging from a parent message, allowing parallel exploration                        | Core feature           |
| **Conversation**                 | A sequence of messages between user and AI, potentially with multiple branches                                         | Core entity            |
| **Fit Criterion**                | A measurable test that determines if a requirement is satisfied                                                        | Requirements concept   |
| **MCP (Model Context Protocol)** | A protocol for exposing tools, resources, and prompts to AI models                                                     | External standard      |
| **MCP Server**                   | A process implementing MCP, exposing tools for the AI to use                                                           | External dependency    |
| **MCP Tool**                     | A specific capability exposed by an MCP server (e.g., database query, file operation)                                  | MCP concept            |
| **Message**                      | A single communication from user or assistant, including content and optional tool calls                               | Core entity            |
| **Model Provider**               | A service providing AI model inference (Claude, OpenAI, Ollama)                                                        | External dependency    |
| **Profile**                      | A configuration bundle specifying model, MCP servers, and skills for a work context                                    | Configuration entity   |
| **Skill**                        | A reusable instruction set defined in SKILL.md format, guiding AI behavior                                             | Core feature           |
| **Skill Source Directory**       | A filesystem location containing skills, with assigned priority                                                        | Configuration          |
| **Subagent**                     | A child agent spawned by a parent agent to handle a specialized task                                                   | Workflow concept       |
| **Tool Call**                    | An AI request to execute a tool (MCP or built-in), potentially requiring approval                                      | Core interaction       |
| **TOON Format**                  | "Tree of Object Notation" — a token-efficient encoding for structured data to LLMs                                     | Implementation detail  |
| **Workflow**                     | A multi-step orchestrated process coordinating one or more agents                                                      | Core feature           |
| **Workflow DAG**                 | A directed acyclic graph defining workflow step dependencies                                                           | Implementation concept |
| **Workspace**                    | A project context SkillDeck is opened in, with auto-detected type and context files                                    | Configuration          |

---

## 7. Bounded Contexts & Context Map

### 7.1 Context Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SKILLDECK CORE BOUNDED CONTEXT                       │
│                                                                              │
│  ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐     │
│  │  CONVERSATION     │   │     SKILL         │   │     PROFILE       │     │
│  │  Context          │   │     Context       │   │     Context       │     │
│  │                   │   │                   │   │                   │     │
│  │  Conversation     │   │  Skill            │   │  Profile          │     │
│  │  Message          │◄──│  SkillSource      │──►│  ProfileMCP       │     │
│  │  Branch           │   │  SkillResolver    │   │  ProfileSkill     │     │
│  │  ToolCall         │   │  SkillWatcher     │   │  ModelOverride    │     │
│  │  Artifact         │   │                   │   │                   │     │
│  └─────────┬─────────┘   └───────────────────┘   └─────────┬─────────┘     │
│            │                                               │               │
│            │    ┌─────────────────────────────────────────┼───────┐       │
│            │    │           SHARED KERNEL                 │       │       │
│            │    │  - UserId       - ProfileId             │       │       │
│            │    │  - ConversationId - SkillName           │       │       │
│            │    │  - MessageId    - MCPConfig             │       │       │
│            │    │  - Timestamp    - ModelParams           │       │       │
│            │    └─────────────────────────────────────────┘       │       │
│            │                                                     │       │
│            ▼                                                     ▼       │
│  ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐     │
│  │      MCP          │   │    WORKFLOW       │   │    PROVIDER       │     │
│  │   Context         │   │    Context        │   │    Context        │     │
│  │                   │   │                   │   │                   │     │
│  │  MCPServer        │   │  Workflow         │   │  Provider         │     │
│  │  MCPTool          │   │  WorkflowStep     │   │  ModelParams      │     │
│  │  MCPSession       │   │  Subagent         │   │  CompletionStream │     │
│  │  MCPTransport     │   │  WorkflowExecutor │   │                   │     │
│  └─────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘     │
│            │                       │                       │               │
└────────────┼───────────────────────┼───────────────────────┼───────────────┘
             │                       │                       │
             ▼                       ▼                       ▼
    ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
    │ EXTERNAL:      │      │ EXTERNAL:      │      │ EXTERNAL:      │
    │ MCP Servers    │      │ Model Providers│      │ Filesystem     │
    │ (Subprocesses) │      │ (Claude, etc.) │      │ (Skills, WS)   │
    └────────────────┘      └────────────────┘      └────────────────┘
```

### 7.2 Critical Context Relationships

| Upstream Context | Downstream Context | Relationship Pattern      | Integration Points                                                                        |
| ---------------- | ------------------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| **Skill**        | **Conversation**   | **Conformist**            | Conversation receives resolved skills as instructions; no bidirectional coupling          |
| **Profile**      | **Conversation**   | **Customer/Supplier**     | Profile provides configuration; conversation can override per-session                     |
| **MCP**          | **Conversation**   | **Anti-Corruption Layer** | MCP tools abstracted behind McpSession interface; conversation sees uniform tool API      |
| **Provider**     | **Conversation**   | **Anti-Corruption Layer** | Model responses normalized to CompletionStream; provider-specific error handling isolated |
| **Workflow**     | **Conversation**   | **Customer/Supplier**     | Workflow orchestrates conversations; subagents are specialized conversations              |
| **Conversation** | **Workflow**       | **Open Host Service**     | Subagent spawning API; workflow consumes conversation capabilities                        |
| **Profile**      | **MCP**            | **Conformist**            | Profile configures which MCP servers to connect; MCP context owns connection lifecycle    |
| **Profile**      | **Skill**          | **Conformist**            | Profile enables/disables skills; Skill context owns resolution and loading                |

### 7.3 Context Communication Patterns

```
Conversation Context
       │
       │ Uses resolved skills (read-only)
       ▼
   Skill Context


Conversation Context
       │
       │ Receives configuration; sends overrides
       ▼
   Profile Context


Conversation Context
       │
       │ Calls tools via McpSession interface
       ▼
   MCP Context ─────► External MCP Servers


Conversation Context
       │
       │ Sends CompletionRequest; receives CompletionStream
       ▼
   Provider Context ─────► External Model APIs


Workflow Context
       │
       │ Spawns Subagent (specialized Conversation)
       │ Merges/Discards results
       ▼
   Conversation Context
```

---

## 8. Conceptual Domain Model

### 8.1 Entity Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONVERSATION                                   │
│                                                                          │
│  id: UUID                                                                │
│  title: String                                                           │
│  profile: Profile                                                        │
│  messages: Message[] (tree structure, root is first)                    │
│  branches: Branch[]                                                      │
│  artifacts: Artifact[]                                                   │
│  workspace: Workspace?                                                   │
│  modelOverride: Model?                                                   │
│  mcpOverrides: MCP[]                                                     │
│  skillOverrides: Skill[]                                                 │
│  createdAt: Timestamp                                                    │
│  updatedAt: Timestamp                                                    │
│                                                                          │
│  Invariants:                                                             │
│  - messages form a valid tree (no cycles)                               │
│  - at least one message exists                                          │
│  - profile reference is immutable after first message                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ contains (tree)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            MESSAGE                                       │
│                                                                          │
│  id: UUID                                                                │
│  conversationId: UUID                                                    │
│  role: "user" | "assistant" | "system" | "tool_result"                  │
│  content: String (markdown)                                              │
│  parent: Message?                                                        │
│  children: Message[]                                                     │
│  toolCalls: ToolCall[]                                                   │
│  artifacts: Artifact[]                                                   │
│  tokenCounts: { input, output, cacheRead, cacheWrite }                  │
│  createdAt: Timestamp                                                    │
│                                                                          │
│  Invariants:                                                             │
│  - role is valid enum value                                             │
│  - tool_result messages must have a preceding tool_call                  │
│  - children maintain valid parent reference                             │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ may contain
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          TOOL CALL                                       │
│                                                                          │
│  id: UUID                                                                │
│  messageId: UUID                                                         │
│  callId: String (provider-specific)                                     │
│  toolName: String                                                        │
│  inputJson: JSON                                                         │
│  status: "pending" | "approved" | "denied" | "executed" | "failed"      │
│  resultJson: JSON?                                                       │
│  error: String?                                                          │
│  requiresApproval: Boolean                                               │
│  autoApproved: Boolean                                                   │
│                                                                          │
│  Invariants:                                                             │
│  - status transitions are valid (pending → approved/denied → executed)  │
│  - if denied, no resultJson                                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            PROFILE                                       │
│                                                                          │
│  id: UUID                                                                │
│  name: String                                                            │
│  model: Model                                                            │
│  modelParams: ModelParams                                                │
│  mcps: ProfileMCP[]                                                      │
│  skills: ProfileSkill[]                                                  │
│  isDefault: Boolean                                                      │
│  createdAt: Timestamp                                                    │
│  updatedAt: Timestamp                                                    │
│                                                                          │
│  Invariants:                                                             │
│  - exactly one profile has isDefault = true                             │
│  - model reference is valid                                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                             SKILL                                        │
│                                                                          │
│  name: String (unique within resolved scope)                            │
│  description: String                                                     │
│  contentMd: String (markdown instructions)                              │
│  source: "workspace" | "personal" | "superpowers" | "marketplace"       │
│  diskPath: Path?                                                         │
│  manifest: JSON (additional metadata)                                    │
│  hash: String (content hash for change detection)                       │
│                                                                          │
│  Invariants:                                                             │
│  - if source is filesystem-based, diskPath is set                       │
│  - contentMd is non-empty                                                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          MCP SERVER                                      │
│                                                                          │
│  id: UUID                                                                │
│  name: String                                                            │
│  transport: "stdio" | "sse"                                              │
│  config: JSON                                                            │
│  status: "disconnected" | "connecting" | "connected" | "error"          │
│  tools: MCPTool[]                                                        │
│  lastConnectedAt: Timestamp?                                             │
│  errorCount: Integer                                                     │
│                                                                          │
│  Invariants:                                                             │
│  - status transitions are valid                                          │
│  - errorCount tracks consecutive failures for supervision               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW                                       │
│                                                                          │
│  id: UUID                                                                │
│  name: String                                                            │
│  conversationId: UUID                                                    │
│  steps: WorkflowStep[]                                                   │
│  dependencies: Map<StepId, StepId[]>                                    │
│  pattern: "sequential" | "parallel" | "evaluator-optimizer"             │
│  status: "pending" | "running" | "completed" | "failed"                 │
│  currentStep: StepId?                                                    │
│  createdAt: Timestamp                                                    │
│  completedAt: Timestamp?                                                 │
│                                                                          │
│  Invariants:                                                             │
│  - dependencies form a DAG (no cycles)                                  │
│  - all steps are reachable from start                                   │
│  - status reflects step execution states                                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        SUBAGENT SESSION                                  │
│                                                                          │
│  id: UUID                                                                │
│  parentConversationId: UUID                                              │
│  parentMessageId: UUID                                                   │
│  workflowStepId: UUID?                                                   │
│  messages: Message[]                                                     │
│  status: "running" | "done" | "merged" | "discarded"                    │
│  resultSummary: String?                                                  │
│  createdAt: Timestamp                                                    │
│  completedAt: Timestamp?                                                 │
│                                                                          │
│  Invariants:                                                             │
│  - if status is "merged", resultSummary is set                          │
│  - messages are separate from parent conversation                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          WORKSPACE                                       │
│                                                                          │
│  id: UUID                                                                │
│  path: Path                                                              │
│  name: String                                                            │
│  projectType: "rust" | "node" | "python" | "generic"                    │
│  contextFiles: String[] (CLAUDE.md, README, etc.)                       │
│  skillDirectory: Path?                                                   │
│  isOpen: Boolean                                                         │
│  lastOpenedAt: Timestamp                                                 │
│                                                                          │
│  Invariants:                                                             │
│  - path is a valid directory                                            │
│  - projectType is auto-detected or specified                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Relationship Diagram

```
Profile ──────────┬───────────────► Conversation
  │               │                      │
  │ configures    │                      │ contains
  ▼               │                      ▼
MCP Server ◄──────┘                   Message
  │                                      │
  │ provides                              │ spawns
  ▼                                      ▼
MCP Tool                            Subagent Session
                                            │
                                            │ same structure as
                                            ▼
                                      Conversation

Skill ◄──────── Profile
  │                │
  │ resolves to    │ enables
  ▼                │
Conversation ◄─────┘
  │
  │ executes
  ▼
Workflow
  │
  │ contains
  ▼
WorkflowStep ──────► Subagent Session

Workspace ────────► Conversation
  │
  │ contains
  ▼
Skill (workspace-scoped)
```

---

## 9. Stakeholder Needs & User Requirements

### 9.1 Stakeholder Needs (Elaborated from Vision)

| ID      | Need                           | Stakeholder                          | Context                                                          |
| ------- | ------------------------------ | ------------------------------------ | ---------------------------------------------------------------- |
| **N-1** | Data sovereignty               | Privacy-conscious developers         | "I need AI assistance without uploading code to external clouds" |
| **N-2** | Workflow complexity management | Developers handling multi-step tasks | "I need to decompose complex tasks into coordinated subtasks"    |
| **N-3** | Skill portability & control    | Developers with custom processes     | "I need reusable, version-controllable AI instructions"          |
| **N-4** | Transparency & control         | Developers building trust with AI    | "I need visibility into and approval of AI actions"              |
| **N-5** | Provider flexibility           | Developers using multiple AI models  | "I need to switch between AI providers seamlessly"               |

### 9.2 Jobs to Be Done

**For Individual Developers (Primary User Class):**

| JTBD ID      | Statement                                                                                                                                                                                                 | Maps to Need | Priority |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- |
| **JTBD-001** | When I'm working on sensitive code, I want to use AI assistance without uploading my codebase to external servers, so that I maintain control over my intellectual property.                              | N-1          | Must     |
| **JTBD-002** | When I'm tackling a complex refactoring task, I want to decompose it into parallel subtasks and have specialized agents handle each part, so that I can complete the work faster and with better quality. | N-2          | Must     |
| **JTBD-003** | When I've established good AI prompting patterns for my project, I want to capture them as reusable skills, so that I don't have to repeat myself in future conversations.                                | N-3          | Must     |
| **JTBD-004** | When the AI wants to execute a tool (e.g., database query, file modification), I want to review and approve it before execution, so that I maintain control and understand what's happening.              | N-4          | Must     |
| **JTBD-005** | When I need different AI capabilities (reasoning, speed, local execution), I want to switch between providers seamlessly, so that I can use the right tool for each task.                                 | N-5          | Must     |
| **JTBD-006** | When I'm exploring multiple solution approaches, I want to branch my conversation and pursue alternatives in parallel, so that I can compare outcomes before committing.                                  | N-2          | Should   |
| **JTBD-007** | When I've created useful skills for one project, I want to share them with my team or the community, so that others can benefit from my learnings.                                                        | N-3          | Should   |

**For Power Users (Secondary User Class):**

| JTBD ID      | Statement                                                                                                                                           | Maps to Need | Priority |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- |
| **JTBD-008** | When I'm building a multi-step automation, I want to define workflows with dependencies, so that complex processes execute reliably and repeatably. | N-2          | Should   |
| **JTBD-009** | When I need to connect custom tools, I want to configure MCP servers manually, so that I can extend AI capabilities for my specific environment.    | N-2          | Should   |
| **JTBD-010** | When I'm debugging an AI workflow, I want to see the full execution trace, so that I can identify where things went wrong.                          | N-4          | Should   |

### 9.3 User Requirements by User Class

| User Class               | High-Level Tasks       | Candidate Use Cases                                  |
| ------------------------ | ---------------------- | ---------------------------------------------------- |
| **Individual Developer** | Configure AI providers | UC-001: Set up API keys and create first profile     |
|                          | Have AI conversations  | UC-002: Start conversation and exchange messages     |
|                          | Explore alternatives   | UC-003: Create and navigate conversation branches    |
|                          | Create skills          | UC-004: Write and activate a filesystem skill        |
|                          | Control tool execution | UC-005: Review and approve/deny tool calls           |
|                          | Orchestrate workflows  | UC-006: Define and execute a multi-step workflow     |
|                          | Switch work contexts   | UC-007: Open and switch between workspaces           |
| **Power User**           | Configure MCP servers  | UC-008: Add and connect a custom MCP server          |
|                          | Debug workflows        | UC-009: Inspect workflow execution trace             |
|                          | Optimize configuration | UC-010: Adjust model parameters and skill priorities |

---

## 10. System-in-Context Processes & Operational Concept

### 10.1 Context Diagram

```
                        ┌─────────────────────┐
                        │        User         │
                        │   (Developer)       │
                        └──────────┬──────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
                 ▼                 ▼                 ▼
          ┌──────────┐      ┌──────────┐      ┌──────────┐
          │  Chat    │      │ Configure│      │ Workflows│
          │  Actions │      │  Actions │      │  Actions │
          └────┬─────┘      └────┬─────┘      └────┬─────┘
               │                 │                 │
               └─────────────────┼─────────────────┘
                                 │
                                 ▼
        ┌────────────────────────────────────────────────────┐
        │                                                      │
        │                  SKILLDECK SYSTEM                    │
        │                                                      │
        │  ┌──────────────────────────────────────────────┐  │
        │  │              Conversation Layer               │  │
        │  │    Conversation Manager                       │  │
        │  │    Message Store (SQLite)                     │  │
        │  │    Branch Navigator                           │  │
        │  │    Tool Call Processor                        │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │                Skill Layer                   │  │
        │  │    Skill Loader (Filesystem)                 │  │
        │  │    Skill Resolver (Priority)                 │  │
        │  │    Skill Watcher (Hot Reload)                │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │                 MCP Layer                    │  │
        │  │    MCP Discovery (Localhost Scanner)         │  │
        │  │    MCP Client (JSON-RPC)                     │  │
        │  │    MCP Supervisor (Health Monitor)           │  │
        │  │    Tool Registry                             │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │              Workflow Layer                  │  │
        │  │    Workflow Executor                         │  │
        │  │    Subagent Manager                          │  │
        │  │    DAG Processor                             │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │              Provider Layer                  │  │
        │  │    Provider Registry                         │  │
        │  │    Claude Adapter                            │  │
        │  │    OpenAI Adapter                            │  │
        │  │    Ollama Adapter                            │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │              Workspace Layer                 │  │
        │  │    Workspace Detector                        │  │
        │  │    Context Loader                            │  │
        │  │    Multi-Workspace Manager                   │  │
        │  └──────────────────────────────────────────────┘  │
        │                                                      │
        └──────────────────────┬─────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│    Model      │     │     MCP       │     │  Filesystem   │
│   Providers   │     │    Servers    │     │               │
│               │     │               │     │               │
│  • Claude API │     │  • Database   │     │  • Skills     │
│  • OpenAI API │     │    connectors │     │  • Workspace  │
│  • Ollama     │     │  • API        │     │    context    │
│    (local)    │     │    wrappers   │     │  • Exports    │
│               │     │  • File tools │     │               │
└───────────────┘     └───────────────┘     └───────────────┘
```

### 10.2 Operational Concept

**From the user's perspective, SkillDeck operates in five phases:**

#### Phase 1: Setup

| Step | User Action                    | System Behavior                                                |
| ---- | ------------------------------ | -------------------------------------------------------------- |
| 1.1  | Download and install SkillDeck | Application installs to desktop                                |
| 1.2  | Launch application             | First-run detection triggers onboarding wizard                 |
| 1.3  | Enter API key(s)               | Keys stored in OS keychain; never persisted to database        |
| 1.4  | Create/select profile          | Default profile created; user can customize model and settings |
| 1.5  | (Optional) Open a workspace    | System detects project type, loads context files               |
| 1.6  | Complete onboarding            | Playground opens with sample conversation                      |

#### Phase 2: Daily Usage

| Step | User Action                   | System Behavior                                                       |
| ---- | ----------------------------- | --------------------------------------------------------------------- |
| 2.1  | Open SkillDeck                | Restores previous session state; reconnects MCP servers               |
| 2.2  | Select or create conversation | Loads conversation from database; prepares message thread             |
| 2.3  | Send message                  | Agent loop processes: builds context → calls model → streams response |
| 2.4  | Receive response              | Tokens stream in real-time; tool calls appear as cards                |
| 2.5  | Interact with tool calls      | Review parameters → Edit (optional) → Approve or Deny                 |
| 2.6  | Continue conversation         | Context grows; system manages token window                            |

#### Phase 3: Branching & Exploration

| Step | User Action               | System Behavior                                                         |
| ---- | ------------------------- | ----------------------------------------------------------------------- |
| 3.1  | Identify divergence point | Message shows branch indicator if alternatives exist                    |
| 3.2  | Create branch             | Creates new message tree starting from selected parent                  |
| 3.3  | Navigate branches         | Branch navigator shows position (e.g., "1 of 3"); arrows for navigation |
| 3.4  | Compare alternatives      | Switch between branches to compare approaches                           |
| 3.5  | Merge or discard          | Merge: append branch content to main thread; Discard: delete branch     |

#### Phase 4: Configuration

| Step | User Action              | System Behavior                                         |
| ---- | ------------------------ | ------------------------------------------------------- |
| 4.1  | Open settings            | Settings overlay appears with tabs                      |
| 4.2  | Manage profiles          | Create, edit, duplicate, delete profiles                |
| 4.3  | Configure MCP servers    | Add server (discovered or manual) → Configure → Connect |
| 4.4  | Manage skills            | View resolved skills → Enable/disable → Reorder sources |
| 4.5  | Adjust model parameters  | Temperature, max tokens, provider selection             |
| 4.6  | Configure tool approvals | Toggle auto-approve categories                          |

#### Phase 5: Multi-Workspace Management

| Step | User Action                           | System Behavior                                                       |
| ---- | ------------------------------------- | --------------------------------------------------------------------- |
| 5.1  | Open workspace                        | File picker → Select project directory                                |
| 5.2  | Auto-detect context                   | System scans for: project type, CLAUDE.md, README, .skilldeck/skills/ |
| 5.3  | Load workspace-specific configuration | Workspace skills override global; context injected into conversations |
| 5.4  | Switch workspace                      | Active workspace changes; conversations tagged with workspace         |
| 5.5  | Close workspace                       | Workspace context unloaded; global settings restored                  |

#### Phase 6: Export & Archive

| Step | User Action          | System Behavior                                                     |
| ---- | -------------------- | ------------------------------------------------------------------- |
| 6.1  | Select conversations | Multi-select in sidebar                                             |
| 6.2  | Export               | Generate Markdown (conversation format) or JSON (full data)         |
| 6.3  | Download             | Save to filesystem                                                  |
| 6.4  | Archive              | Move old conversations to archive state; exclude from active search |

### 10.3 Operational Scenarios

#### Scenario 1: First-Time User Onboarding (Happy Path)

> Alex downloads SkillDeck from GitHub releases. On first launch, a three-step wizard appears:
>
> 1. **API Key**: Alex enters their Anthropic API key. System validates by making a minimal API call.
> 2. **Profile**: A default "Claude Sonnet" profile is created. Alex keeps defaults.
> 3. **Playground**: A sample conversation starts with a guided tour of the interface.
>
> Within 5 minutes, Alex has sent their first message and received a streaming response.

#### Scenario 2: Branching for Alternative Implementations

> Alex is working on a caching strategy for their API. They've discussed one approach (Redis-based) and want to explore an alternative (in-memory with TTL).
>
> 1. Alex clicks the branch icon on the message where the decision point occurs.
> 2. A new branch is created, starting from that message.
> 3. Alex explores the in-memory approach with the AI.
> 4. After comparing both branches, Alex navigates back to the Redis branch and merges it into the main thread.
> 5. The in-memory branch is discarded.

#### Scenario 3: Multi-Agent Workflow for Code Review

> Alex wants to review a PR with multiple checks: code quality, security, and performance.
>
> 1. Alex defines a workflow with three parallel steps:
>    - Agent A: Review code quality (naming, structure, patterns)
>    - Agent B: Check for security vulnerabilities
>    - Agent C: Analyze performance implications
> 2. Workflow DAG shows three parallel nodes.
> 3. Alex starts the workflow. Three subagent sessions spawn.
> 4. Results stream in as each agent completes.
> 5. Alex reviews each result card and decides whether to merge insights into the main conversation.

#### Scenario 4: Skill Creation for Project Conventions

> Alex's team has specific naming conventions and architectural patterns. They want the AI to always follow these.
>
> 1. Alex creates `.skilldeck/skills/team-conventions/SKILL.md` in their project repo.
> 2. SKILL.md contains YAML frontmatter (name, description, triggers) and markdown instructions.
> 3. SkillDeck's file watcher detects the new skill and loads it.
> 4. The skill appears in the Session panel under "Active Skills".
> 5. In future conversations, the AI follows the conventions without Alex having to repeat them.

#### Scenario 5: Multi-Workspace Switching

> Alex works on two projects: a TypeScript frontend and a Python backend. Each has different skills and context.
>
> 1. Alex opens the frontend workspace. SkillDeck detects TypeScript project, loads frontend-specific skills.
> 2. Alex has a conversation about React components. The conversation is tagged with the frontend workspace.
> 3. Alex opens the backend workspace. Skills reload to Python/backend patterns.
> 4. Alex has a conversation about API design. Tagged with backend workspace.
> 5. Alex switches back to frontend. Previous frontend conversation is restored in the sidebar.

---

## 11. Stakeholder-Level Constraints & Quality Expectations

### 11.1 Constraints

| ID         | Constraint                                                                 | Source               | Impact                                                                          |
| ---------- | -------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| **SC-001** | Must run offline (except when calling cloud AI APIs)                       | User need N-1        | No network dependency for core functionality; graceful degradation when offline |
| **SC-002** | Must support macOS, Windows, and Linux                                     | Technical constraint | Tauri-based desktop app; platform-specific testing required                     |
| **SC-003** | Must not store API keys in plaintext                                       | Security requirement | OS keychain integration (Keychain/Windows Credential Manager/libsecret)         |
| **SC-004** | Must support concurrent conversations                                      | User workflow        | Multi-conversation architecture; isolated conversation state                    |
| **SC-005** | Must handle large conversation histories (1000+ messages per conversation) | Performance          | Pagination, virtualization, and indexing required                               |
| **SC-006** | Must support multiple simultaneous workspaces                              | User workflow        | Multi-workspace manager; isolated skill/config context                          |

### 11.2 Quality Expectations (Stakeholder Language)

| ID         | Expectation                                      | Stakeholder           | Quantification (TBD in SRS)                                                     |
| ---------- | ------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------- |
| **QE-001** | "The app should feel snappy and responsive"      | Individual developers | Message render latency < 100ms; app startup < 3s                                |
| **QE-002** | "I shouldn't lose my work if the app crashes"    | All users             | SQLite WAL mode; crash recovery within 1 restart                                |
| **QE-003** | "It should be easy to find old conversations"    | Individual developers | Full-text search across all conversations; results < 500ms                      |
| **QE-004** | "I should be able to pick up where I left off"   | All users             | Session state persisted; conversation restoration < 1s                          |
| **QE-005** | "Errors should be understandable and actionable" | All users             | Error messages include context + suggested action; no raw stack traces to users |

### 11.3 Quality Expectations Requiring SRS Elaboration

The following stakeholder expectations will be refined into measurable NFRs in the SRS:

| Stakeholder Statement            | Needs Quantification                  | Proposed SRS Mapping                                |
| -------------------------------- | ------------------------------------- | --------------------------------------------------- |
| "Snappy and responsive"          | Latency targets, startup time         | Performance NFRs (ISO 25010 Performance Efficiency) |
| "Shouldn't lose work"            | Crash recovery, data integrity        | Reliability NFRs (ISO 25010 Reliability)            |
| "Easy to find old conversations" | Search performance, indexing          | Usability NFRs (ISO 25010 Interaction Capability)   |
| "Pick up where left off"         | Session persistence, restoration time | Portability NFRs (ISO 25010 Flexibility)            |
| "Understandable errors"          | Error message format, actionability   | Usability NFRs (ISO 25010 Interaction Capability)   |

---

## 12. Risks, Assumptions & Open Issues

### 12.1 Risks

| ID      | Risk                                                      | Probability | Impact | Mitigation Strategy                                                                        |
| ------- | --------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------ |
| **R-1** | MCP ecosystem fails to achieve critical mass              | Medium      | High   | Skill system as primary feature; MCP as enhancement; monitor ecosystem growth              |
| **R-2** | Model provider API changes break compatibility            | Medium      | Medium | Provider abstraction layer; version-specific adapters; deprecation monitoring              |
| **R-3** | Performance degradation with large datasets               | Medium      | Medium | Database indexing; pagination; virtualization; optional embedding search                   |
| **R-4** | Desktop app distribution friction (signing, notarization) | High        | Low    | CI/CD automation for releases; comprehensive documentation; platform-specific guides       |
| **R-5** | User adoption below expectations                          | Medium      | Medium | Community engagement; documentation quality; conference talks; MCP ecosystem collaboration |
| **R-6** | Workflow complexity overwhelms users                      | Medium      | High   | Progressive disclosure; strong defaults; Playground tutorials; workflow templates          |

### 12.2 Assumptions

| ID      | Assumption                                                                                          | Validation Method                                                           | Status              |
| ------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------- |
| **A-1** | Developers value local-first architecture enough to choose SkillDeck over cloud-native alternatives | User interviews; early adopter feedback; analytics on "offline usage"       | Unvalidated         |
| **A-2** | Branching conversations are useful, not confusing                                                   | User testing; analytics on branch creation and navigation; user feedback    | Unvalidated         |
| **A-3** | Multi-agent workflows are intuitive enough for mainstream adoption                                  | Playground tutorials; user feedback on workflow creation; support inquiries | Unvalidated         |
| **A-4** | MCP ecosystem continues to grow and mature                                                          | Monitoring MCP server registries; community engagement; new server releases | Monitoring          |
| **A-5** | Ollama provides sufficient local LLM capability for users needing full sovereignty                  | Testing against common coding tasks; user feedback on local model quality   | Partially validated |
| **A-6** | Users are comfortable managing their own API keys via OS keychain                                   | User feedback; support inquiries; onboarding completion rate                | Unvalidated         |

### 12.3 Open Issues

| ID         | Issue                                                                           | Owner        | Target Resolution | Status |
| ---------- | ------------------------------------------------------------------------------- | ------------ | ----------------- | ------ |
| **OI-001** | What default skill set should be included with SkillDeck?                       | Project Lead | Pre-alpha         | Open   |
| **OI-002** | Should SkillDeck include a curated "verified MCP servers" list?                 | Project Lead | v1 beta           | Open   |
| **OI-003** | What telemetry granularity is acceptable to privacy-conscious users?            | Project Lead | v1 beta           | Open   |
| **OI-004** | How should skill conflicts (same name, different sources) be surfaced to users? | Project Lead | v1 alpha          | Open   |
| **OI-005** | What is the minimum viable workflow creation UX?                                | Project Lead | v1 alpha          | Open   |
| **OI-006** | Should conversation export include embeddings for semantic search import?       | Project Lead | v1 beta           | Open   |
| **OI-007** | How should workspace-specific settings cascade with global settings?            | Project Lead | v1 alpha          | Open   |
| **OI-008** | What is the maximum number of concurrent MCP servers supported?                 | Project Lead | v1 alpha          | Open   |

---

## 13. Traceability & Mapping

### 13.1 Vision → BRS Traceability Matrix

| Vision Element               | BRS Element                                                          | Section            |
| ---------------------------- | -------------------------------------------------------------------- | ------------------ |
| **G-1** Branching            | BR-004, Domain Model: Conversation/Branch, JTBD-006, UC-003          | 4.1, 8.1, 9.2, 9.3 |
| **G-2** Skills               | BR-002, BR-007, Domain Model: Skill, JTBD-003, JTBD-007, UC-004      | 4.1, 8.1, 9.2, 9.3 |
| **G-3** Workflows            | BR-009, Domain Model: Workflow/Subagent, JTBD-002, JTBD-008, UC-006  | 4.1, 8.1, 9.2, 9.3 |
| **G-4** MCP                  | BR-005, Domain Model: MCP Server, JTBD-004, JTBD-009, UC-005, UC-008 | 4.1, 8.1, 9.2, 9.3 |
| **G-5** Providers            | Domain Model: Provider, JTBD-005                                     | 8.1, 9.2           |
| **G-6** UI                   | Operational Concept, Context Diagram                                 | 10.1, 10.2         |
| **G-7** Onboarding           | Phase 1: Setup, Scenario 1                                           | 10.2               |
| **G-8** i18n                 | (Deferred to SRS)                                                    | —                  |
| **G-9** Error Handling       | QE-005                                                               | 11.2               |
| **N-1** Data sovereignty     | BR-001, BR-006, SC-001, JTBD-001                                     | 4.1, 11.1, 9.2     |
| **N-2** Workflow complexity  | Domain Model: Workflow/Subagent, JTBD-002, JTBD-006, JTBD-008        | 8.1, 9.2           |
| **N-3** Skill portability    | BR-002, BR-007, JTBD-003, JTBD-007                                   | 4.1, 9.2           |
| **N-4** Transparency         | BR-003, JTBD-004                                                     | 4.1, 9.2           |
| **N-5** Provider flexibility | Domain Model: Provider, JTBD-005                                     | 8.1, 9.2           |

### 13.2 BRS → SRS Mapping (Preparation)

| BRS Element           | Will Map to SRS Section                 | Status               |
| --------------------- | --------------------------------------- | -------------------- |
| BR-001 to BR-010      | Constraints + Functional Requirements   | Ready                |
| QE-001 to QE-005      | Non-Functional Requirements (ISO 25010) | Needs quantification |
| Domain Model Entities | Data Requirements + Interfaces          | Ready                |
| JTBD-001 to JTBD-010  | Use Cases + User Stories                | Ready                |
| UC-001 to UC-010      | Use Case Specifications                 | Ready                |
| SC-001 to SC-006      | System Constraints                      | Ready                |
| OI-001 to OI-008      | TBD Log                                 | Needs resolution     |

### 13.3 ID Scheme for Downstream Traceability

| Prefix    | Scope               | Example            |
| --------- | ------------------- | ------------------ |
| **BO-**   | Business Outcome    | BO-1, BO-2         |
| **QG-**   | Quality Goal        | QG-1, QG-2         |
| **BR-**   | Business Rule       | BR-001, BR-002     |
| **N-**    | User Need           | N-1, N-2           |
| **JTBD-** | Job to Be Done      | JTBD-001, JTBD-002 |
| **UC-**   | Use Case            | UC-001, UC-002     |
| **SC-**   | System Constraint   | SC-001, SC-002     |
| **QE-**   | Quality Expectation | QE-001, QE-002     |
| **R-**    | Risk                | R-1, R-2           |
| **A-**    | Assumption          | A-1, A-2           |
| **OI-**   | Open Issue          | OI-001, OI-002     |

---

## Summary

This Business & Stakeholder Requirements Specification establishes:

| Category             | Count | Key Elements                                                                                        |
| -------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| Business Goals       | 3     | BO-1 (Open-source leadership), BO-2 (Market validation), BO-3 (Commercial foundation)               |
| Quality Goals        | 4     | QG-1 (Data integrity), QG-2 (Release quality), QG-3 (Performance), QG-4 (Graceful degradation)      |
| Business Rules       | 10    | BR-001 through BR-010 (security, skills, MCP, workflows)                                            |
| User Classes         | 3     | Primary: Individual Developers, Secondary: Power Users, Disfavored: Enterprise Teams                |
| Personas             | 1     | Alex — The Privacy-Conscious Developer                                                              |
| Domain Terms         | 20    | Glossary with DDD annotations                                                                       |
| Bounded Contexts     | 6     | Conversation, Skill, Profile, MCP, Workflow, Provider                                               |
| Domain Entities      | 9     | Conversation, Message, Tool Call, Profile, Skill, MCP Server, Workflow, Subagent Session, Workspace |
| Jobs to Be Done      | 10    | JTBD-001 through JTBD-010                                                                           |
| Use Cases            | 10    | UC-001 through UC-010 (candidate)                                                                   |
| Constraints          | 6     | SC-001 through SC-006                                                                               |
| Quality Expectations | 5     | QE-001 through QE-005                                                                               |
| Risks                | 6     | R-1 through R-6                                                                                     |
| Assumptions          | 6     | A-1 through A-6                                                                                     |
| Open Issues          | 8     | OI-001 through OI-008                                                                               |

---

## Next Steps

**Proceed to `/spec-srs`** to create the Software Requirements Specification, which will:

- Define detailed functional requirements with EARS syntax
- Quantify non-functional requirements with fit criteria
- Specify interfaces and data contracts
- Create the requirements traceability matrix from BRS to SRS
- Document the TBD log with resolution targets
