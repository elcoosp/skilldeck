# SkillDeck — Complete UX Design Document

**Date:** 2026-03-10  
**Status:** Final Design — Approved  
**Target Audience:** Developers and power users building AI workflows

---

## Executive Summary

SkillDeck is a local-first, desktop AI agent platform built with Tauri that provides developers complete control over their AI workflows. The UX follows a **progressive complexity** philosophy: users start with a clean, intuitive interface in Playground mode, then progressively unlock advanced features (workflows, subagents, MCP integration) as they become proficient. All data stays local in SQLite—no cloud sync, no external dependencies.

**Core UX Principles:**

- **Progressive disclosure** — Start simple, reveal power gradually
- **Developer-first** — Keyboard shortcuts, extensibility, transparency
- **Local-first** — Your data, your machine, your control
- **Workflow-centric** — Sequential, parallel, and evaluator-optimizer patterns built-in
- **Transparent intelligence** — Always show what the agent sees and does

---

## Table of Contents

1. [First Launch & Playground Experience](#1-first-launch--playground-experience)
2. [Progressive Feature Unlocking](#2-progressive-feature-unlocking)
3. [Core UI Layout & Navigation](#3-core-ui-layout--navigation)
4. [Subagent Cards](#4-subagent-cards)
5. [Workflow Visualization & Monitoring](#5-workflow-visualization--monitoring)
6. [Workspace Context & Active Skills Panel](#6-workspace-context--active-skills-panel)
7. [Branch Navigation](#7-branch-navigation)
8. [Tool Approval Flow & Smart Defaults](#8-tool-approval-flow--smart-defaults)
9. [Cost Tracking & Analytics](#9-cost-tracking--analytics)
10. [Skill & MCP Marketplace](#10-skill--mcp-marketplace)
11. [Settings & Configuration](#11-settings--configuration)
12. [Error Handling & Recovery](#12-error-handling--recovery)
13. [Keyboard Shortcuts & Power User Features](#13-keyboard-shortcuts--power-user-features)
14. [Data Management & Export](#14-data-management--export)
15. [Performance & Optimization](#15-performance--optimization)
16. [Accessibility](#16-accessibility)

---

## 1. First Launch & Playground Experience

### Onboarding Flow

**First run (no API key configured):**

```
Step 1/3: Add an API key
  [Anthropic]  [OpenAI]  [Google]  [Ollama local]
  Enter key: [_______________] [Validate]

Step 2/3: Create your first profile
  Name: [Default Profile_______]
  Model: [claude-sonnet-4-6 ▾]
  [Create profile]

Step 3/3: Launch Playground
  [Explore SkillDeck →]
```

### Playground Mode

**Goal:** Demonstrate SkillDeck's capabilities immediately without documentation.

**Pre-loaded conversation contains:**

- 3-4 basic agent message exchanges
- One skill being dynamically loaded mid-conversation (`loadSkill` tool call visible)
- One subagent card showing a completed code review task
- A simple sequential workflow (2-3 steps, visible in right panel DAG)
- One tool approval interaction (pre-approved, shows the UI pattern)
- One branch point with 2 alternate responses

**Playground UI Elements:**

- **Banner:** "👋 Welcome to SkillDeck Playground - explore these examples, then start your own conversation"
- **Inline tooltips** (appear on first hover):
  - Subagent card: "Subagents handle subtasks independently"
  - Branch pills: "Try different approaches by branching"
  - Skills panel: "Active skills guide the agent's behavior"
  - Workflow DAG: "Workflows orchestrate complex multi-step tasks"
- **"Start Fresh" button** in header (exits playground, creates new conversation)

**Playground Persistence:**

- Stored in DB like any conversation, tagged `is_playground: true`
- Never deleted automatically
- Accessible via "Reopen Playground" in Help menu
- Can be duplicated/forked for continued experimentation

**Exit Strategy:**

- User clicks "Start Fresh" → creates first real conversation
- Playground becomes just another conversation in history
- No forced tutorials, no modal overlays—playground IS the tutorial

---

## 2. Progressive Feature Unlocking

### Feature Gating Philosophy

Start with core functionality, unlock advanced features as users demonstrate proficiency. Always provide "Show all features" override in Settings for power users who want immediate access.

### Unlock Stages

#### **Stage 1: Initial Experience (Conversations 1-4)**

**Available:**

- Single-agent conversations
- Skill loading (via `loadSkill` tool or skills panel)
- Tool approvals with smart defaults
- Basic branching (create alternate responses)
- File attachments
- Message editing

**Hidden:**

- Workflow creation UI
- Subagent spawn suggestions
- Advanced profile settings (only basic model/skills shown)
- Workflow DAG visualization
- Analytics tab

**Right Panel:**

- Shows workspace context and active skills only
- Workflow tab hidden
- Analytics tab hidden

---

#### **Stage 2: "Ready for Workflows" (After 5+ conversations OR first manual skill load)**

**Unlock Notification:**

```
┌─────────────────────────────────────────┐
│ 🎯 You're ready for workflows!          │
│                                          │
│ Tackle complex tasks with sequential,   │
│ parallel, and evaluator-optimizer       │
│ patterns.                                │
│                                          │
│ [Learn more] [Dismiss]                  │
└─────────────────────────────────────────┘
```

**Click "Learn more" → Opens dismissible overlay:**

- Brief explanation of three workflow types
- Visual example of each pattern
- Link to full documentation
- "Try it now" button (suggests a workflow-suitable task)

**Newly Unlocked:**

- Workflow DAG visualization in right panel (Workflow tab appears)
- Workflow skill templates in marketplace
- "Use workflow" contextual suggestions when agent detects suitable tasks
- Subagent spawn shows workflow configuration options
- Basic workflow metrics in conversation header

---

#### **Stage 3: "Power User Mode" (After 15+ conversations OR 3+ workflow uses)**

**Unlock Notification:**

```
┌─────────────────────────────────────────┐
│ ⚡ Advanced features unlocked            │
│                                          │
│ Custom merge strategies, nested         │
│ workflows, and workflow templates now   │
│ available.                               │
│                                          │
│ [Explore] [Dismiss]                     │
└─────────────────────────────────────────┘
```

**Newly Unlocked:**

- Custom aggregation strategies for parallel workflows (voting, union, best_of, custom)
- Nested workflow composition in skill frontmatter
- Workflow template creation ("Save as template" on completed workflows)
- Advanced analytics tab (cost breakdowns, bottleneck identification, trend charts)
- Workflow performance comparison tools
- Profile-level workflow defaults configuration

---

#### **Stage 4: "MCP Integration" (After opening first workspace OR explicit request)**

**Unlock Notification:**

```
┌─────────────────────────────────────────┐
│ 📦 MCP Servers Available                │
│                                          │
│ MCP servers can connect tools to your   │
│ workspace. Check the marketplace?       │
│                                          │
│ [Browse MCP servers] [Maybe later]      │
└─────────────────────────────────────────┘
```

**Newly Unlocked:**

- MCP marketplace tab
- Local server discovery (auto-detects running MCP servers)
- Tool browser showing all available MCP tools
- MCP server management in settings
- Tool approval configuration per MCP server

---

### Override Mechanism

**Settings → Advanced → "Show all features"**

- Checkbox immediately unlocks everything
- No notifications or tutorials
- All features available from first launch
- Recommended for experienced users or those migrating from similar tools

**Command Palette Behavior:**

- Always shows all commands, regardless of unlock state
- Locked features displayed in gray with unlock condition:
  - "Create workflow (🔒 unlock after 5 conversations)"
  - "Workflow templates (🔒 unlock in power user mode)"
- Power users can still discover features via ⌘K

---

## 3. Core UI Layout & Navigation

### Three-Panel Layout

Persistent three-panel design using `react-resizable-panels`:

```
┌────────────┬──────────────────────────┬─────────────────┐
│  Left      │       Center             │     Right       │
│  Panel     │       Panel              │     Panel       │
│            │                          │                 │
│ Convos &   │    Conversation          │   Context &     │
│ Folders    │    Stream                │   Insights      │
│            │                          │                 │
│ (250-400px)│    (flexible)            │   (300-500px)   │
│ resizable  │                          │   resizable     │
│            │                          │   collapsible   │
└────────────┴──────────────────────────┴─────────────────┘
```

---

### Left Panel: Conversations & Organization

**Header:**

- "New Conversation" button (⌘N)
- Folder dropdown (organize conversations)
- Search icon (⌘⇧F for semantic search)

**Conversation List (Virtualized with @tanstack/react-virtual):**

**Grouping:**

- Today
- Yesterday
- Last 7 days
- Older

Each group is collapsible. Pinned conversations stay at top of their group.

**Conversation Item Display:**

```
┌─────────────────────────────────────┐
│ 🟦 Refactor auth system             │
│    2:34 PM  •  📁 rust-project      │
└─────────────────────────────────────┘
```

- Profile icon/color (left)
- Title (auto-generated, user-editable)
- Timestamp
- Workspace badge (if tied to workspace)

**Hover Actions:**

- Pin/unpin
- Move to folder
- Delete (soft delete)

**Footer:**

- Workspace selector: "No workspace" or "📁 my-project" (click to change)
- Settings gear icon (⌘,)

---

### Center Panel: Conversation

**Header Bar:**

```
┌───────────────────────────────────────────────────────┐
│ [Profile ▾] Refactor auth system  [Branch] [⋮ Menu] │
└───────────────────────────────────────────────────────┘
```

**Left:** Profile switcher (dropdown with icon + name)  
**Center:** Auto-generated title (click to edit inline)  
**Right:** Branch indicator (if on non-main branch) + overflow menu (export, analytics, delete)

---

**Message Stream:**

**User messages:**

- Right-aligned
- Subtle background color
- Timestamp on hover

**Agent messages:**

- Left-aligned
- Model indicator (small badge: "sonnet-4")
- Streaming animation while generating

**Tool call cards:**

- Inline, expandable
- Shows tool name, MCP server, status
- Collapsed by default, expand to see args/results

**Subagent cards:**

- Full-width cards (see Section 4)
- Show task, skill used, tools called, output
- Merge/discard actions when complete

**Branch navigation:**

- Hybrid pills + compare button (see Section 7)
- Numbered pills (①②③) on messages with branches
- "Compare all" button appears on hover

---

**Input Area:**

```
┌─────────────────────────────────────────────────────────┐
│ 📁 Using workspace context                              │
├─────────────────────────────────────────────────────────┤
│ Type a message...                                       │
│                                                         │
│ [@mention] [📎 attach]              [claude-sonnet-4 ▾] │
└─────────────────────────────────────────────────────────┘
```

**Elements:**

- Workspace context badge (if workspace open, dismissible per conversation)
- Text input with @ mention picker (skills, prompts, files)
- File attachment button
- Model selector (shows active profile's model, can override)
- Send button (⌘Enter to send)

---

### Right Panel: Context & Insights

**Tabbed Interface:**

**Tabs appear based on state:**

- **Context** (always visible)
- **Workflow** (appears when workflow active)
- **Analytics** (appears after power user unlock)

**Tab auto-switches:**

- Workflow starts → auto-switch to Workflow tab
- Workflow completes → stays on Workflow tab until user switches
- No workflow active → defaults to Context tab

**Collapsible:**

- Toggle with ⌘⇧B
- Collapses to icon bar on right edge
- Click icon to re-expand to specific tab

---

### Command Palette (⌘K)

**Dark overlay with centered search modal:**

```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ Search commands and actions...      │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ Actions                                  │
│ → New conversation                  ⌘N  │
│ → Open workspace                    ⌘O  │
│ → Open marketplace                 ⌘⇧M  │
│                                          │
│ Skills                                   │
│ → rust-expert                           │
│ → code-reviewer                         │
│                                          │
│ Recent Conversations                     │
│ → Refactor auth system                  │
│ → Debug login flow                      │
│                                          │
│ Custom Commands (from skills)           │
│ → Deploy to staging            ⌘⇧D S    │
└─────────────────────────────────────────┘
```

**Fuzzy Search Across:**

1. **Actions:** New conversation, switch profile, load skill, open workspace, settings, export
2. **Installed Skills:** Name + description. Enter to load into current conversation
3. **Recent Conversations:** Quick jump to any conversation
4. **Skill-Registered Commands:** Custom commands from skill frontmatter

**UI Details:**

- Type to filter (fuzzy matching)
- Arrow keys to navigate
- Enter to execute
- Category tags shown (Action, Skill, Conversation, Custom Command)
- Recent/frequent items bubble to top
- Locked features show in gray with unlock condition

---

### Global Keyboard Shortcuts

All shortcuts work from anywhere in the app (see Section 13 for complete list).

**Most Important:**

- `⌘K` — Command palette
- `⌘N` — New conversation
- `⌘P` — Quick conversation switcher
- `⌘O` — Open workspace
- `⌘,` — Settings
- `⌘1/2/3` — Focus panels

---

## 4. Subagent Cards

### Developer-Friendly Design

Subagent cards show just enough information to stay aware without cluttering the conversation. Expand for full details.

### Collapsed State (Default)

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 Code Review Assistant                    [Stop] [↗] │
│ Using skill: security-reviewer              ⚡ 2.4K    │
│                                                          │
│ Tools: read_file(3), analyze_code(1)        💰 $0.008  │
│ ▸ Checking authentication logic...                      │
│                                                          │
│ [Show full output ▾]                                    │
└─────────────────────────────────────────────────────────┘
```

**Key Elements:**

- **Header row:** Task name + action buttons (Stop if running, Fork to new conversation)
- **Metadata row:** Skill name (clickable) + token count (live) + cost (calculated)
- **Tools summary:** Collapsed count per tool type
- **Output preview:** Last line of streaming output
- **Expand button:** Click to see full details

---

### Expanded State

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 Code Review Assistant                    [Stop] [↗] │
│ Using skill: security-reviewer              ⚡ 2.4K    │
│                                                          │
│ Tools used:                                              │
│  ✓ read_file(src/auth.rs) - 1.2K tokens                │
│  ✓ read_file(src/middleware.rs) - 890 tokens           │
│  ✓ analyze_code(...) - 340 tokens                      │
│  ⟳ Running: check_vulnerabilities(...)                 │
│                                                          │
│ Output:                                                  │
│ ┌────────────────────────────────────────┐             │
│ │ Found 2 potential security issues:     │             │
│ │                                         │             │
│ │ 1. SQL injection risk in login handler │             │
│ │    Line 47: Direct string interpolation│             │
│ │    [Show code]                          │             │
│ │                                         │             │
│ │ 2. Missing CSRF token validation...    │             │
│ └────────────────────────────────────────┘             │
│                                                          │
│ [Copy output] [Fork to new conversation] [Merge ▾]     │
└─────────────────────────────────────────────────────────┘
```

**Expanded Details:**

**Tool calls section:**

- Each tool call with truncated args
- Token cost per call
- Status indicators: ✓ (done), ⟳ (running), ✗ (failed)
- Failed tools show error message on hover

**Output section:**

- Full scrollable output container
- Syntax highlighting if code
- "Show code" links expand inline code blocks

**Footer actions (when done):**

- **Copy output** — Copies to clipboard
- **Fork to new conversation** — Opens new conversation with this subagent's full context
- **Merge dropdown** — Choose strategy:
  - Concat (append to conversation)
  - Summarize (agent summarizes then appends)
  - First wins (just use this output)
  - Discard (remove subagent, don't merge)

---

### Subagent States

**Running:**

- Animated border (subtle pulse)
- Live token counter
- Streaming output preview (last 1-3 lines)
- Stop button enabled

**Done:**

- Static display
- Final token count and cost
- Merge actions enabled
- Output fully visible

**Failed:**

- Red accent color
- Error message displayed
- "Retry" button
- Option to edit config and retry

**Merged:**

- Dimmed card with checkmark
- "Merged as message #47" link (click to jump to merged message)
- Card becomes read-only historical record

---

## 5. Workflow Visualization & Monitoring

### DAG Visualization (Right Panel - Workflow Tab)

**Powered by @xyflow/react**

**When Visible:**

- Appears when workflow execution starts
- Right panel auto-switches to Workflow tab
- Stays visible until workflow completes or user switches tabs
- Can be reopened for completed workflows (historical view)

---

### Layout Example

```
┌─────────────────────────────────────────┐
│ Code Review Workflow          [Stop]    │
│ Sequential → Parallel → Evaluator       │
│ Step 2/5  ⚡ 8.2K tokens  💰 $0.031     │
├─────────────────────────────────────────┤
│                                          │
│   ┌──────────┐                          │
│   │ Generate │ ✓                        │
│   │ 1.8K tok │                          │
│   └────┬─────┘                          │
│        │                                 │
│   ┌────┴─────────────┐                  │
│   │                  │                  │
│ ┌─▼──────────┐  ┌───▼────────┐        │
│ │Security ⟳  │  │Performance │ ✓      │
│ │Check       │  │Review      │         │
│ │840 tokens  │  │1.2K tokens │         │
│ └──────┬─────┘  └──────┬─────┘        │
│        └────────┬───────┘               │
│           ┌─────▼──────┐                │
│           │ Aggregate  │ ⧖              │
│           │ (voting)   │                │
│           └─────┬──────┘                │
│           ┌─────▼──────┐                │
│           │  Refine    │                │
│           │  (eval-opt)│                │
│           │  iter 0/3  │                │
│           └────────────┘                │
│                                          │
│ [Minimap]                    [Fit view] │
└─────────────────────────────────────────┘
```

---

### Node Types & States

#### **1. Agent Step Node**

**Pending:**

- Gray outline
- Dashed border
- Step name + skill name

**Running:**

- Blue border
- Animated pulse
- Live token counter
- "⟳ Running..." indicator

**Completed:**

- Green checkmark badge
- Final token count
- Solid border

**Failed:**

- Red border
- Error icon (✗)
- Hover shows error details

---

#### **2. Aggregator Node**

**Shows:**

- Merge strategy (voting, union, best_of, custom)
- Input completion status: "2/3 complete"
- Waiting indicator (⧖) until all inputs received

**States:**

- Pending (waiting for inputs)
- Running (aggregating results)
- Completed (merged output ready)

---

#### **3. Evaluator Node (Eval-Opt Workflows)**

**Shows:**

- Iteration count: "iter 2/3"
- Quality score bar (0.0-1.0)
- Visual trend: `●●◐○ 0.78` (filled circles = completed iterations, score)
- Pass/fail indicator

**Click to expand iteration history:**

```
Iteration 1: 0.65 ✗ (below threshold)
 → Feedback: "Missing error handling examples"

Iteration 2: 0.78 ✗ (below threshold)
 → Feedback: "Needs more code comments"

Iteration 3: running...
```

**If max iterations reached without passing:**

```
┌─────────────────────────────────────────┐
│ Quality threshold not reached           │
│                                          │
│ Best attempt: 0.78 (threshold: 0.85)    │
│                                          │
│ [Use best attempt] [Try different       │
│                     evaluator skill]    │
│ [Stop workflow]                          │
└─────────────────────────────────────────┘
```

---

### Connections (Edges)

**Visual indicators:**

- **Solid arrows:** Completed dependencies (data passed)
- **Dashed arrows:** Pending dependencies (waiting)
- **Animated arrows:** Active data flow (data currently transferring)

---

### Interactions

**Click node:**

- Expands to show full output inline, OR
- Opens linked subagent card in center panel (if subagent exists)

**Hover node:**

- Tooltip shows:
  - Full step name
  - Skill used
  - Exact metrics (tokens, cost, latency)
  - Status details

**Minimap:**

- Shows overall workflow structure (bottom-left corner)
- Click to navigate large workflows
- Current viewport highlighted

**Controls:**

- Zoom in/out buttons
- Fit view (auto-zoom to show all nodes)
- Reset to default layout

---

### Header Metrics

```
Code Review Workflow          [Stop]
Sequential → Parallel → Evaluator
Step 2/5  ⚡ 8.2K tokens  💰 $0.031
```

**Displays:**

- Workflow name (from skill or auto-generated)
- Workflow type(s) (shows pattern: sequential, parallel, eval-opt)
- Progress: "Step 2/5" (completed / total)
- Total tokens across all steps (live updating)
- Total cost (calculated from tokens + model pricing)
- Stop button (pauses after current step, prompts confirmation)

---

### Workflow Completion

**When workflow completes:**

- All nodes show final state (✓ or ✗)
- Header shows final metrics
- DAG remains visible for review
- Can be collapsed or closed
- Historical view available: click conversation → Workflow tab → see completed DAG

---

## 6. Workspace Context & Active Skills Panel

### Active Context Panel (Right Panel - Context Tab)

Always visible and provides full transparency into what the agent sees.

---

### Layout (Workspace Open)

```
┌─────────────────────────────────────────┐
│ 📁 Workspace: my-rust-project            │
│ Type: Rust  •  Last opened: 2h ago       │
├─────────────────────────────────────────┤
│ Context Files                            │
│ ✓ CLAUDE.md (2.3K chars)                │
│ ✓ README.md (first 500 chars)           │
│ ✓ Cargo.toml (dependencies scanned)     │
│ [Edit CLAUDE.md]                         │
├─────────────────────────────────────────┤
│ File Access Rules                        │
│ ✓ .gitignore active (342 patterns)      │
│ ✓ .claudeignore active (12 patterns)    │
│ ⚠ Excluding: .env, target/, *.key       │
│ [View all rules]                         │
├─────────────────────────────────────────┤
│ Active Skills (5)               Priority │
│                                           │
│ 🔵 rust-expert          workspace    1   │
│ 🟢 code-reviewer        personal     2   │
│ 🟡 test-generator       personal     3   │
│ 🟠 security-checker     marketplace  4   │
│ 🔴 doc-writer           superpowers  5   │
│                                           │
│ ⚠ 2 shadowed skills [Show]              │
│ [Load skill...] [Manage priorities]      │
├─────────────────────────────────────────┤
│ MCP Servers (3)                          │
│ ✓ filesystem (workspace root)            │
│ ✓ brave-search                           │
│ ✓ postgres (local dev DB)               │
│ [Add server...]                          │
└─────────────────────────────────────────┘
```

---

### Section Breakdown

#### **Workspace Info**

- **Name:** Click to open workspace folder in system file manager
- **Detected Type:** Icon + label (Rust, Node, Python, Generic)
  - Auto-detected from project files (Cargo.toml, package.json, pyproject.toml)
  - Used for smart tool approval defaults
- **Last Opened:** Timestamp for reference

---

#### **Context Files Section**

Shows which files are auto-injected into system prompt:

- **CLAUDE.md** — Full content injected if present (character count shown)
- **README.md** — First 500 chars injected (configurable in settings)
- **Cargo.toml / package.json / etc.** — Dependencies scanned and summarized

**Actions:**

- **[Edit CLAUDE.md]** — Opens file in system default editor
- Click filename → Expand to see actual injected content
- Character counts provide transparency (know what's consuming context)

---

#### **File Access Rules**

Shows filesystem access restrictions:

- **`.gitignore` status:** Active/inactive, pattern count
- **`.claudeignore` status:** Active/inactive, pattern count
- **Warning badge:** Shows sample of excluded sensitive patterns (`.env`, `*.key`, `target/`)
- **[View all rules]** — Opens detailed modal:
  ```
  ┌─────────────────────────────────────────┐
  │ File Access Rules                        │
  ├─────────────────────────────────────────┤
  │ .gitignore (342 patterns)                │
  │ • target/                                │
  │ • **/*.rs.bk                             │
  │ • Cargo.lock                             │
  │ • .env*                                  │
  │ [View full .gitignore]                   │
  │                                          │
  │ .claudeignore (12 patterns)              │
  │ • *.key                                  │
  │ • secrets/                               │
  │ • .ssh/                                  │
  │ [View full .claudeignore]                │
  └─────────────────────────────────────────┘
  ```

---

#### **Active Skills**

**Color-coded by source:**

- 🔵 Workspace (highest priority)
- 🟢 Personal
- 🟡 Superpowers
- 🟠 Marketplace (lowest priority)

**Displays:**

- Skill name (clickable to view SKILL.md)
- Source type
- Priority number (1 = highest, used for shadowing resolution)

**Shadowing Indicator:**

- "⚠ 2 shadowed skills [Show]" — Expands to detail view:

```
┌─────────────────────────────────────────┐
│ Shadowed Skills (2)                      │
├─────────────────────────────────────────┤
│ code-reviewer                            │
│ ✓ workspace/code-reviewer (active)      │
│ ○ personal/code-reviewer (shadowed)     │
│ [View diff] [Switch to personal version]│
├─────────────────────────────────────────┤
│ security-checker                         │
│ ✓ personal/security-checker (active)    │
│ ○ marketplace/security-checker (shadowed)│
│ [View diff] [Use marketplace version]   │
└─────────────────────────────────────────┘
```

**Actions:**

- **[Load skill...]** — Opens skill picker (fuzzy search)
- **[Manage priorities]** — Opens reorderable list of skill source directories
- **[View diff]** — Side-by-side comparison of active vs shadowed skill
- **[Switch to version]** — Override priority for this conversation only

---

#### **MCP Servers**

Active MCP server connections:

- **Server name** (e.g., "filesystem")
- **Configuration details** (e.g., "workspace root")
- **Connection status:** ✓ (connected), ⚠ (degraded), ✗ (disconnected)

**Actions:**

- **[Add server...]** — Opens marketplace or manual config form
- Click server → Show tools available from this server
- Right-click → Disconnect, reconfigure, view logs

---

### Layout (No Workspace Open)

```
┌─────────────────────────────────────────┐
│ No workspace open                        │
│                                          │
│ Open a workspace to enable:              │
│ • Project-specific context               │
│ • File access scoping                    │
│ • Workspace-level skills                 │
│                                          │
│ [Open Workspace]                         │
│                                          │
│ Recent Workspaces:                       │
│ → my-rust-project  (2h ago)             │
│ → web-dashboard    (yesterday)          │
│ → cli-tool         (3 days ago)         │
├─────────────────────────────────────────┤
│ Active Skills (3)               Priority │
│ 🟢 code-reviewer        personal     1   │
│ 🟡 test-generator       personal     2   │
│ 🔴 doc-writer           superpowers  3   │
│                                          │
│ [Load skill...] [Manage priorities]      │
├─────────────────────────────────────────┤
│ MCP Servers (1)                          │
│ ✓ brave-search                           │
│ [Add server...]                          │
└─────────────────────────────────────────┘
```

**No workspace state:**

- Shows "Open Workspace" prompt
- Lists recent workspaces for quick reopening
- Active skills section still shows (from profile defaults, no workspace skills)
- Conversations created without workspace are "scratch" conversations

---

## 7. Branch Navigation

### Hybrid Approach: Pills + Compare View

Combines simplicity (numbered pills) with power (side-by-side comparison).

---

### Inline Pills (Default View)

**On messages with branches:**

```
┌─────────────────────────────────────────┐
│ 🤖 Assistant                             │
│                                          │
│ Here's a refactored version using...    │
│ [full message content]                   │
│                                          │
│ Branches: ① ② ③        [Compare all]   │
│           ▲ active                       │
└─────────────────────────────────────────┘
```

**Pill States:**

- **Active branch:** Filled circle with accent color (①)
- **Other branches:** Outlined circles (② ③)
- **Hover:** Shows preview tooltip:
  ```
  ┌──────────────────────────────┐
  │ Branch 2: Alternative approach│
  │                               │
  │ "Here's a different way      │
  │  using iterators..."         │
  │                               │
  │ Click to switch              │
  └──────────────────────────────┘
  ```

---

### Compare All View (Modal Overlay)

**Click "Compare all" button:**

```
┌───────────────────────────────────────────────────────────┐
│ Compare 3 Branches                              [Close ✕] │
├───────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│ │ Branch 1 ✓  │ │ Branch 2    │ │ Branch 3    │         │
│ │ (active)    │ │             │ │             │         │
│ ├─────────────┤ ├─────────────┤ ├─────────────┤         │
│ │ Here's a    │ │ Here's a    │ │ Here's a    │         │
│ │ refactored  │ │ different   │ │ functional  │         │
│ │ version     │ │ way using   │ │ approach    │         │
│ │ using...    │ │ iterators...│ │ with...     │         │
│ │             │ │             │ │             │         │
│ │ [Full       │ │ [Full       │ │ [Full       │         │
│ │  message    │ │  message    │ │  message    │         │
│ │  content]   │ │  content]   │ │  content]   │         │
│ │             │ │             │ │             │         │
│ ├─────────────┤ ├─────────────┤ ├─────────────┤         │
│ │ ⚡ 1.2K     │ │ ⚡ 1.4K     │ │ ⚡ 980      │         │
│ │ [Use this]  │ │ [Use this]  │ │ [Use this]  │         │
│ └─────────────┘ └─────────────┘ └─────────────┘         │
└───────────────────────────────────────────────────────────┘
```

**Features:**

- Side-by-side columns (responsive, scrolls horizontally if >3 branches)
- Active branch highlighted
- Each branch shows full message content
- Token count per branch (bottom of each column)
- "Use this" button switches to that branch and closes modal

---

### Interaction Flow

1. **Click pill (①②③):** Instantly switches to that branch in conversation view
2. **Hover pill:** See preview tooltip of that branch's content
3. **Click "Compare all":** Open side-by-side modal view
4. **In compare view, click "Use this":** Switch to that branch and close modal
5. **Keyboard shortcuts:**
   - `⌘←` — Previous branch
   - `⌘→` — Next branch
   - `⌘⇧C` — Compare all branches

---

### Branch Naming

**Default:** "Branch 1", "Branch 2", "Branch 3"

**User can rename:**

- Right-click pill → "Rename branch"
- Enter custom name: "Optimized version"
- Named branches show in:
  - Hover tooltip
  - Compare view headers
  - Conversation list (if active): `🌿 Conversation title (Optimized version)`

---

### Branch Indicators in UI

**Conversation List:**

- Conversations on non-main branch show branch icon: `🌿 Conversation title (Branch 2)`

**Conversation Header:**

- Branch dropdown shows current branch name
- Click to switch branches without scrolling to branching point

---

### Creating New Branches

**Two methods:**

1. **Edit message:**
   - Click message → "Edit" (or hover → pencil icon)
   - Make changes
   - "Save as new branch" (creates sibling message)

2. **Regenerate response:**
   - Hover assistant message → "Regenerate"
   - Sends same user message again
   - New response becomes new branch

---

## 8. Tool Approval Flow & Smart Defaults

### Risk-Based Classification

Tools are categorized by risk level, determining approval behavior:

---

#### **Auto-Approve (Green)**

**No user interaction required:**

- **Read-only operations:**
  - `read_file`, `list_directory`, `search_files`
  - `get_file_metadata`, `stat`
- **Information retrieval:**
  - `web_search`, `get_documentation`
  - `query_database` (SELECT only)
- **Workspace-scoped safe commands** (detected project type):
  - **Rust:** `cargo check`, `cargo test --no-run`, `cargo clippy --dry-run`
  - **Node:** `npm list`, `npm outdated`, `npm audit`
  - **Python:** `pytest --collect-only`, `pip list`, `pip show`

**Rationale:** These operations can't modify state, low risk.

---

#### **Require Approval (Yellow)**

**User must approve, but low friction:**

- **Write operations:**
  - `write_file`, `create_file`, `update_file`
  - `delete_file` (single file)
- **Command execution:**
  - `cargo build`, `npm install`, `git commit`
  - Any command not in auto-approve list
- **External API calls:**
  - `send_email`, `post_to_slack`
  - `deploy_to_server`, `trigger_ci`
- **Database operations:**
  - `execute_sql` (INSERT, UPDATE, DELETE)

**Rationale:** Could modify state, but typically safe. User should be aware but not alarmed.

---

#### **Always Confirm (Red)**

**Explicit confirmation required, with warning:**

- **Destructive operations:**
  - `delete_directory`, `force_push`
  - `drop_table`, `truncate`
- **System commands:**
  - Any command with `sudo`, `rm -rf`, `chmod 777`
  - `shutdown`, `reboot`
- **Network operations outside workspace:**
  - `curl` to external URLs (not whitelisted domains)
  - `wget`, `scp`

**Rationale:** High risk of data loss or security issues.

---

### Approval UI

#### **Inline Approval Card** (Yellow/Red tools)

Appears in conversation stream when approval needed:

```
┌─────────────────────────────────────────┐
│ ⚠️  Tool Approval Required               │
├─────────────────────────────────────────┤
│ Tool: write_file                         │
│ MCP Server: filesystem                   │
│                                          │
│ Arguments:                               │
│ path: src/auth.rs                       │
│ content: [2.3K chars]                   │
│ [Preview file content ▾]                │
│                                          │
│ Risk: Medium (Write operation)          │
│                                          │
│ ☐ Always approve write_file in this     │
│    workspace (session only)             │
│                                          │
│ [Approve] [Deny] [Edit args]            │
└─────────────────────────────────────────┘
```

**For destructive (red) tools:**

```
┌─────────────────────────────────────────┐
│ 🛑 Destructive Operation — Confirm      │
├─────────────────────────────────────────┤
│ Tool: delete_directory                   │
│ MCP Server: filesystem                   │
│                                          │
│ Arguments:                               │
│ path: /workspace/target/                │
│                                          │
│ Risk: HIGH (Permanent deletion)          │
│                                          │
│ This operation cannot be undone.         │
│                                          │
│ Type "DELETE" to confirm: [_________]   │
│                                          │
│ [Cancel]                                 │
└─────────────────────────────────────────┘
```

---

#### **Toast Notification** (Quick approvals for yellow tools)

For low-risk yellow tools that still need approval:

```
┌─────────────────────────────────────────┐
│ ⚠️  write_file(src/utils.rs)            │
│ [Approve] [Deny] [Details]              │
└─────────────────────────────────────────┘
```

Appears as Sonner toast (top-right corner), auto-dismisses on action.

**Click "Details"** → expands to full inline card.

---

### Trust Memory (Session-Scoped)

**"Always approve in this workspace" checkbox:**

When user checks this:

- Stores in DB: `tool_approvals(workspace_id, tool_name, auto_approve_until)`
- `auto_approve_until` = end of current session (conversation closed)
- Tool auto-approves for remainder of session
- Next session requires re-approval (fresh explicit consent)

**Rationale:** Reduces friction for repetitive tasks (e.g., multiple file writes during refactoring) while maintaining safety (resets each session).

---

### Settings Override (Persistent)

**Settings → Tool Approvals:**

```
┌─────────────────────────────────────────┐
│ Tool Approval Settings                   │
├─────────────────────────────────────────┤
│ Global Defaults:                         │
│ ☑ Auto-approve read-only operations     │
│ ☑ Require approval for write operations │
│ ☑ Always confirm destructive operations │
│                                          │
│ Per-Workspace Overrides:                 │
│                                          │
│ my-rust-project:                         │
│ • write_file: Auto-approve (persistent) │
│ • cargo build: Auto-approve             │
│ [Add override...]                        │
│                                          │
│ web-dashboard:                           │
│ • No overrides                           │
│                                          │
│ Approval History (last 100):             │
│ 2026-03-10 14:23  write_file  Approved  │
│ 2026-03-10 14:20  delete_file Denied    │
│ 2026-03-10 14:15  cargo build Approved  │
│ [View all...]                            │
└─────────────────────────────────────────┘
```

**Power users can:**

- Set persistent auto-approvals per workspace
- Demote auto-approve tools to require-approval
- See full approval history for auditing

---

### Approval Flow (Agent Perspective)

1. **Agent calls tool** → Core checks approval rules
2. **If auto-approve:** Execute immediately, emit `agent:tool_call` + `agent:tool_result` events
3. **If requires approval:** Pause agent loop, emit `agent:approval_required` event
4. **UI renders approval card** → User approves/denies
5. **If approved:** Execute tool, resume agent loop
6. **If denied:** Inject denial as tool result ("User denied write_file"), agent sees and can try alternative

---

## 9. Cost Tracking & Analytics

### Philosophy: Passive Monitoring

No budget warnings, no interruptions. Users check costs when they want. All tracking is informational, never blocking.

---

### Header Display (Conversation)

**Top-right corner of conversation header:**

```
⚡ 12.4K tokens  💰 $0.047
```

**Updates in real-time** as conversation progresses (tokens and cost stream in).

**Click to expand:**

```
┌─────────────────────────────────────────┐
│ Conversation Analytics                   │
├─────────────────────────────────────────┤
│ Total tokens: 12,431                     │
│ ├─ Input: 8,234 tokens                  │
│ ├─ Output: 4,197 tokens                 │
│ └─ Cache read: 2,100 tokens (saved)     │
│                                          │
│ Total cost: $0.047                       │
│ ├─ Input: $0.025                        │
│ ├─ Output: $0.021                       │
│ └─ Cache: $0.001                        │
│                                          │
│ Model: claude-sonnet-4-6                │
│ Messages: 8 exchanges                    │
│ Subagents: 1 (cost: $0.008)             │
│ Workflows: 0                             │
│                                          │
│ [View full analytics]                    │
└─────────────────────────────────────────┘
```

**Breakdown:**

- Token split: input, output, cache reads
- Cost split: per token type
- Model used
- Message count
- Subagent contribution to cost
- Workflow cost (if any)

---

### Analytics Panel (Right Panel - Analytics Tab)

**Unlocks after:** 15+ conversations (power user mode)

```
┌─────────────────────────────────────────┐
│ Usage Analytics                          │
├─────────────────────────────────────────┤
│ Last 30 Days                             │
│                                          │
│ Total Cost: $2.34                        │
│ Total Tokens: 487K                       │
│ Conversations: 23                        │
│ Workflows: 7                             │
│                                          │
│ ┌────── Cost Trend ──────┐              │
│ │    [Line chart         │              │
│ │     showing daily      │              │
│ │     cost over time]    │              │
│ └─────────────────────────┘              │
│                                          │
│ Top Models Used:                         │
│ • claude-sonnet-4    18 (78%)  $1.89   │
│ • claude-opus-4       5 (22%)  $0.45   │
│                                          │
│ Most Expensive Conversations:            │
│ 1. Refactor auth system        $0.23    │
│ 2. Generate API docs           $0.18    │
│ 3. Debug performance issue     $0.15    │
│                                          │
│ Most Expensive Workflows:                │
│ 1. Code review (parallel)      $0.23    │
│ 2. Documentation gen (seq)     $0.18    │
│ 3. Refactoring (eval-opt)      $0.15    │
│                                          │
│ [Export CSV] [View detailed report]      │
└─────────────────────────────────────────┘
```

**Charts (Recharts):**

- **Cost trend:** Line chart, daily cost over selected period
- **Token distribution:** Pie chart (input vs output vs cache)
- **Model usage:** Bar chart (cost per model)

**Time range selector:**

- Last 7 days
- Last 30 days
- Last 90 days
- All time
- Custom range

---

### Export & Reporting

**Export CSV:**

- Columns: `timestamp, conversation_id, model, input_tokens, output_tokens, cache_tokens, cost_usd, workflow_type`
- Useful for expense tracking, optimization analysis
- One row per message (detailed) or per conversation (summary)

**Generate Monthly Report:**

- One-click button
- Creates markdown document:
  - Total spend
  - Cost per workspace
  - Most expensive operations
  - Model usage breakdown
  - Recommendations (e.g., "Switch to Haiku for simple tasks to save 40%")

---

### No Budget Warnings

**Explicitly no:**

- Pop-ups interrupting conversations
- "You've exceeded X dollars" warnings
- Hard budget limits that block usage
- Scary red text

**Why:** Developers want awareness, not nannying. They can check costs anytime via the header or analytics panel. If they need budgets, they can use their API provider's billing alerts.

---

## 10. Skill & MCP Marketplace

### Marketplace UI

**Triggered by:**

- `⌘⇧M` keyboard shortcut
- "Marketplace" button in left panel footer
- "Browse skills" link in active skills panel
- "Add MCP server" in MCP servers section
- First-time MCP unlock notification

**Modal Overlay (Not Full-Screen):**

```
┌───────────────────────────────────────────────────────────┐
│ Marketplace                    [Search...] [✕ Close]      │
├─────────────────┬─────────────────────────────────────────┤
│ Skills          │ Featured Skills                         │
│ ───────         │                                         │
│ MCP Servers     │ ┌─────────────┐ ┌─────────────┐       │
│ Workflows       │ │ rust-expert │ │code-reviewer│       │
│ Templates       │ │ ⭐⭐⭐⭐⭐     │ │ ⭐⭐⭐⭐☆     │       │
│                 │ │ 2.3K uses   │ │ 1.8K uses   │       │
│ Filters         │ │ [Install]   │ │ [Installed] │       │
│ ───────         │ └─────────────┘ └─────────────┘       │
│ ☐ Installed     │                                         │
│ ☐ Featured      │ Recently Updated                        │
│ ☐ Community     │ ┌─────────────┐ ┌─────────────┐       │
│                 │ │security-scan│ │test-gen     │       │
│ Categories      │ │ ⭐⭐⭐⭐⭐     │ │ ⭐⭐⭐⭐☆     │       │
│ ───────         │ │ 892 uses    │ │ 634 uses    │       │
│ ☐ Code Review   │ │ [Install]   │ │ [Preview]   │       │
│ ☐ Testing       │ └─────────────┘ └─────────────┘       │
│ ☐ Documentation │                                         │
│ ☐ Refactoring   │ Your Installed Skills (12)             │
│ ☐ Security      │ [View all →]                           │
│ ☐ Debugging     │                                         │
└─────────────────┴─────────────────────────────────────────┘
```

**Left Sidebar:**

- Tabs: Skills, MCP Servers, Workflows, Templates
- Filters: Installed, Featured, Community
- Categories (skill-specific)
- All filters combine (AND logic)

**Main Area:**

- Featured section (curated by maintainers)
- Recently Updated (activity-based)
- Your Installed (quick access to manage)
- Search results (when searching)

---

### Skill Detail View

**Click any skill card:**

```
┌───────────────────────────────────────────────────────────┐
│ ← Back to Marketplace                          [✕ Close]  │
├───────────────────────────────────────────────────────────┤
│ rust-expert                                   ⭐⭐⭐⭐⭐    │
│ Expert guidance for Rust development           2.3K uses  │
│                                                            │
│ Author: @rustacean  •  Updated: 3 days ago                │
│ Source: github.com/rustacean/rust-expert-skill            │
│ License: MIT  •  Version: 1.2.0                           │
│                                                            │
│ Description:                                               │
│ Provides expert-level Rust guidance including:            │
│ • Ownership and borrowing best practices                  │
│ • Async runtime patterns (Tokio, async-std)               │
│ • Error handling strategies (Result, anyhow, thiserror)   │
│ • Performance optimization techniques                     │
│ • Unsafe code review and safety guidelines                │
│                                                            │
│ Triggers: rust, cargo, borrow, lifetime, async, unsafe    │
│                                                            │
│ Dependencies: None                                         │
│ Bundled Resources: scripts/analyze.sh, references/        │
│                                                            │
│ ┌─── SKILL.md Preview ───────────────────────────┐       │
│ │ # Rust Expert                                   │       │
│ │                                                 │       │
│ │ When reviewing Rust code, focus on:            │       │
│ │ - Memory safety without sacrificing performance│       │
│ │ - Idiomatic use of the type system             │       │
│ │ - Proper error propagation (? operator)        │       │
│ │ - Effective use of traits and generics         │       │
│ │ ...                                             │       │
│ │                                                 │       │
│ │ [Scroll to see full content - 234 lines]       │       │
│ └─────────────────────────────────────────────────┘       │
│                                                            │
│ Reviews (47):                                              │
│ ⭐⭐⭐⭐⭐ "Essential for Rust projects" - @dev1 (2d ago)  │
│ ⭐⭐⭐⭐⭐ "Caught several memory issues" - @dev2 (5d ago) │
│ ⭐⭐⭐⭐☆ "Good but could use more examples" - @dev3     │
│ [Show all 47 reviews]                                      │
│                                                            │
│ [Install] [Preview in conversation] [Report issue]        │
└───────────────────────────────────────────────────────────┘
```

**Key Sections:**

- **Metadata:** Author, last update, source repo, license, version
- **Description:** What it does, when to use it
- **Triggers:** Keywords that should prompt loading this skill
- **Dependencies:** Other skills or tools required
- **Bundled Resources:** Scripts, reference docs included
- **SKILL.md Preview:** Scrollable view of full manifest
- **Reviews:** Community feedback with ratings

---

### Installation Flow

**Click "Install":**

1. **Progress indicator:**

   ```
   ┌─────────────────────────────────────────┐
   │ Installing rust-expert...                │
   │ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 40%               │
   │ Cloning from GitHub...                   │
   └─────────────────────────────────────────┘
   ```

2. **Installation steps:**
   - Clone git repo (if source is GitHub) OR download tarball
   - Install to personal skills directory (`~/.config/app/skills/rust-expert/`)
   - Filesystem watcher picks it up automatically
   - Parse SKILL.md and insert into DB

3. **Success notification (Sonner toast):**

   ```
   ┌─────────────────────────────────────────┐
   │ ✓ rust-expert installed                 │
   │ Load it in your next conversation        │
   │ [Load now] [Dismiss]                    │
   └─────────────────────────────────────────┘
   ```

4. **Skill now appears:**
   - In "Installed" filter of marketplace
   - In skill picker (⌘/ or @ mention)
   - In skill source directories list

---

### Preview in Conversation

**Click "Preview in conversation":**

- Creates temporary conversation
- Loads the skill automatically
- Pre-filled user prompt: "Show me what you can do with this skill"
- User can experiment before committing to install
- Conversation is ephemeral (marked `is_preview: true`)
- Installing the skill converts preview conversation to permanent

---

### MCP Servers Tab

**Similar layout, shows MCP servers instead of skills:**

```
┌───────────────────────────────────────────────────────────┐
│ MCP Servers                                                │
├───────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│ │filesystem   │ │brave-search │ │postgres     │         │
│ │stdio        │ │SSE          │ │stdio        │         │
│ │12 tools     │ │3 tools      │ │8 tools      │         │
│ │[Connect]    │ │[Installed]  │ │[Configure]  │         │
│ └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                            │
│ [Filter: All | stdio | SSE]                               │
└───────────────────────────────────────────────────────────┘
```

**Each card shows:**

- Server name
- Transport type (stdio, SSE)
- Tool count
- Connection status / action button

**Click card → Detail view:**

- Description
- Available tools list (with descriptions)
- Configuration requirements (e.g., "Requires API key" or "Requires PostgreSQL connection string")
- Reviews/ratings

**Click "Connect":**

- If needs config → opens form:
  ```
  ┌─────────────────────────────────────────┐
  │ Configure brave-search                   │
  ├─────────────────────────────────────────┤
  │ API Key: [_____________________]        │
  │ [Get API key from brave.com]            │
  │                                          │
  │ [Test Connection] [Save]                │
  └─────────────────────────────────────────┘
  ```
- If no config needed (e.g., stdio server on localhost) → connects immediately

---

### Workflows Tab (After Unlock)

**Shows community workflow templates:**

```
┌───────────────────────────────────────────────────────────┐
│ Workflow Templates                                         │
├───────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐               │
│ │ Comprehensive Code Review                │               │
│ │ Sequential → Parallel → Eval-Opt        │               │
│ │                                          │               │
│ │ Avg Cost: $0.23  •  Success Rate: 94%   │               │
│ │ 342 uses  •  ⭐⭐⭐⭐⭐                 │               │
│ │                                          │               │
│ │ [Preview DAG] [Install] [Use now]       │               │
│ └─────────────────────────────────────────┘               │
│                                                            │
│ ┌─────────────────────────────────────────┐               │
│ │ Parallel Documentation Generator         │               │
│ │ Parallel (3 agents)                      │               │
│ │                                          │               │
│ │ Avg Cost: $0.18  •  Success Rate: 88%   │               │
│ │ 213 uses  •  ⭐⭐⭐⭐☆                  │               │
│ │                                          │               │
│ │ [Preview DAG] [Install] [Use now]       │               │
│ └─────────────────────────────────────────┘               │
└───────────────────────────────────────────────────────────┘
```

**Template metadata:**

- Workflow pattern type
- Estimated cost (from historical data)
- Success rate (quality threshold met %)
- Usage count
- Community ratings

**Click "Preview DAG":**

- Shows static visualization of workflow structure
- Explains what each step does
- Lists skills required

**Click "Install":**

- Downloads template as a skill
- Can be customized/edited after install

**Click "Use now":**

- Starts a conversation with this workflow pre-configured
- User provides initial prompt, workflow executes

---

## 11. Settings & Configuration

### Settings Overlay (⌘,)

Modal overlay with tabbed navigation.

---

### Tab Structure

```
┌───────────────────────────────────────────────────────────┐
│ Settings                                       [✕ Close]   │
├─────────────┬─────────────────────────────────────────────┤
│ API Keys    │ [Active tab content shown on right]         │
│ Profiles    │                                             │
│ Workspaces  │                                             │
│ Skills      │                                             │
│ MCP Servers │                                             │
│ Tool Approvals                                            │
│ Appearance  │                                             │
│ Advanced    │                                             │
└─────────────┴─────────────────────────────────────────────┘
```

---

### 1. API Keys Tab

```
┌─────────────────────────────────────────┐
│ API Keys                                 │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Anthropic                           │ │
│ │ API Key: sk-ant-******************* │ │
│ │ Status: ✓ Connected                 │ │
│ │ [Test Connection] [Update Key]      │ │
│ │ [Reveal Key]                         │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ OpenAI                              │ │
│ │ API Key: Not configured             │ │
│ │ Status: ⚠ Not connected            │ │
│ │ [Add API Key]                       │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Google                              │ │
│ │ API Key: Not configured             │ │
│ │ Status: ⚠ Not connected            │ │
│ │ [Add API Key]                       │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ Ollama (Local)                      │ │
│ │ Base URL: http://localhost:11434   │ │
│ │ Status: ✓ Connected (3 models)     │ │
│ │ [Configure]                         │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Features:**

- Masked keys (click "Reveal" to show)
- Test connection button (fires test completion, shows result)
- Status indicators: ✓ (connected), ⚠ (not configured), ✗ (error)
- Keys stored in OS keychain (never in DB or config files)

---

### 2. Profiles Tab

```
┌─────────────────────────────────────────┐
│ Profiles                   [New Profile] │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ 🟦 Default Profile                  │ │
│ │ claude-sonnet-4-6  •  5 skills     │ │
│ │ [Edit] [Duplicate] [Delete]        │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ 🟢 Code Review                      │ │
│ │ claude-opus-4-6  •  3 skills       │ │
│ │ [Edit] [Duplicate] [Delete]        │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ 🟡 Quick Prototyping                │ │
│ │ claude-haiku-4-5  •  2 skills      │ │
│ │ [Edit] [Duplicate] [Delete]        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Click "Edit" → Full profile editor:**

```
┌───────────────────────────────────────────────────────────┐
│ Edit Profile: Default Profile                  [✕ Close]  │
├───────────────────────────────────────────────────────────┤
│ Name: [Default Profile_______________]                    │
│                                                            │
│ Icon & Color:                                              │
│ [🔵🟢🟡🟠🔴] [Color picker]                              │
│                                                            │
│ Model:                                                     │
│ Provider: [Anthropic ▾]                                   │
│ Model: [claude-sonnet-4-6 ▾]                             │
│                                                            │
│ Model Parameters:                                          │
│ Temperature: [0.7__] (0.0 - 1.0)                          │
│ Max Tokens: [4096__]                                      │
│ Top P: [0.9__] (0.0 - 1.0)                                │
│                                                            │
│ Skills (5):                              [Add skill ▾]    │
│ [≡] rust-expert                          [Remove]         │
│ [≡] code-reviewer                        [Remove]         │
│ [≡] test-generator                       [Remove]         │
│ [≡] security-checker                     [Remove]         │
│ [≡] doc-writer                           [Remove]         │
│ ↑ Drag to reorder                                         │
│                                                            │
│ MCP Servers (3):                         [Add server ▾]   │
│ [≡] filesystem                           [Remove]         │
│ [≡] brave-search                         [Remove]         │
│ [≡] postgres                             [Remove]         │
│ ↑ Drag to reorder                                         │
│                                                            │
│ System Prompt Override:                                    │
│ ┌────────────────────────────────────────┐                │
│ │ You are an expert Rust developer...   │                │
│ │                                        │                │
│ │ Variables available:                   │                │
│ │ {{workspace.name}}                     │                │
│ │ {{readme}}                             │                │
│ │ {{claude.md}}                          │                │
│ │                                        │                │
│ │ [Syntax highlighting for TOON/vars]    │                │
│ └────────────────────────────────────────┘                │
│                                                            │
│ Workflow Defaults (Power User feature):                   │
│ Max parallel agents: [10_]                                │
│ Max eval-opt iterations: [3_]                             │
│ Quality threshold: [0.85_] (0.0-1.0)                      │
│                                                            │
│ [Save] [Cancel]                                            │
└───────────────────────────────────────────────────────────┘
```

**Profile editor features:**

- Name, icon, color customization
- Model selection with parameters
- Reorderable skills list (drag handles)
- Reorderable MCP servers list
- System prompt override with variable support
- Workflow defaults (after power user unlock)

---

### 3. Workspaces Tab

```
┌─────────────────────────────────────────┐
│ Workspaces                               │
│                                          │
│ Recent Workspaces:                       │
│ → 📁 my-rust-project  (2h ago)          │
│    /Users/dev/projects/rust-project     │
│    [Open] [Remove from recent]          │
│                                          │
│ → 📁 web-dashboard    (yesterday)       │
│    /Users/dev/projects/dashboard        │
│    [Open] [Remove from recent]          │
│                                          │
│ → 📁 cli-tool         (3 days ago)      │
│    /Users/dev/projects/cli              │
│    [Open] [Remove from recent]          │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Default Workspace Settings:              │
│                                          │
│ ☑ Auto-inject CLAUDE.md                │
│ ☑ Auto-inject README.md (first 500)    │
│ ☑ Respect .gitignore                    │
│ ☑ Respect .claudeignore                 │
│                                          │
│ File access sandboxing:                  │
│ ● Strict (workspace root only)          │
│ ○ Relaxed (ask for permission)          │
│ ○ Disabled (allow all paths)            │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Workspace-Specific Overrides:            │
│                                          │
│ my-rust-project:                         │
│ • Inject README: First 1000 chars       │
│ • Additional context: Cargo.toml        │
│ [Edit overrides]                         │
│                                          │
│ web-dashboard:                           │
│ • No overrides (using defaults)         │
│                                          │
│ [Open Workspace...]                      │
└─────────────────────────────────────────┘
```

---

### 4. Skills Tab

```
┌─────────────────────────────────────────┐
│ Skills                                   │
│                                          │
│ Skill Source Directories:                │
│ ↑ Drag to change priority                │
│                                          │
│ [≡] 1. Workspace Project                │
│     ./.skills/                           │
│     Watch: ☑  •  Last scan: 2h ago      │
│     12 skills found                      │
│     [Configure]                          │
│                                          │
│ [≡] 2. Personal                          │
│     ~/.config/app/skills/               │
│     Watch: ☑  •  Last scan: 2h ago      │
│     34 skills found                      │
│     [Configure]                          │
│                                          │
│ [≡] 3. Superpowers                       │
│     ~/.claude/skills/                   │
│     Watch: ☑  •  Last scan: 3h ago      │
│     18 skills found                      │
│     [Configure]                          │
│                                          │
│ [≡] 4. Marketplace                       │
│     ~/Library/Application Support/...   │
│     Watch: ☑  •  Last scan: 2h ago      │
│     56 skills found                      │
│     [Configure]                          │
│                                          │
│ [Add directory...] [Rescan all]          │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Global Settings:                         │
│                                          │
│ ☑ Enable filesystem watcher             │
│ Scan interval: [Instant ▾]              │
│   (Instant | 5s | 30s | Manual)         │
│                                          │
│ ☑ Show shadowing warnings               │
│ ☑ Auto-load skill updates               │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ [Browse Marketplace]                     │
└─────────────────────────────────────────┘
```

---

### 5. MCP Servers Tab

```
┌─────────────────────────────────────────┐
│ MCP Servers                              │
│                                          │
│ Installed Servers:                       │
│                                          │
│ ✓ filesystem (stdio)                    │
│   12 tools  •  Last connected: 2h ago   │
│   [Configure] [Disconnect]              │
│                                          │
│ ✓ brave-search (SSE)                    │
│   3 tools  •  Last connected: 1h ago    │
│   [Configure] [Disconnect]              │
│                                          │
│ ⚠ postgres (stdio)                      │
│   Connection failed: Authentication     │
│   [Reconfigure] [Remove]                │
│                                          │
│ [Add server...] [Browse marketplace]    │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Global Settings:                         │
│                                          │
│ Auto-connect on startup: ☑              │
│ Show connection notifications: ☑         │
│                                          │
│ Tool approval defaults:                  │
│ • Read-only tools: Auto-approve         │
│ • Write tools: Require approval         │
│ • Destructive tools: Always confirm     │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Registry Configuration:                  │
│                                          │
│ Registry URL:                            │
│ [https://registry.mcp.io______________] │
│ ☑ Use official registry                │
│ ☐ Use custom registry                   │
│                                          │
│ [Test connection]                        │
└─────────────────────────────────────────┘
```

---

### 6. Tool Approvals Tab

_(See Section 8 for full details)_

```
┌─────────────────────────────────────────┐
│ Tool Approval Settings                   │
│                                          │
│ Global Defaults:                         │
│ ☑ Auto-approve read-only operations     │
│ ☑ Require approval for write operations │
│ ☑ Always confirm destructive operations │
│                                          │
│ Per-Workspace Overrides:                 │
│ ...                                      │
│                                          │
│ Approval History:                        │
│ ...                                      │
└─────────────────────────────────────────┘
```

---

### 7. Appearance Tab

```
┌─────────────────────────────────────────┐
│ Appearance                               │
│                                          │
│ Theme:                                   │
│ ● Light                                  │
│ ○ Dark                                   │
│ ○ System (auto-switch)                  │
│                                          │
│ Font Size:                               │
│ ○ Small                                  │
│ ● Medium                                 │
│ ○ Large                                  │
│                                          │
│ Panel Density:                           │
│ ○ Compact                                │
│ ● Comfortable                            │
│ ○ Spacious                               │
│                                          │
│ UI Elements:                             │
│ ☑ Show feature unlock notifications     │
│ ☑ Enable animations                     │
│ ☑ Show token counters in real-time     │
│ ☐ Compact subagent cards (default)      │
│                                          │
│ Syntax Highlighting Theme:               │
│ [GitHub Light ▾]                        │
│                                          │
│ Custom CSS (Advanced):                   │
│ ┌────────────────────────────────────┐  │
│ │ /* Your custom CSS here */         │  │
│ │                                    │  │
│ └────────────────────────────────────┘  │
│                                          │
│ [Reset to defaults]                      │
└─────────────────────────────────────────┘
```

---

### 8. Advanced Tab

```
┌─────────────────────────────────────────┐
│ Advanced Settings                        │
│                                          │
│ Feature Unlocking:                       │
│ ☐ Show all features (bypass progressive │
│    unlock)                               │
│                                          │
│ Debug & Logging:                         │
│ ☐ Debug mode (verbose logging)          │
│ ☐ Log to file                            │
│   Log location: ~/.local/share/...      │
│   [Open log folder]                      │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Data Management:                         │
│                                          │
│ Database:                                │
│ Location: ~/.local/share/skilldeck.db   │
│ Size: 42.3 MB                           │
│ [Open in file manager]                   │
│                                          │
│ [Export all data]                        │
│ [Import/Restore from backup]             │
│ [Vacuum database]                        │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Danger Zone:                             │
│                                          │
│ [Reset all settings to defaults]        │
│   (Profiles, workspaces, preferences)   │
│                                          │
│ [Delete all data and start fresh]       │
│   (Creates backup first)                 │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ About:                                   │
│ Version: 1.0.0                           │
│ [Check for updates]                      │
│ [Release notes]                          │
│ [Send feedback]                          │
└─────────────────────────────────────────┘
```

---

## 12. Error Handling & Recovery

### Error Display Philosophy

**Principles:**

- Show errors inline where they occur
- Provide clear recovery paths
- Never lose user work
- Keep technical details collapsible

---

### Inline Error Display (Conversation Stream)

**For agent errors:**

```
┌─────────────────────────────────────────┐
│ ❌ Agent Error                          │
├─────────────────────────────────────────┤
│ Failed to complete request              │
│                                          │
│ Error: Rate limit exceeded (429)        │
│ Provider: Anthropic API                 │
│                                          │
│ The request will retry automatically in │
│ 30 seconds, or you can:                 │
│                                          │
│ [Retry now] [Switch to Opus] [Cancel]  │
│                                          │
│ ▸ Show technical details                │
└─────────────────────────────────────────┘
```

**Expandable details:**

```
Request ID: req_abc123
Timestamp: 2026-03-10 14:23:11 UTC
Model: claude-sonnet-4-6
Tokens used before error: 2,341

Full error response:
{
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded. Try again in 30s"
  }
}

[Copy error details] [Report issue]
```

---

### Error Categories & Recovery Strategies

#### **1. API Errors (Rate Limits, Auth Failures)**

**Auto-retry with exponential backoff:**

- 1st retry: 5s delay
- 2nd retry: 15s delay
- 3rd retry: 45s delay
- After 3 failures: surface to user

**Recovery options:**

- **Retry now** — Attempt immediately (bypasses backoff)
- **Switch model** — Offer alternative (e.g., Sonnet → Haiku)
- **Cancel** — Stop agent loop, preserve conversation state

**Rate limit specific:**

- Show estimated retry time from API headers
- Option to queue request and continue later

---

#### **2. Tool Call Failures**

**Non-fatal errors** — Agent loop continues:

```
┌─────────────────────────────────────────┐
│ ⚠️  Tool Call Failed                    │
├─────────────────────────────────────────┤
│ Tool: read_file                          │
│ Path: src/nonexistent.rs                │
│                                          │
│ Error: File not found                    │
│                                          │
│ The agent will see this error and can   │
│ try a different approach.                │
│                                          │
│ [Retry tool call] [Show details]        │
└─────────────────────────────────────────┘
```

**Error injected as tool result:**

```json
{
  "status": "error",
  "error": "File not found: src/nonexistent.rs",
  "suggestion": "Check file path or list directory contents"
}
```

Agent sees error in TOON format and can adapt (e.g., list directory first).

---

#### **3. Workflow Step Failures**

**Fallback strategies dialog:**

```
┌─────────────────────────────────────────┐
│ Workflow Step Failed                     │
├─────────────────────────────────────────┤
│ Step: Security Review                    │
│ Error: Evaluator skill crashed          │
│                                          │
│ Completed steps: 2/5                     │
│ Partial results available                │
│                                          │
│ Choose recovery strategy:                │
│                                          │
│ ○ Use partial results (skip this step)  │
│ ○ Retry with different skill            │
│   Suggested: alternative-security-check  │
│ ○ Retry with same config                │
│ ○ Stop workflow (save progress)         │
│                                          │
│ [Continue] [Cancel]                      │
└─────────────────────────────────────────┘
```

**Failed step shown in DAG:**

- Red border
- Error icon (✗)
- Hover shows full error message
- Clickable to retry or skip

**Checkpoint & Resume:**

- All completed steps preserved in DB
- Can resume from last successful step
- Workflow state diagram shows progress

---

#### **4. Evaluator-Optimizer Quality Threshold Not Met**

**Max iterations reached without passing:**

```
┌─────────────────────────────────────────┐
│ Quality Threshold Not Reached            │
├─────────────────────────────────────────┤
│ Generator: api-doc-writer                │
│ Evaluator: doc-quality-checker           │
│                                          │
│ Iterations: 3/3 (max reached)            │
│ Best score: 0.78 (threshold: 0.85)       │
│                                          │
│ Feedback from last iteration:            │
│ "Still missing examples for error cases" │
│                                          │
│ Choose next step:                        │
│                                          │
│ ○ Use best attempt (0.78 quality)       │
│ ○ Try different evaluator skill         │
│   Suggested: comprehensive-doc-checker   │
│ ○ Increase max iterations to 5          │
│ ○ Lower threshold to 0.75               │
│ ○ Stop workflow                          │
│                                          │
│ [Continue] [Cancel]                      │
└─────────────────────────────────────────┘
```

**User has full agency** — Choose to proceed with imperfect result or adjust workflow.

---

#### **5. MCP Server Connection Failures**

**Auto-reconnect attempts:**

- 3 retry attempts with 5s intervals
- Toast notification: "Reconnecting to filesystem server..."

**If all retries fail:**

**Toast notification:**

```
┌─────────────────────────────────────────┐
│ ⚠️  Lost connection to filesystem       │
│ [Reconnect] [Configure] [Dismiss]       │
└─────────────────────────────────────────┘
```

**Active conversations affected:**

```
┌─────────────────────────────────────────┐
│ ⚠️  MCP Server Disconnected             │
├─────────────────────────────────────────┤
│ The filesystem server is not responding.│
│ File operations are temporarily         │
│ unavailable.                             │
│                                          │
│ [Try reconnect] [Continue without]      │
└─────────────────────────────────────────┘
```

**In MCP servers list (Settings):**

- Server shows red ✗ indicator
- "Reconnect" button available
- Can view connection logs for debugging

---

#### **6. Database Errors**

**Critical errors (corruption, I/O failure):**

```
┌─────────────────────────────────────────┐
│ 🛑 Critical Database Error              │
├─────────────────────────────────────────┤
│ The application database is experiencing │
│ issues and cannot continue safely.       │
│                                          │
│ Error: database disk image is malformed  │
│                                          │
│ Recommended actions:                     │
│ 1. Export your data now                 │
│ 2. Close the application                │
│ 3. Restore from a recent backup         │
│                                          │
│ [Export data] [View backups] [Close]    │
│                                          │
│ ▸ Show technical details                │
└─────────────────────────────────────────┘
```

**Non-critical (sync failures):**

Toast notification: "Sync failed. Continue in local-only mode."

---

#### **7. File System Errors (Workspace, Skills)**

**Workspace access denied:**

```
┌─────────────────────────────────────────┐
│ ⚠️  Cannot Access Workspace             │
├─────────────────────────────────────────┤
│ Path: /Users/dev/projects/my-project    │
│                                          │
│ Error: Permission denied                 │
│                                          │
│ This workspace requires file access     │
│ permission. Grant access in:             │
│ System Preferences → Security & Privacy  │
│ → Files and Folders → SkillDeck         │
│                                          │
│ [Open System Preferences] [Try again]   │
│ [Choose different workspace]             │
└─────────────────────────────────────────┘
```

**Skill not found:**

```
┌─────────────────────────────────────────┐
│ ⚠️  Skill Not Found                     │
├─────────────────────────────────────────┤
│ Skill: rust-expert                       │
│ Expected path: ~/.config/app/skills/... │
│                                          │
│ The skill file was deleted or moved.     │
│                                          │
│ [Reinstall from marketplace]             │
│ [Remove from profile]                    │
│ [Choose different skill]                 │
└─────────────────────────────────────────┘
```

**Graceful degradation:**

- Missing skill → Conversation continues without it (warning shown)
- Inaccessible workspace → Conversation becomes "scratch" mode

---

### Network Offline Handling

**When network unavailable:**

**Toast notification:**

```
┌─────────────────────────────────────────┐
│ 📡 You're offline                       │
│                                          │
│ Cloud models unavailable. Switch to     │
│ Ollama for local models?                │
│                                          │
│ [Switch to Ollama] [Dismiss]            │
└─────────────────────────────────────────┘
```

**Profile switcher:**

- Cloud model profiles grayed out
- Ollama profiles remain active
- Indicator: "⚠️ Offline mode" in header

**Queue operations for later:**

- Sync operations queued (if sync ever implemented)
- Marketplace access disabled (show cached content only)

---

## 13. Keyboard Shortcuts & Power User Features

### Global Shortcuts (Customizable)

All shortcuts work from anywhere in the app.

---

### Conversation Management

| Shortcut | Action                                     |
| -------- | ------------------------------------------ |
| `⌘N`     | New conversation                           |
| `⌘W`     | Close workspace (if open) / Close window   |
| `⌘P`     | Quick conversation switcher (fuzzy search) |
| `⌘⇧P`    | Profile switcher                           |
| `⌘O`     | Open workspace dialog                      |
| `⌘[`     | Navigate conversation history (back)       |
| `⌘]`     | Navigate conversation history (forward)    |

---

### Navigation

| Shortcut | Action                               |
| -------- | ------------------------------------ |
| `⌘1`     | Focus left panel (conversations)     |
| `⌘2`     | Focus center panel (conversation)    |
| `⌘3`     | Focus right panel (context/workflow) |
| `⌘K`     | Command palette                      |
| `⌘,`     | Settings                             |
| `⌘⇧M`    | Marketplace                          |
| `⌘⇧F`    | Semantic search                      |

---

### Conversation Actions

| Shortcut  | Action                          |
| --------- | ------------------------------- |
| `⌘Enter`  | Send message                    |
| `⌘⇧Enter` | Send to new branch              |
| `⌘/`      | Load skill (opens skill picker) |
| `Esc`     | Cancel current agent response   |
| `⌘E`      | Export conversation             |
| `⌘D`      | Duplicate conversation          |

---

### Branch Navigation

| Shortcut | Action               |
| -------- | -------------------- |
| `⌘←`     | Previous branch      |
| `⌘→`     | Next branch          |
| `⌘⇧C`    | Compare all branches |

---

### Panel Management

| Shortcut | Action                        |
| -------- | ----------------------------- |
| `⌘B`     | Toggle left panel             |
| `⌘⇧B`    | Toggle right panel            |
| `⌘\`     | Reset panel sizes to defaults |

---

### Text Editing (Input Area)

| Shortcut | Action                                          |
| -------- | ----------------------------------------------- |
| `⌘Z`     | Undo                                            |
| `⌘⇧Z`    | Redo                                            |
| `⌘A`     | Select all                                      |
| `@`      | Trigger mention picker (skills, files, prompts) |

---

### Command Palette Extensions

**Skill-registered commands:**

Skills can add custom commands via frontmatter:

```yaml
---
name: deploy-manager
description: Deployment automation skill
commands:
  - name: "Deploy to staging"
    shortcut: "⌘⇧D S"
    action: trigger_deploy
    args: { env: staging }
  - name: "Deploy to production"
    shortcut: "⌘⇧D P"
    action: trigger_deploy
    args: { env: production }
  - name: "Rollback last deployment"
    action: rollback_deployment
---
```

**How it works:**

- Skill registers commands at load time
- Commands appear in ⌘K palette under "Custom Commands" section
- Users can assign keyboard shortcuts in Settings → Keyboard
- Invoking command calls skill's registered action handler

**Example use cases:**

- Deployment skills (deploy, rollback, check status)
- Git skills (commit, push, create PR)
- Testing skills (run tests, check coverage)
- Build skills (build, clean, format)

---

### Quick Actions Menu (Right-Click)

**On messages:**

- Copy message
- Edit message (creates new branch)
- Bookmark message
- Copy as markdown
- Regenerate response
- Continue from here (in new conversation)
- Delete message

**On subagent cards:**

- Copy output
- Fork to new conversation
- Re-run with different config
- Export as skill template
- Stop subagent (if running)

**On skills (in active skills panel):**

- View SKILL.md
- Unload from conversation
- Open in file manager
- Check for updates
- Report issue
- Pin to favorites

**On conversation items (left panel):**

- Open in new window
- Duplicate
- Move to folder
- Export
- Delete
- Pin/Unpin

---

### Customizable Shortcuts

**Settings → Keyboard:**

```
┌───────────────────────────────────────────────────────────┐
│ Keyboard Shortcuts                                         │
├───────────────────────────────────────────────────────────┤
│ Search: [_____________]                                   │
│                                                            │
│ Conversation                                               │
│ New conversation               ⌘N            [Edit]       │
│ Send message                   ⌘Enter        [Edit]       │
│ Quick switcher                 ⌘P            [Edit]       │
│                                                            │
│ Navigation                                                 │
│ Command palette                ⌘K            [Edit]       │
│ Focus left panel               ⌘1            [Edit]       │
│ Focus center panel             ⌘2            [Edit]       │
│ Focus right panel              ⌘3            [Edit]       │
│                                                            │
│ Custom Commands (from skills)                              │
│ Deploy to staging              ⌘⇧D S         [Edit]       │
│ Deploy to production           ⌘⇧D P         [Edit]       │
│                                                            │
│ [Reset to defaults] [Export config] [Import config]       │
└───────────────────────────────────────────────────────────┘
```

**Features:**

- Search/filter shortcuts
- Click "Edit" to record new shortcut
- Conflict detection (warns if shortcut already used)
- Reset to defaults per section or globally
- Export/import for sharing configs across machines

---

### Vim Mode (Advanced)

**Settings → Advanced → Vim Mode:**

```
☐ Enable Vim keybindings in text input
  (jk to exit insert mode, dd to delete line, etc.)
```

**If enabled:**

- Input area supports Vim normal/insert/visual modes
- Standard Vim motions (hjkl, w, b, 0, $, etc.)
- Vim commands (dd, yy, p, u, Ctrl+R, etc.)
- Does not affect other shortcuts (⌘K still works)

---

## 14. Data Management & Export

### Local-First Storage

**Philosophy:** Your data, your machine, your control. No cloud, no sync, no dependencies.

---

### Database Details

**All data stored in local SQLite:**

- **Location:** `~/.local/share/skilldeck/skilldeck.db` (or platform equivalent)
- **Managed by:** SeaORM
- **Migrations:** Automatic on app start (versioned schema)
- **Backup-friendly:** Single file, easy to copy

**Platform-specific paths:**

- **macOS:** `~/Library/Application Support/com.skilldeck.app/skilldeck.db`
- **Linux:** `~/.local/share/skilldeck/skilldeck.db`
- **Windows:** `C:\Users\<user>\AppData\Local\skilldeck\skilldeck.db`

---

### Export & Backup UI

**Settings → Advanced → Data Management:**

```
┌─────────────────────────────────────────┐
│ Data Management                          │
├─────────────────────────────────────────┤
│ Database Location:                       │
│ ~/.local/share/skilldeck/skilldeck.db   │
│ Size: 42.3 MB                           │
│ Last modified: 2 hours ago              │
│                                          │
│ [Open in file manager]                   │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Export & Backup:                         │
│                                          │
│ [Export single conversation]            │
│   → Markdown or JSON file               │
│                                          │
│ [Export all data]                        │
│   → ZIP containing:                      │
│     • Database file (skilldeck.db)      │
│     • All attachments                    │
│     • All artifacts                      │
│     • Settings & preferences             │
│                                          │
│ [Create backup]                          │
│   → Timestamped ZIP backup               │
│   → Saved to: ~/Documents/SkillDeck/    │
│     Backups/                             │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Import & Restore:                        │
│                                          │
│ [Import conversation]                    │
│   → From .md or .json file              │
│                                          │
│ [Restore from backup]                    │
│   → Upload ZIP backup                    │
│   → Choose: Merge or Replace            │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Cleanup:                                 │
│                                          │
│ [Delete old conversations]               │
│   → Bulk delete by date range           │
│                                          │
│ [Clear cached data]                      │
│   → Model pricing cache, embeddings     │
│                                          │
│ [Vacuum database]                        │
│   → Reclaim unused space                │
│                                          │
│ ─────────────────────────────────────   │
│                                          │
│ Danger Zone:                             │
│ [Reset all settings to defaults]        │
│ [Delete all data and start fresh]       │
│   (Creates backup first)                 │
└─────────────────────────────────────────┘
```

---

### Export Single Conversation

**Click "Export single conversation":**

```
┌─────────────────────────────────────────┐
│ Export Conversation                      │
├─────────────────────────────────────────┤
│ Conversation: Refactor auth system      │
│                                          │
│ Format:                                  │
│ ○ Markdown (.md)                        │
│   • Human-readable                       │
│   • Includes messages, code blocks      │
│   • Loses: workflow metadata, tool calls│
│                                          │
│ ● JSON (.json)                          │
│   • Machine-readable                     │
│   • Full fidelity (all metadata)        │
│   • Re-importable                        │
│                                          │
│ Include:                                 │
│ ☑ Messages                              │
│ ☑ Tool calls and results               │
│ ☑ Subagent outputs                      │
│ ☑ Workflow data                         │
│ ☑ Attachments (embedded)                │
│                                          │
│ [Export] [Cancel]                        │
└─────────────────────────────────────────┘
```

**Markdown export format:**

````markdown
# Refactor auth system

**Profile:** Default Profile  
**Model:** claude-sonnet-4-6  
**Created:** 2026-03-10 14:23 UTC  
**Tokens:** 12,431  
**Cost:** $0.047

---

## User

Can you help me refactor the authentication system?

## Assistant

I'll help you refactor the authentication system. Let me first...

### Tool Call: read_file

```json
{
  "path": "src/auth.rs"
}
```
````

### Tool Result

```
[file content]
```

...

```

**JSON export includes:**
- Full conversation tree (all branches)
- Complete message metadata
- Tool calls with full args/results
- Subagent session data
- Workflow execution graph
- Attachments as base64 (optional)

---

### Export All Data

**Click "Export all data":**

Creates ZIP file:
```

skilldeck-export-2026-03-10.zip
├── skilldeck.db (full database)
├── attachments/
│ ├── abc123.pdf
│ ├── def456.png
│ └── ...
├── artifacts/
│ ├── art_001.tsx
│ ├── art_002.md
│ └── ...
├── settings.json (profiles, preferences)
└── manifest.json (export metadata)

```

**Manifest includes:**
- Export timestamp
- App version
- Database schema version
- File count
- Total size

---

### Automatic Backups

**Background backup system:**

**Schedule:**
- Creates daily backup if app was used that day
- Runs on app close (graceful shutdown)
- Timestamp: `skilldeck-backup-2026-03-10-14-23.zip`

**Retention:**
- Keeps last 7 daily backups automatically
- Older backups deleted automatically
- User can manually create additional backups anytime

**Backup location:**
- `~/Documents/SkillDeck/Backups/` (user-accessible)
- Configurable in Settings

**Backup contents:**
- Database snapshot
- All attachments
- All artifacts
- Settings JSON

**Notification:**
```

┌─────────────────────────────────────────┐
│ ✓ Daily backup created │
│ skilldeck-backup-2026-03-10.zip │
│ [View backups folder] │
└─────────────────────────────────────────┘

```

---

### Import & Restore

**Import conversation (from .md or .json):**

```

┌─────────────────────────────────────────┐
│ Import Conversation │
├─────────────────────────────────────────┤
│ File: refactor-auth.json │
│ │
│ Preview: │
│ Title: Refactor auth system │
│ Messages: 24 │
│ Created: 2026-03-08 │
│ Tokens: 12,431 │
│ │
│ This conversation will be added to your │
│ conversations list. │
│ │
│ [Import] [Cancel] │
└─────────────────────────────────────────┘

```

**Restore from backup (full data restore):**

```

┌─────────────────────────────────────────┐
│ Restore from Backup │
├─────────────────────────────────────────┤
│ Backup: skilldeck-backup-2026-03-08.zip │
│ │
│ Contents: │
│ • Database: 38.2 MB │
│ • Conversations: 156 │
│ • Attachments: 23 files (4.1 MB) │
│ • Settings: 1 profile │
│ │
│ Restore mode: │
│ ○ Merge with existing data │
│ (keeps both, resolves conflicts) │
│ │
│ ● Replace all data │
│ (deletes current data, uses backup) │
│ ⚠️ Current data will be backed up │
│ before replacement │
│ │
│ [Restore] [Cancel] │
└─────────────────────────────────────────┘

```

**Merge strategy (if selected):**
- Conversations: Keep both, different IDs
- Profiles: Merge, rename conflicts (e.g., "Default Profile (2)")
- Settings: Prefer backup values, prompt on conflicts

**Replace strategy:**
- Creates safety backup first: `skilldeck-pre-restore-backup.zip`
- Deletes current database
- Restores backup database
- No merge, clean slate

---

### Cross-Device Usage (Manual)

**If user wants data on multiple machines:**

**Method 1: Export/Import**
1. Machine A: Export all data → `skilldeck-export.zip`
2. Transfer ZIP to Machine B (USB, email, cloud, etc.)
3. Machine B: Import/restore from ZIP
4. Manual sync, user controls timing

**Method 2: Database File Sync (Unsupported but possible)**
- Database is just a SQLite file
- Users can manually sync via:
  - Dropbox/Google Drive (app symlink to synced folder)
  - Git (commit database file)
  - rsync / Syncthing
- **Warning shown in docs:** Not officially supported, may cause corruption if both apps open simultaneously
- **SQLite locking:** Handles concurrent read, but not concurrent write
- **Recommendation:** Close app on one machine before opening on another

---

### Cleanup Tools

**Delete old conversations:**

```

┌─────────────────────────────────────────┐
│ Delete Old Conversations │
├─────────────────────────────────────────┤
│ Delete conversations: │
│ ● Older than 90 days │
│ ○ Older than 180 days │
│ ○ Older than 1 year │
│ ○ Custom date range │
│ │
│ Exclude: │
│ ☑ Pinned conversations │
│ ☑ Conversations in folders │
│ │
│ Preview: │
│ 23 conversations will be deleted │
│ Total size: 3.4 MB │
│ │
│ ⚠️ This cannot be undone. │
│ Create backup first? │
│ [Create backup] [Skip backup] │
│ │
│ [Delete] [Cancel] │
└─────────────────────────────────────────┘

```

**Clear cached data:**
- Model pricing cache (re-fetched from API)
- Message embeddings (regenerated on demand)
- Skill metadata cache (rescanned from disk)
- MCP tool schemas (re-fetched on reconnect)

**Vacuum database:**
- Reclaims space from deleted records
- Optimizes database file
- Shows before/after size:
```

Before: 42.3 MB
After: 38.1 MB
Saved: 4.2 MB

````

---

## 15. Performance & Optimization

### UI Performance Strategies

#### **Virtualization**

**@tanstack/react-virtual for long lists:**
- **Conversation list** (left panel): Renders only visible ~50 items, scrolls smoothly with 10,000+ conversations
- **Message stream** (center panel): Virtualizes long conversations (1,000+ messages)
- **Skill marketplace**: Handles unlimited skill cards without lag
- **Tool call list** (workflow DAG details): Virtualizes 100+ tool calls

**Benefits:**
- Constant memory usage regardless of list size
- 60fps scrolling
- Instant initial render

---

#### **Lazy Loading**

**Load on demand:**
- **Right panel tabs:** Content loaded only when tab first viewed
- **Workflow DAG:** Renders only when workflow starts (not pre-rendered)
- **Message attachments:** Load when scrolled into viewport
- **Skill SKILL.md content:** Fetched only when previewing in marketplace
- **Conversation messages:** Paginated, load older messages on scroll-up

---

#### **Debouncing & Throttling**

**Reduce unnecessary renders:**
- **Search inputs:** 300ms debounce
- **Panel resize:** Throttled to 60fps max (prevents layout thrashing)
- **Token counters:** Update every 100ms, not on every token
- **Auto-save drafts:** 2s debounce (saves to DB only when user pauses typing)

---

#### **Streaming Optimization**

**Batch token updates:**
- Buffer tokens and render every 5-10 tokens instead of individually
- Prevents 100+ re-renders per second
- Still feels real-time to user

**Progressive rendering:**
- Large code blocks render as streaming completes
- Cancel previous render if new tokens arrive (avoid render queue backup)

**Web Workers for processing:**
- Syntax highlighting runs in worker (doesn't block main thread)
- TOON encoding/decoding in worker (for large datasets)

---

### Database Performance

#### **Critical Indexes**

**Hot path queries optimized:**

```sql
-- Message retrieval (most common query)
CREATE INDEX messages_conversation_created
ON messages (conversation_id, created_at);

-- Recent conversations list
CREATE INDEX conversations_updated
ON conversations (updated_at DESC);

-- Workflow DAG queries
CREATE INDEX workflow_steps_execution
ON workflow_steps (workflow_execution_id);

-- Semantic search
CREATE INDEX message_embeddings_ivfflat
ON message_embeddings
USING ivfflat (embedding vector_cosine_ops);

-- Tool call history
CREATE INDEX tool_calls_conversation
ON tool_call_events (conversation_id, created_at);
````

---

#### **Query Optimization**

**Pagination everywhere:**

- Conversation list: 50 per page (load more on scroll)
- Message history: Load last 100 messages, fetch older on scroll-up
- Skill marketplace: 20 per page
- Analytics: Date range limits

**Limit context sent to LLM:**

- Default: Last 50 messages
- Configurable in profile settings
- Older messages available but not sent to model (reduces tokens + latency)

**Background jobs:**

- Embeddings generated async (never blocks agent loop or UI)
- Title generation async (doesn't block conversation creation)
- Skill rescanning async (doesn't block app startup)

**Connection pooling:**

- SeaORM connection pool (10 connections)
- Reuses connections across queries
- Prevents connection exhaustion

---

#### **Caching Strategies**

**In-memory caches (Rust):**

- **MCP tool schemas:** Cached after first fetch, invalidated on server reconnect
- **Model pricing:** Cached with 24h TTL, refreshed in background
- **Skill manifests:** Cached, invalidated on file change (via watcher)

**Database caches:**

- `mcp_tool_cache` table (persistent across sessions)
- `model_pricing` table (historical data for cost accuracy)

**Vacuum schedule:**

- Auto-vacuum weekly (Sunday 3 AM if app running)
- Manual vacuum in Settings
- Reclaims space from deleted conversations

---

### Memory Management

#### **Rust Core**

**Stream everything:**

- Agent completions streamed, never buffered entirely in memory
- Large file reads chunked (1 MB at a time)
- TOON encoding streams for large datasets

**Drop completed contexts:**

- Subagent contexts released after merge
- Workflow execution state dropped after completion
- Tool call results cleared after agent loop finishes

**Concurrency limits:**

- Max concurrent subagents: 10 (configurable in profile)
- Max concurrent MCP tool calls: 20
- Prevents memory exhaustion from runaway spawning

---

#### **Frontend (React)**

**Unmount hidden panels:**

- Right panel tabs not in view are unmounted (not just hidden)
- Reduces React component tree size
- Memory freed automatically

**Clear old message renders:**

- Messages outside viewport virtualized away
- React components unmounted
- Only ~50 message components in DOM at any time

**Lazy load conversation history:**

- Don't load all 10,000 conversations into memory
- Fetch page-by-page from DB as user scrolls
- Keep only current page + 1 page buffer in state

---

### Startup Performance

**Fast cold start:**

- Minimize work on app launch
- Load only: API keys, active profile, recent conversations (last 20)
- Everything else lazy-loaded

**Parallel initialization:**

- Load UI while Rust core initializes
- Show splash screen during heavy DB migrations
- Stream conversations into UI as they load

**Background tasks deferred:**

- Skill scanning starts 2s after launch (not blocking)
- MCP discovery starts after UI renders
- Embedding generation queued for later

---

## 16. Accessibility

### WCAG 2.1 AA Compliance

SkillDeck is designed to be usable by everyone, including people using assistive technologies.

---

### Keyboard Navigation

**100% keyboard accessible:**

- All features accessible without mouse
- Logical tab order: left → center → right panels
- Focus indicators visible (2px solid outline, high contrast)
- Skip navigation links for screen readers ("Skip to conversation", "Skip to input")

**Focus management:**

- Opening modal → focus moves to first interactive element
- Closing modal → focus returns to trigger element
- Toast notifications → non-disruptive (don't steal focus)

**Keyboard shortcuts:**

- All critical features have shortcuts (⌘N, ⌘K, etc.)
- Shortcuts customizable for users with motor impairments
- Vim mode available for power users

---

### Screen Reader Support

**ARIA labels on all interactive elements:**

- Buttons: "Send message", "New conversation", "Open settings"
- Icons: Alt text for every icon ("Search", "Delete", "Copy")
- Input fields: Labeled (e.g., "Message input", "API key")

**ARIA live regions for dynamic content:**

- Streaming messages: `aria-live="polite"` (announces new content)
- Status updates: "Agent is typing...", "Workflow step completed"
- Error messages: `aria-live="assertive"` (announces immediately)

**Semantic HTML:**

- Proper heading hierarchy (h1 → h2 → h3)
- Landmarks: `<nav>`, `<main>`, `<aside>`, `<article>`
- Lists for list content (conversation list, skill list)

**Custom components (Radix UI):**

- Built-in ARIA patterns (Dialog, Dropdown, Tabs, etc.)
- Keyboard navigation handled automatically
- Focus trapping in modals

---

### Visual Accessibility

#### **Color Contrast**

**WCAG AA compliant:**

- Text on background: 4.5:1 minimum (normal text)
- Large text (18pt+): 3:1 minimum
- Interactive elements: 3:1 minimum

**Color is not sole indicator:**

- Status: Icon + color (✓ green, ✗ red, ⟳ blue spinner)
- Errors: Icon + red background + "Error" text
- Branches: Numbers (①②③) + color highlights

#### **Resizable Text**

- Respects system font size settings
- Settings → Appearance → Font Size (Small/Medium/Large)
- UI scales proportionally (no horizontal scrolling)

#### **Focus Indicators**

- Visible on all interactive elements
- 2px solid outline
- High contrast (blue on light theme, yellow on dark theme)
- Never `outline: none` without custom focus style

#### **Reduced Motion**

**Respects `prefers-reduced-motion`:**

- Disables: streaming animations, transitions, DAG animations
- Keeps: essential animations (loading spinners)
- Settings toggle: "Enable animations" (overrides system preference)

**Reduced motion mode:**

- No fade-in/fade-out transitions
- Instant state changes
- Static progress indicators (no animated bars)

---

### Touch & Motor Accessibility

**Large touch targets:**

- Minimum 44x44px for all interactive elements
- Generous padding around buttons
- Pill buttons (branches) are 36px tall (easy to tap)

**No hover-only interactions:**

- All hover menus accessible via click/tap
- Context menus available via long-press (mobile) or right-click

**Mouse-free interaction:**

- Keyboard shortcuts for everything
- Drag-and-drop optional (keyboard alternative provided)
- Panel resizing works with arrow keys

---

### Internationalization (i18n)

**Not in v1, but prepared:**

**English-only for v1:**

- Target audience: English-speaking developers
- All UI strings, error messages, tooltips in English

**Ready for future translation:**

- All UI strings externalized (not hardcoded)
- Translation keys in `en.json`:
  ```json
  {
    "conversation.new": "New Conversation",
    "settings.appearance": "Appearance",
    "error.network": "Network error: {message}"
  }
  ```
- Date/time formatting via `date-fns` (locale-aware)
- Number formatting (currency, tokens) locale-aware
- RTL layout supported (CSS logical properties: `margin-inline-start` vs `margin-left`)

**Future translation process:**

- Community contributions via JSON files
- Languages: Spanish, French, German, Japanese, Chinese (Simplified)
- Professional translation for legal/error messages

---

## Appendix: UI Component Library Details

### Core Libraries

**shadcn/ui components used:**

- Dialog, Sheet (modals, marketplace, settings)
- Dropdown Menu (profile switcher, context menus)
- Command (⌘K palette)
- Tabs (right panel, settings)
- Toast (Sonner integration)
- Button, Input, Textarea, Checkbox, Radio, Select
- Card (subagent cards, skill cards)
- ScrollArea (message stream, SKILL.md preview)
- Separator (dividers)
- Tooltip (hover help)
- Badge (status indicators, pills)

**Additional UI libraries:**

- react-resizable-panels (three-panel layout)
- cmdk (command palette, mention picker)
- @xyflow/react (workflow DAG)
- @tanstack/react-virtual (long lists)
- Sonner (toast notifications)
- Radix UI primitives (via shadcn)
- Tailwind CSS (styling)

---

## Conclusion

This design represents a complete UX vision for SkillDeck that:

1. **Starts simple** (Playground mode, progressive unlocking)
2. **Grows with users** (workflows unlock as proficiency increases)
3. **Stays transparent** (workspace context, active skills, workflow DAG always visible)
4. **Respects developers** (keyboard-first, extensible, local-first)
5. **Handles complexity** (workflows, subagents, branching without overwhelming)
6. **Fails gracefully** (clear error messages, recovery paths, no data loss)
7. **Performs well** (virtualization, lazy loading, streaming)
8. **Accessible to all** (WCAG AA, keyboard navigation, screen reader support)

**Next Steps:**

- Write this spec to `docs/superpowers/specs/2026-03-10-skilldeck-ux-design.md`
- Invoke `writing-plans` skill to create implementation plan
- Begin iterative development, starting with core three-panel layout and Playground mode

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-10  
**Author:** Design Team  
**Status:** ✅ Approved — Ready for Implementation Planning
