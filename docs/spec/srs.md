# 📋 Software Requirements Specification — SkillDeck v1

## 1. Introduction & Scope

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for SkillDeck v1, a local-first AI orchestration desktop application that provides developers with privacy-respecting AI assistance, branching conversations, composable filesystem-based skills, and multi-agent workflow orchestration.

### 1.2 Document Scope

This SRS covers:

- Functional requirements for all capability areas
- Non-functional requirements with measurable fit criteria
- External interface specifications
- System constraints and dependencies
- Requirements traceability to business and stakeholder requirements

### 1.3 System Scope

**In Scope:**

- Desktop application for macOS, Windows, and Linux
- Conversation management with branching
- Skill system with filesystem-based skills
- MCP server integration and supervision
- Multi-agent workflow orchestration
- Multi-workspace support
- Export functionality (Markdown, JSON)

**Out of Scope (v1):**

- Cloud synchronization
- Mobile or web versions
- Enterprise SSO/SAML authentication
- Built-in local LLM inference (Ollama integration provides this)
- Native IDE extensions

### 1.4 References

| Document                         | Version | Purpose                                          |
| -------------------------------- | ------- | ------------------------------------------------ |
| SkillDeck v1 Vision Document     | 0.1     | Strategic alignment, goals, non-goals            |
| SkillDeck v1 BRS/StRS            | 0.1     | Business rules, stakeholder needs, domain model  |
| SkillDeck v1 Implementation Plan | 1.0     | Architecture, tech stack, implementation details |

---

## 2. System Context & Overview

### 2.1 Context Diagram

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
          │  Chat    │      │ Configure│      │ Workflow │
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
        │  │    Conversation Manager  │  Message Store    │  │
        │  │    Branch Navigator      │  Tool Dispatcher  │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │                Skill Layer                   │  │
        │  │    Skill Loader         │  Skill Resolver    │  │
        │  │    Skill Watcher        │  Skill Registry    │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │                 MCP Layer                    │  │
        │  │    MCP Discovery        │  MCP Client        │  │
        │  │    MCP Supervisor       │  Tool Registry     │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │              Workflow Layer                  │  │
        │  │    Workflow Executor     │  Subagent Manager │  │
        │  │    DAG Processor         │  Pattern Runners  │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │              Provider Layer                  │  │
        │  │    Provider Registry      │  Model Adapters  │  │
        │  │    Stream Handler         │  Retry Logic     │  │
        │  └──────────────────────────────────────────────┘  │
        │                         │                           │
        │  ┌──────────────────────────────────────────────┐  │
        │  │              Workspace Layer                 │  │
        │  │    Workspace Detector     │  Context Loader  │  │
        │  │    Multi-Workspace Manager                  │  │
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

### 2.2 External Systems & Actors

| Actor/System         | Interface Type        | Description                                                                            |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| **User**             | GUI (Tauri/React)     | Software developer interacting with the application via keyboard, mouse, and clipboard |
| **Claude API**       | HTTPS (SSE streaming) | Anthropic's AI model API for Claude models                                             |
| **OpenAI API**       | HTTPS (SSE streaming) | OpenAI's AI model API for GPT models                                                   |
| **Ollama API**       | HTTP localhost        | Local LLM inference server (OpenAI-compatible)                                         |
| **MCP Servers**      | stdio / HTTP SSE      | External tools exposed via Model Context Protocol                                      |
| **OS Keychain**      | Native API            | Secure credential storage (Keychain/Windows Credential Manager/libsecret)              |
| **Filesystem**       | Native API            | Skills, workspace context, exports, configuration files                                |
| **OS Clipboard**     | Native API            | Copy/paste of messages, code snippets, and artifacts                                   |
| **OS Notifications** | Native API            | User notifications for workflow completion, errors, and approvals                      |

### 2.3 System States

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Startup   │────▶│   Idle      │────▶│ Processing  │
│             │     │             │     │  (Agent     │
│             │     │             │◀────│   Loop)     │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          │ (Shutdown)
                          ▼
                    ┌─────────────┐
                    │   Exiting   │
                    └─────────────┘
```

---

## 3. Functional Requirements

### 3.1 Requirement ID Scheme

| Prefix        | Category                | Example      |
| ------------- | ----------------------- | ------------ |
| **REQ-FUNC-** | Functional requirements | REQ-FUNC-001 |
| **REQ-PERF-** | Performance NFRs        | REQ-PERF-001 |
| **REQ-REL-**  | Reliability NFRs        | REQ-REL-001  |
| **REQ-SEC-**  | Security NFRs           | REQ-SEC-001  |
| **REQ-USA-**  | Usability NFRs          | REQ-USA-001  |
| **REQ-INT-**  | Interface requirements  | REQ-INT-001  |
| **REQ-CON-**  | Constraints             | REQ-CON-001  |

### 3.2 EARS Syntax Patterns Used

| Pattern               | Template                                                         | Usage                          |
| --------------------- | ---------------------------------------------------------------- | ------------------------------ |
| **Ubiquitous**        | The \<system\> shall \<response\>.                               | Always-applicable requirements |
| **Event-driven**      | When \<trigger\>, the \<system\> shall \<response\>.             | Triggered behaviors            |
| **State-driven**      | While \<state\>, the \<system\> shall \<response\>.              | State-specific behaviors       |
| **Optional feature**  | Where \<feature is present\>, the \<system\> shall \<response\>. | Conditional features           |
| **Unwanted behavior** | If \<undesired event\>, then the \<system\> shall \<response\>.  | Error handling, failures       |

---

## 3.3 Capability: Conversation Management

**Traceability:** UC-001, UC-002, UC-003, JTBD-001, JTBD-006, N-1

### 3.3.1 Conversation Creation & Selection

| ID               | Requirement                                                                                                                                                                                        | EARS Pattern | Priority | Traceability   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | -------------- |
| **REQ-FUNC-001** | When the user creates a new conversation, the system shall create a new Conversation entity with a unique identifier, associate it with the active profile, and set it as the active conversation. | Event-driven | Must     | UC-002, BR-010 |
| **REQ-FUNC-002** | When the user selects an existing conversation from the sidebar, the system shall load the conversation's messages from the database and display them in the message thread.                       | Event-driven | Must     | UC-002         |
| **REQ-FUNC-003** | When a conversation is loaded, the system shall display messages in chronological order respecting the branch structure, showing the active branch path.                                           | Event-driven | Must     | UC-003         |
| **REQ-FUNC-004** | When the user renames a conversation, the system shall update the conversation title in the database and refresh the sidebar display.                                                              | Event-driven | Should   | —              |
| **REQ-FUNC-005** | When the user archives a conversation, the system shall mark the conversation as archived and exclude it from default sidebar listings while preserving all message data.                          | Event-driven | Should   | —              |

### 3.3.2 Message Exchange

| ID               | Requirement                                                                                                                                                                                          | EARS Pattern      | Priority | Traceability     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ---------------- |
| **REQ-FUNC-010** | When the user sends a message, the system shall persist the message to the database with a unique identifier, associate it with the conversation, and trigger the agent loop to generate a response. | Event-driven      | Must     | UC-002, JTBD-001 |
| **REQ-FUNC-011** | When the agent loop processes a message, the system shall build context including conversation history, active skills, and system prompt, then call the configured model provider.                   | Event-driven      | Must     | Architecture     |
| **REQ-FUNC-012** | While the model provider is streaming a response, the system shall display tokens in real-time with a maximum render latency of 100ms per chunk.                                                     | State-driven      | Must     | QE-001, BR-008   |
| **REQ-FUNC-013** | When the model provider completes streaming, the system shall persist the assistant message including all tool calls to the database and update token usage statistics.                              | Event-driven      | Must     | —                |
| **REQ-FUNC-014** | If the model provider returns an error, then the system shall display an error message with the error type and suggested action, and preserve any partial response.                                  | Unwanted behavior | Must     | QE-005           |
| **REQ-FUNC-015** | If the user cancels a streaming response, then the system shall stop the stream immediately, persist any partial response, and not charge the model provider for incomplete tokens.                  | Unwanted behavior | Must     | —                |

### 3.3.3 Branching

| ID               | Requirement                                                                                                                                                                        | EARS Pattern | Priority | Traceability             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------------------ |
| **REQ-FUNC-020** | When the user creates a branch from a specific message, the system shall create a new message tree starting from that message as the parent, preserving the original message tree. | Event-driven | Must     | UC-003, JTBD-006, BR-004 |
| **REQ-FUNC-021** | When a message has multiple child branches, the system shall display a branch navigator showing the current branch position (e.g., "1 of 3") with navigation arrows.               | Event-driven | Must     | UC-003                   |
| **REQ-FUNC-022** | When the user navigates to a different branch, the system shall load and display the message tree for that branch while preserving scroll position in the shared message prefix.   | Event-driven | Must     | UC-003                   |
| **REQ-FUNC-023** | When the user merges a branch, the system shall append the branch's unique messages to the main thread at the divergence point and mark the branch as merged.                      | Event-driven | Should   | —                        |
| **REQ-FUNC-024** | When the user discards a branch, the system shall mark the branch as discarded but preserve the messages in the database for audit/recovery purposes.                              | Event-driven | Should   | —                        |
| **REQ-FUNC-025** | If a conversation has no branches, the system shall not display branch navigation controls.                                                                                        | State-driven | Must     | —                        |

### 3.3.4 Message Input Enhancements

| ID               | Requirement                                                                                                                                    | EARS Pattern | Priority | Traceability |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------ |
| **REQ-FUNC-030** | When the user types "/" in the message input, the system shall display a command palette listing available slash commands.                     | Event-driven | Should   | —            |
| **REQ-FUNC-031** | When the user types "@" in the message input, the system shall display a skill selector listing available skills for activation.               | Event-driven | Should   | —            |
| **REQ-FUNC-032** | When the user types "#" in the message input, the system shall display a file selector for attaching workspace files to the message.           | Event-driven | Should   | —            |
| **REQ-FUNC-033** | When the user presses Cmd/Ctrl+K in the message input, the system shall open the global command palette.                                       | Event-driven | Should   | —            |
| **REQ-FUNC-034** | When the user presses Cmd/Ctrl+Enter in the message input, the system shall send the message regardless of focus.                              | Event-driven | Must     | —            |
| **REQ-FUNC-035** | When the user presses the up arrow in an empty input, the system shall edit the previous user message.                                         | Event-driven | Should   | —            |
| **REQ-FUNC-036** | When the user attaches a file, the system shall read the file content, include it in the message context, and display an attachment indicator. | Event-driven | Should   | —            |
| **REQ-FUNC-037** | When the user pastes an image from the clipboard, the system shall attach the image to the message and include it in the model request.        | Event-driven | Should   | —            |

---

## 3.4 Capability: Skill System

**Traceability:** UC-004, JTBD-003, JTBD-007, N-3, BR-002, BR-007

### 3.4.1 Skill Discovery & Loading

| ID               | Requirement                                                                                                                                                | EARS Pattern      | Priority | Traceability   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | -------------- |
| **REQ-FUNC-040** | When the application starts, the system shall scan all configured skill source directories for SKILL.md files and load discovered skills.                  | Event-driven      | Must     | UC-004, BR-007 |
| **REQ-FUNC-041** | When loading a skill, the system shall parse YAML frontmatter for metadata (name, description, triggers) and store the markdown body as the skill content. | Event-driven      | Must     | BR-007         |
| **REQ-FUNC-042** | If a SKILL.md file has invalid YAML frontmatter, then the system shall log a warning, skip the skill, and not crash the application.                       | Unwanted behavior | Must     | —              |
| **REQ-FUNC-043** | If a skill directory contains a symlink, then the system shall skip the symlink and log a warning to prevent symlink traversal attacks.                    | Unwanted behavior | Must     | —              |

### 3.4.2 Skill Resolution

| ID               | Requirement                                                                                                                                                                                                        | EARS Pattern | Priority | Traceability |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | -------- | ------------ |
| **REQ-FUNC-045** | When multiple skills with the same name exist in different source directories, the system shall resolve to the skill from the highest-priority source following: workspace > personal > superpowers > marketplace. | Event-driven | Must     | BR-002       |
| **REQ-FUNC-046** | When skill resolution results in a shadowed skill, the system shall log the shadowed skill name and source for transparency.                                                                                       | Event-driven | Should   | —            |
| **REQ-FUNC-047** | When the user views active skills in the Session panel, the system shall display all resolved skills grouped by source priority.                                                                                   | Event-driven | Must     | —            |

### 3.4.3 Skill Hot Reload

| ID               | Requirement                                                                                                                                                              | EARS Pattern | Priority | Traceability |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | -------- | ------------ |
| **REQ-FUNC-050** | When a SKILL.md file is created, modified, or deleted in a watched directory, the system shall detect the change within 200ms and update the skill registry accordingly. | Event-driven | Should   | —            |
| **REQ-FUNC-051** | When a skill is modified on disk, the system shall reload the skill content, recompute its hash, and update any active conversations that reference it.                  | Event-driven | Should   | —            |
| **REQ-FUNC-052** | When a skill is deleted from disk, the system shall remove it from the registry and log the removal.                                                                     | Event-driven | Should   | —            |

### 3.4.4 Skill Activation

| ID               | Requirement                                                                                                                                        | EARS Pattern | Priority | Traceability |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------ |
| **REQ-FUNC-055** | When a skill is enabled for a profile or conversation, the system shall include the skill content in the system prompt sent to the model provider. | Event-driven | Must     | JTBD-003     |
| **REQ-FUNC-056** | When a skill is disabled, the system shall exclude it from the system prompt while preserving it in the registry for future activation.            | Event-driven | Must     | —            |
| **REQ-FUNC-057** | When the user activates a skill via @ mention in the message input, the system shall activate the skill for the current message only.              | Event-driven | Should   | —            |

---

## 3.5 Capability: MCP Integration

**Traceability:** UC-005, UC-008, JTBD-004, JTBD-009, N-4, BR-005

### 3.5.1 MCP Server Discovery

| ID               | Requirement                                                                                                                                                   | EARS Pattern | Priority | Traceability |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------ |
| **REQ-FUNC-060** | When the user opens the MCP discovery interface, the system shall scan localhost ports for MCP servers and display discovered servers with connection status. | Event-driven | Should   | —            |
| **REQ-FUNC-061** | When scanning for MCP servers, the system shall use concurrent port scanning with a timeout of 5 seconds per port to minimize scan duration.                  | State-driven | Should   | —            |
| **REQ-FUNC-062** | When an MCP server is discovered, the system shall display its name, transport type, and available tools if connected.                                        | Event-driven | Should   | —            |

### 3.5.2 MCP Server Connection

| ID               | Requirement                                                                                                                                                 | EARS Pattern      | Priority | Traceability |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ------------ |
| **REQ-FUNC-065** | When the user connects an MCP server, the system shall establish a connection via the configured transport (stdio or SSE) and call the `initialize` method. | Event-driven      | Must     | UC-008       |
| **REQ-FUNC-066** | When an MCP server connection succeeds, the system shall call `tools/list` to discover available tools and store them in the tool registry.                 | Event-driven      | Must     | —            |
| **REQ-FUNC-067** | If an MCP server connection fails, then the system shall display an error message with the failure reason and suggest remediation steps.                    | Unwanted behavior | Must     | QE-005       |
| **REQ-FUNC-068** | If an MCP server connection times out after 30 seconds, then the system shall mark the server as "connection_failed" and display a timeout error.           | Unwanted behavior | Must     | —            |

### 3.5.3 MCP Server Supervision

| ID               | Requirement                                                                                                                                                               | EARS Pattern      | Priority | Traceability |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ------------ |
| **REQ-FUNC-070** | While an MCP server is connected, the system shall monitor its health and track consecutive failure count.                                                                | State-driven      | Must     | BR-005       |
| **REQ-FUNC-071** | If an MCP server process exits unexpectedly, then the system shall attempt to restart it with exponential backoff (starting at 1 second, max 60 seconds, max 5 attempts). | Unwanted behavior | Must     | BR-005       |
| **REQ-FUNC-072** | If an MCP server reaches the maximum restart attempts, then the system shall mark it as "failed" and display a notification to the user.                                  | Unwanted behavior | Must     | —            |
| **REQ-FUNC-073** | When the user manually reconnects a failed MCP server, the system shall reset the failure count and attempt a fresh connection.                                           | Event-driven      | Should   | —            |

### 3.5.4 Tool Call Processing

| ID               | Requirement                                                                                                                                                           | EARS Pattern      | Priority | Traceability     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ---------------- |
| **REQ-FUNC-075** | When the model requests a tool call, the system shall look up the tool in the registry and determine if it requires user approval based on configuration.             | Event-driven      | Must     | UC-005, BR-003   |
| **REQ-FUNC-076** | When a tool call requires approval, the system shall display an approval card showing the tool name, input parameters, and approval controls (Approve / Edit / Deny). | Event-driven      | Must     | JTBD-004, BR-003 |
| **REQ-FUNC-077** | When the user approves a tool call, the system shall execute the tool via the appropriate MCP session and stream the result back to the conversation.                 | Event-driven      | Must     | —                |
| **REQ-FUNC-078** | When the user edits tool call parameters before approval, the system shall validate the edited JSON against the tool's input schema before execution.                 | Event-driven      | Should   | —                |
| **REQ-FUNC-079** | When the user denies a tool call, the system shall record the denial in the conversation and send a denial message to the model for alternative action.               | Event-driven      | Must     | —                |
| **REQ-FUNC-080** | If a tool call execution times out after 60 seconds, then the system shall return a timeout error to the model and log the failure.                                   | Unwanted behavior | Must     | —                |
| **REQ-FUNC-081** | Where a tool is configured for auto-approval, the system shall execute it immediately without displaying the approval card.                                           | Optional feature  | Should   | —                |

---

## 3.6 Capability: Workflow Orchestration

**Traceability:** UC-006, JTBD-002, JTBD-008, BR-009

### 3.6.1 Workflow Definition

| ID               | Requirement                                                                                                                               | EARS Pattern      | Priority | Traceability |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ------------ |
| **REQ-FUNC-085** | When the user defines a workflow, the system shall allow specification of steps with dependencies forming a directed acyclic graph (DAG). | Event-driven      | Should   | BR-009       |
| **REQ-FUNC-086** | When a workflow definition contains a cycle, then the system shall reject the workflow and display an error indicating the cycle.         | Unwanted behavior | Should   | —            |
| **REQ-FUNC-087** | When the user defines a workflow pattern, the system shall support three patterns: sequential, parallel, and evaluator-optimizer.         | Event-driven      | Should   | —            |

### 3.6.2 Workflow Execution

| ID               | Requirement                                                                                                                            | EARS Pattern      | Priority | Traceability |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ------------ |
| **REQ-FUNC-090** | When a workflow starts, the system shall execute steps in topological order respecting dependency relationships.                       | Event-driven      | Should   | BR-009       |
| **REQ-FUNC-091** | When multiple workflow steps have no dependencies on each other, the system shall execute them in parallel.                            | Event-driven      | Should   | —            |
| **REQ-FUNC-092** | While a workflow is executing, the system shall display a DAG visualization showing step status (pending, running, completed, failed). | State-driven      | Should   | —            |
| **REQ-FUNC-093** | If a workflow step fails, then the system shall mark dependent steps as blocked and allow the user to retry or abort the workflow.     | Unwanted behavior | Should   | —            |
| **REQ-FUNC-094** | When all workflow steps complete successfully, the system shall mark the workflow as completed and notify the user.                    | Event-driven      | Should   | —            |

### 3.6.3 Subagent Management

| ID               | Requirement                                                                                                                                                 | EARS Pattern      | Priority | Traceability |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ------------ |
| **REQ-FUNC-095** | When a workflow step spawns a subagent, the system shall create a new subagent session with its own message history, isolated from the parent conversation. | Event-driven      | Should   | —            |
| **REQ-FUNC-096** | When a subagent completes its task, the system shall display a subagent result card in the parent conversation with options to Merge or Discard.            | Event-driven      | Should   | —            |
| **REQ-FUNC-097** | When the user merges a subagent result, the system shall append the result summary to the parent conversation as an assistant message.                      | Event-driven      | Should   | —            |
| **REQ-FUNC-098** | When the user discards a subagent result, the system shall remove the subagent card and preserve the session for audit purposes.                            | Event-driven      | Should   | —            |
| **REQ-FUNC-099** | If a subagent session encounters an error, then the system shall display the error in the subagent card and allow retry.                                    | Unwanted behavior | Should   | —            |

### 3.6.4 Evaluator-Optimizer Pattern

| ID               | Requirement                                                                                                                                                                    | EARS Pattern     | Priority | Traceability |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------- | ------------ |
| **REQ-FUNC-100** | Where the evaluator-optimizer pattern is selected, the system shall alternate between generator and evaluator steps until the evaluator approves or max iterations is reached. | Optional feature | Should   | —            |
| **REQ-FUNC-101** | When an evaluator step rejects the generator output, the system shall feed the rejection feedback back to the generator for the next iteration.                                | Event-driven     | Should   | —            |
| **REQ-FUNC-102** | When the evaluator-optimizer reaches the maximum iteration count (default: 5), the system shall terminate the loop and display the best result.                                | Event-driven     | Should   | —            |

---

## 3.7 Capability: Profile & Configuration

**Traceability:** UC-001, UC-010, JTBD-005, BR-010

### 3.7.1 Profile Management

| ID               | Requirement                                                                                                                                    | EARS Pattern     | Priority | Traceability   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------- | -------------- |
| **REQ-FUNC-105** | When the user creates a profile, the system shall create a new Profile entity with a unique identifier and associate it with default settings. | Event-driven     | Must     | UC-001, BR-010 |
| **REQ-FUNC-106** | When the user selects a profile as active, the system shall load its model provider configuration, enabled MCP servers, and enabled skills.    | Event-driven     | Must     | —              |
| **REQ-FUNC-107** | When the user duplicates a profile, the system shall create a new profile with copied settings and a new unique identifier.                    | Event-driven     | Should   | —              |
| **REQ-FUNC-108** | When the user deletes a profile, the system shall mark it as deleted and reassign any conversations using it to the default profile.           | Event-driven     | Should   | —              |
| **REQ-FUNC-109** | Where a profile is marked as default, the system shall use it for new conversations when no other profile is specified.                        | Optional feature | Must     | —              |

### 3.7.2 API Key Management

| ID               | Requirement                                                                                                                              | EARS Pattern      | Priority | Traceability |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ------------ |
| **REQ-FUNC-110** | When the user enters an API key, the system shall store it in the OS keychain using the platform-appropriate credential manager.         | Event-driven      | Must     | BR-001       |
| **REQ-FUNC-111** | When the application needs to authenticate with a model provider, the system shall retrieve the API key from the OS keychain at runtime. | Event-driven      | Must     | BR-001       |
| **REQ-FUNC-112** | When the user deletes an API key, the system shall remove it from the OS keychain and mark the associated provider as unavailable.       | Event-driven      | Must     | —            |
| **REQ-FUNC-113** | If the OS keychain is unavailable, then the system shall display an error and refuse to store API keys until the keychain is accessible. | Unwanted behavior | Must     | —            |

### 3.7.3 Tool Approval Configuration

| ID               | Requirement                                                                                                                                                                                                          | EARS Pattern     | Priority | Traceability |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------- | ------------ |
| **REQ-FUNC-115** | When the user configures tool approval settings, the system shall store the configuration per profile with categories: file reads, file writes, database selects, database mutations, HTTP requests, shell commands. | Event-driven     | Should   | —            |
| **REQ-FUNC-116** | Where a tool category is configured for auto-approval, the system shall skip the approval card for tools in that category.                                                                                           | Optional feature | Should   | BR-003       |
| **REQ-FUNC-117** | When the user selects "Safe Mode" preset, the system shall enable approval for all tool categories.                                                                                                                  | Event-driven     | Should   | —            |
| **REQ-FUNC-118** | When the user selects "Trusted Environment" preset, the system shall auto-approve file reads and database selects.                                                                                                   | Event-driven     | Should   | —            |

---

## 3.8 Capability: Workspace Management

**Traceability:** UC-007, JTBD-001

### 3.8.1 Workspace Detection

| ID               | Requirement                                                                                                                              | EARS Pattern | Priority | Traceability |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------ |
| **REQ-FUNC-120** | When the user opens a workspace, the system shall scan the directory structure to detect the project type (Rust, Node, Python, Generic). | Event-driven | Must     | UC-007       |
| **REQ-FUNC-121** | When a workspace is opened, the system shall load context files in order: CLAUDE.md, README.md, and other detected context files.        | Event-driven | Must     | —            |
| **REQ-FUNC-122** | When a workspace contains a `.skilldeck/skills/` directory, the system shall load workspace-specific skills with highest priority.       | Event-driven | Must     | —            |
| **REQ-FUNC-123** | When a workspace contains a `.gitignore` file, the system shall respect its patterns when scanning for context files.                    | Event-driven | Should   | —            |

### 3.8.2 Multi-Workspace Support

| ID               | Requirement                                                                                                                      | EARS Pattern | Priority | Traceability |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------ |
| **REQ-FUNC-125** | When the user opens multiple workspaces, the system shall maintain separate workspace contexts and allow switching between them. | Event-driven | Should   | —            |
| **REQ-FUNC-126** | When the user switches workspaces, the system shall reload skills according to the new workspace's skill directories.            | Event-driven | Should   | —            |
| **REQ-FUNC-127** | When a conversation is created in a workspace context, the system shall tag the conversation with the workspace identifier.      | Event-driven | Should   | —            |
| **REQ-FUNC-128** | When the user closes a workspace, the system shall preserve all conversations and reload the previous workspace context.         | Event-driven | Should   | —            |

---

## 3.9 Capability: Export & Archive

**Traceability:** UC-009

### 3.9.1 Conversation Export

| ID               | Requirement                                                                                                                                                             | EARS Pattern      | Priority | Traceability |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ------------ |
| **REQ-FUNC-130** | When the user exports a conversation as Markdown, the system shall generate a formatted Markdown file with frontmatter metadata and threaded message content.           | Event-driven      | Should   | UC-009       |
| **REQ-FUNC-131** | When the user exports a conversation as JSON, the system shall generate a JSON file containing the complete conversation structure including all branches and metadata. | Event-driven      | Should   | UC-009       |
| **REQ-FUNC-132** | When the user exports multiple conversations, the system shall generate a zip archive containing individual export files.                                               | Event-driven      | Should   | —            |
| **REQ-FUNC-133** | If an export fails due to filesystem permissions, then the system shall display an error with the specific permission issue and suggest corrective action.              | Unwanted behavior | Should   | QE-005       |

### 3.9.2 Conversation Search

| ID               | Requirement                                                                                                                                                          | EARS Pattern     | Priority | Traceability |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------- | ------------ |
| **REQ-FUNC-135** | When the user searches conversations, the system shall perform full-text search across message content and return results within 500ms for up to 1000 conversations. | Event-driven     | Should   | QE-003       |
| **REQ-FUNC-136** | When search results are displayed, the system shall highlight matching text snippets and show conversation context.                                                  | Event-driven     | Should   | —            |
| **REQ-FUNC-137** | Where SQLite-FTS is available, the system shall use it for optimized full-text search performance.                                                                   | Optional feature | Should   | —            |

---

## 3.10 Capability: Clipboard & Notifications

### 3.10.1 Clipboard Integration

| ID               | Requirement                                                                                                               | EARS Pattern | Priority | Traceability |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------ |
| **REQ-FUNC-140** | When the user copies a message, the system shall copy the message content as Markdown to the system clipboard.            | Event-driven | Must     | —            |
| **REQ-FUNC-141** | When the user copies a code block from an artifact, the system shall copy the code as plain text to the system clipboard. | Event-driven | Must     | —            |
| **REQ-FUNC-142** | When the user pastes from the clipboard into the message input, the system shall accept both text and image content.      | Event-driven | Must     | —            |

### 3.10.2 OS Notifications

| ID               | Requirement                                                                                                                          | EARS Pattern     | Priority | Traceability |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------- | ------------ |
| **REQ-FUNC-145** | When a workflow completes successfully, the system shall send an OS notification indicating completion.                              | Event-driven     | Should   | —            |
| **REQ-FUNC-146** | When a tool call requires approval and the app is not focused, the system shall send an OS notification indicating pending approval. | Event-driven     | Should   | —            |
| **REQ-FUNC-147** | When an error occurs that requires user attention, the system shall send an OS notification with the error summary.                  | Event-driven     | Should   | —            |
| **REQ-FUNC-148** | Where the user has disabled notifications for the application, the system shall not send OS notifications.                           | Optional feature | Should   | —            |

---

## 3.11 Capability: Built-in Tools

### 3.11.1 loadSkill

| ID               | Requirement                                                                                                                                  | EARS Pattern      | Priority | Traceability |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- | ------------ |
| **REQ-FUNC-150** | When the model requests to load a skill by name, the system shall look up the skill in the registry and inject its content into the context. | Event-driven      | Should   | —            |
| **REQ-FUNC-151** | When a skill is loaded via the built-in tool, the system shall not require user approval.                                                    | Event-driven      | Should   | —            |
| **REQ-FUNC-152** | If the requested skill does not exist, then the system shall return an error to the model indicating the skill was not found.                | Unwanted behavior | Should   | —            |

### 3.11.2 spawnSubagent

| ID               | Requirement                                                                                                                      | EARS Pattern | Priority | Traceability |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------ |
| **REQ-FUNC-155** | When the model requests to spawn a subagent, the system shall create a new subagent session with the specified task description. | Event-driven | Should   | —            |
| **REQ-FUNC-156** | When a subagent is spawned, the system shall display an inline subagent card showing the task description and status.            | Event-driven | Should   | —            |
| **REQ-FUNC-157** | When spawning a subagent, the system shall not require user approval for the spawn action itself.                                | Event-driven | Should   | —            |

### 3.11.3 mergeSubagentResults

| ID               | Requirement                                                                                                                                                         | EARS Pattern | Priority | Traceability |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------ |
| **REQ-FUNC-160** | When the model requests to merge subagent results, the system shall display the results in the parent conversation and allow the user to confirm or edit the merge. | Event-driven | Should   | —            |
| **REQ-FUNC-161** | When multiple subagent results are available, the system shall display each with individual merge controls.                                                         | Event-driven | Should   | —            |

---

## 4. Non-Functional Requirements

### 4.1 Performance Efficiency

**Traceability:** QE-001, QE-003

| ID               | Requirement                                                                                                               | Fit Criterion                                                                                 | Priority | Traceability   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- | -------------- |
| **REQ-PERF-001** | The system shall start and display the main interface within 3 seconds on reference hardware (8-core CPU, 16GB RAM, SSD). | Startup time measured from process start to interactive UI ready; p95 ≤ 3s across 10 runs     | Must     | QE-001         |
| **REQ-PERF-002** | The system shall render streamed message tokens within 100ms of receipt from the model provider.                          | Render latency measured from token receipt to DOM update; p99 ≤ 100ms                         | Must     | QE-001, BR-008 |
| **REQ-PERF-003** | The system shall respond to user input (typing, scrolling, clicking) within 16ms to maintain 60fps UI responsiveness.     | Frame time measured during interaction; p99 ≤ 16ms                                            | Must     | QE-001         |
| **REQ-PERF-004** | The system shall perform full-text search across 1000 conversations within 500ms.                                         | Search response time measured from query submission to result display; p95 ≤ 500ms            | Should   | QE-003         |
| **REQ-PERF-005** | The system shall load a conversation with 500 messages within 2 seconds including branch navigation setup.                | Load time measured from conversation selection to full thread render; p95 ≤ 2s                | Should   | —              |
| **REQ-PERF-006** | The system shall support up to 100 concurrent MCP server connections without degradation.                                 | Memory and response time measured with 100 connected servers; no >20% degradation vs baseline | Should   | —              |

### 4.2 Reliability

**Traceability:** QE-002

| ID              | Requirement                                                                                                       | Fit Criterion                                                                                                         | Priority | Traceability |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| **REQ-REL-001** | The system shall preserve conversation data through application crashes without data loss.                        | Crash recovery test: force-kill application during message writing, restart, verify last persisted message is present | Must     | QE-002       |
| **REQ-REL-002** | The system shall use SQLite WAL mode to prevent database corruption during crashes.                               | Database integrity check passes after simulated crash scenarios                                                       | Must     | —            |
| **REQ-REL-003** | The system shall recover model provider API errors with exponential backoff retry (max 3 attempts).               | Retry logic tested with simulated 429/5xx errors; recovery within 30s for transient failures                          | Must     | —            |
| **REQ-REL-004** | The system shall recover MCP server failures with exponential backoff restart (max 5 attempts).                   | Server restart tested with simulated crashes; recovery within 60s for transient failures                              | Must     | BR-005       |
| **REQ-REL-005** | The system shall handle network connectivity loss gracefully by displaying offline status and queuing operations. | Offline mode test: disconnect network during operation, verify graceful degradation                                   | Should   | —            |
| **REQ-REL-006** | The system shall not block the UI thread during blocking operations (file I/O, database queries).                 | UI responsiveness measured during heavy I/O; no frame drops > 100ms                                                   | Must     | —            |

### 4.3 Security

**Traceability:** BR-001, BR-003, BR-006

| ID              | Requirement                                                                                                                           | Fit Criterion                                                                            | Priority | Traceability |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- | ------------ |
| **REQ-SEC-001** | The system shall store API keys exclusively in the OS keychain, never in database or configuration files.                             | Security audit: grep database and config files for API key patterns; zero matches        | Must     | BR-001       |
| **REQ-SEC-002** | The system shall require explicit user approval for tool calls that access external resources unless explicitly configured otherwise. | All tool call tests verify approval gate presence for file/network/database tools        | Must     | BR-003       |
| **REQ-SEC-003** | The system shall not collect or transmit telemetry data without explicit user opt-in.                                                 | Network audit: no outbound requests to telemetry endpoints without opt-in flag set       | Must     | BR-006       |
| **REQ-SEC-004** | The system shall skip symlinked skill directories during skill scanning to prevent directory traversal.                               | Symlink test: create symlink skill directory pointing outside allowed paths; verify skip | Must     | —            |
| **REQ-SEC-005** | The system shall restrict file access operations to paths explicitly allowed by the user or within the current workspace.             | File access test: attempt to read file outside workspace via MCP tool; verify rejection  | Should   | —            |
| **REQ-SEC-006** | The system shall use TLS 1.2 or higher for all HTTPS connections to model providers and MCP servers.                                  | Network audit: verify TLS version in all outbound connections                            | Must     | —            |

### 4.4 Usability & Accessibility

**Traceability:** QE-005, G-7, G-8

| ID              | Requirement                                                                                                   | Fit Criterion                                                                            | Priority | Traceability |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- | ------------ |
| **REQ-USA-001** | The system shall provide keyboard navigation for all interactive elements including the command palette.      | Keyboard-only navigation test: complete all core workflows without mouse input           | Must     | —            |
| **REQ-USA-002** | The system shall display error messages with a clear description and at least one suggested action.           | Error message review: all error strings include context + suggested action format        | Must     | QE-005       |
| **REQ-USA-003** | The system shall complete the onboarding wizard within 5 minutes for a first-time user.                       | Usability test: 10 first-time users complete onboarding in < 5 minutes; 90% success rate | Must     | G-7          |
| **REQ-USA-004** | The system shall support internationalization with message extraction for all user-facing strings.            | i18n audit: all UI strings extracted via Lingui macros; message catalog generated        | Should   | G-8          |
| **REQ-USA-005** | The system shall display a context window progress bar indicating token usage relative to model limits.       | UI test: progress bar visible and accurate for conversations with varying token counts   | Should   | —            |
| **REQ-USA-006** | The system shall display a token counter for individual messages and cumulative conversation total.           | UI test: token counts displayed correctly for messages and conversations                 | Should   | —            |
| **REQ-USA-007** | The system shall provide visual feedback for all long-running operations (loading indicators, progress bars). | UI audit: all operations > 500ms have visible feedback                                   | Must     | —            |

### 4.5 Maintainability

| ID               | Requirement                                                                                                                | Fit Criterion                                                                                     | Priority | Traceability   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | -------------- |
| **REQ-MAIN-001** | The system shall log all significant events with structured log levels (debug, info, warn, error) to facilitate debugging. | Log review: all error conditions produce structured logs with context                             | Must     | —              |
| **REQ-MAIN-002** | The system shall expose internal state via a debug interface for troubleshooting during development.                       | Debug interface test: state inspection works in development builds                                | Should   | —              |
| **REQ-MAIN-003** | The system shall separate business logic (Rust core) from presentation (React UI) via well-defined IPC interface.          | Architecture review: no business logic in frontend components; all state mutations go through IPC | Must     | DC-006, DC-007 |

### 4.6 Compatibility

| ID               | Requirement                                                                                                    | Fit Criterion                                                                              | Priority | Traceability |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- | ------------ |
| **REQ-COMP-001** | The system shall run on macOS 11+, Windows 10+, and Linux (glibc 2.31+) with feature parity.                   | Platform testing: all features work identically across all supported platforms             | Must     | DC-001       |
| **REQ-COMP-002** | The system shall import skills and conversations from earlier versions without manual conversion.              | Migration test: v1 database upgrades from v0.x without data loss                           | Should   | —            |
| **REQ-COMP-003** | The system shall interoperate with MCP servers implementing the MCP specification version 2024-11-05 or later. | Compatibility test: connect to 5+ different MCP server implementations; all tools callable | Should   | —            |

---

## 5. External Interface Specifications

### 5.1 Model Provider Interfaces

#### 5.1.1 Claude API (Anthropic)

| Aspect              | Specification                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Endpoint**        | `https://api.anthropic.com/v1/messages`                                                                   |
| **Authentication**  | `x-api-key` header with API key                                                                           |
| **Protocol**        | HTTPS POST with SSE streaming                                                                             |
| **Request Headers** | `anthropic-version: 2023-06-01`, `content-type: application/json`                                         |
| **Request Body**    | `{ model, max_tokens, messages[], system?, tools[], stream: true }`                                       |
| **Response Format** | SSE events: `message_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop` |
| **Error Handling**  | Retry on 429 (rate limit) and 5xx with exponential backoff; fail on 4xx                                   |
| **Reference**       | Implementation Plan §Task 4                                                                               |

#### 5.1.2 OpenAI API

| Aspect              | Specification                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Endpoint**        | `https://api.openai.com/v1/chat/completions`                                                                      |
| **Authentication**  | `Authorization: Bearer <api_key>` header                                                                          |
| **Protocol**        | HTTPS POST with SSE streaming                                                                                     |
| **Request Body**    | `{ model, messages[], tools?, temperature?, max_tokens?, stream: true, stream_options: { include_usage: true } }` |
| **Response Format** | SSE events with `data: {...}` lines; `[DONE]` terminator                                                          |
| **Error Handling**  | Retry on 429 and 5xx with exponential backoff; fail on 4xx                                                        |
| **Reference**       | Implementation Plan §Task 4                                                                                       |

#### 5.1.3 Ollama API (OpenAI-Compatible)

| Aspect             | Specification                                          |
| ------------------ | ------------------------------------------------------ |
| **Endpoint**       | `http://localhost:{port}/v1/chat/completions`          |
| **Authentication** | None (local)                                           |
| **Protocol**       | HTTP POST with SSE streaming                           |
| **Compatibility**  | OpenAI-compatible request/response format              |
| **Error Handling** | No retry (local); fail immediately on connection error |
| **Reference**      | Implementation Plan §Task 4                            |

### 5.2 MCP Interface

#### 5.2.1 Transport Types

| Transport | Description                                              | Use Case                                  |
| --------- | -------------------------------------------------------- | ----------------------------------------- |
| **stdio** | JSON-RPC 2.0 over subprocess stdin/stdout                | Local MCP servers packaged as executables |
| **SSE**   | HTTP POST for requests, Server-Sent Events for responses | Remote MCP servers, cloud-hosted tools    |

#### 5.2.2 Protocol Methods

| Method                      | Direction       | Purpose                                      |
| --------------------------- | --------------- | -------------------------------------------- |
| `initialize`                | Client → Server | Establish connection, negotiate capabilities |
| `tools/list`                | Client → Server | Discover available tools                     |
| `tools/call`                | Client → Server | Execute a tool with parameters               |
| `notifications/initialized` | Server → Client | Confirm initialization complete              |

#### 5.2.3 Tool Schema

```json
{
  "name": "string",
  "description": "string",
  "inputSchema": {
    "type": "object",
    "properties": { ... },
    "required": [ ... ]
  }
}
```

### 5.3 Filesystem Interface

#### 5.3.1 Skill File Format

**Location:** `{skill-source-dir}/{skill-name}/SKILL.md`

**Format:**

```markdown
---
name: skill-name
description: Brief description of the skill
triggers:
  - optional-trigger-keywords
---

# Skill Title

Skill content in Markdown format. This will be included in the system prompt
when the skill is active.
```

#### 5.3.2 Workspace Context Files

| File                 | Priority    | Purpose                                            |
| -------------------- | ----------- | -------------------------------------------------- |
| `CLAUDE.md`          | 1 (highest) | AI context file with project-specific instructions |
| `README.md`          | 2           | Project description and setup information          |
| `.skilldeck/skills/` | 3           | Workspace-specific skills directory                |
| `.gitignore`         | —           | Patterns for files to exclude from context         |

### 5.4 OS Keychain Interface

| Platform    | Service            | Interface                              |
| ----------- | ------------------ | -------------------------------------- |
| **macOS**   | Keychain           | `security` CLI / Keychain Services API |
| **Windows** | Credential Manager | `cmdkey` CLI / WinCrypt API            |
| **Linux**   | libsecret          | `secret-tool` CLI / libsecret API      |

---

## 6. Constraints, Assumptions & Dependencies

### 6.1 Design Constraints

| ID              | Constraint                                         | Rationale                                              |
| --------------- | -------------------------------------------------- | ------------------------------------------------------ |
| **REQ-CON-001** | Desktop-only deployment (no mobile/web)            | Local-first architecture requires desktop capabilities |
| **REQ-CON-002** | Tauri 2 framework for desktop application          | Rust core + React UI architecture                      |
| **REQ-CON-003** | SQLite database with WAL mode                      | Local-first simplicity, concurrency support            |
| **REQ-CON-004** | No cloud backend in v1                             | Scope constraint                                       |
| **REQ-CON-005** | External model providers only                      | Building inference engine out of scope                 |
| **REQ-CON-006** | React frontend communicates only via Tauri IPC     | Clean architecture separation                          |
| **REQ-CON-007** | All business logic in Rust core (`skilldeck-core`) | DDD principles, testability                            |

### 6.2 Dependencies

| ID              | Dependency           | Type             | Risk Level | Mitigation                                       |
| --------------- | -------------------- | ---------------- | ---------- | ------------------------------------------------ |
| **REQ-DEP-001** | Anthropic Claude API | External service | Medium     | Provider abstraction; support multiple models    |
| **REQ-DEP-002** | OpenAI API           | External service | Medium     | Provider abstraction; support multiple models    |
| **REQ-DEP-003** | Ollama (optional)    | External service | Low        | Optional provider; no hard dependency            |
| **REQ-DEP-004** | MCP Server ecosystem | External tools   | Medium     | Skill system as primary; MCP as enhancement      |
| **REQ-DEP-005** | OS keychain          | Platform service | Low        | Graceful degradation if unavailable              |
| **REQ-DEP-006** | React ecosystem      | Libraries        | Low        | Standard library usage; no experimental features |
| **REQ-DEP-007** | Tauri 2 framework    | Runtime          | Low        | Stable release; active community                 |

### 6.3 Assumptions

| ID              | Assumption                                                         | Validation Status                                                  |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **REQ-ASM-001** | Users have stable internet connectivity for cloud model access     | Partially validated — offline mode for local models                |
| **REQ-ASM-002** | Users can run MCP servers locally (subprocess or port binding)     | Unvalidated                                                        |
| **REQ-ASM-003** | SQLite performance is sufficient for expected data volumes         | Validated — SQLite scales to millions of rows with proper indexing |
| **REQ-ASM-004** | Target hardware has 8+ cores and 16GB+ RAM for optimal performance | Unvalidated — minimum requirements TBD                             |

---

## 7. TBD Log

| TBD ID      | Issue                                                          | Owner        | Target Resolution | Status |
| ----------- | -------------------------------------------------------------- | ------------ | ----------------- | ------ |
| **TBD-001** | Default skill set to include with SkillDeck?                   | Project Lead | Pre-alpha         | Open   |
| **TBD-002** | Curated "verified MCP servers" list?                           | Project Lead | v1 beta           | Open   |
| **TBD-003** | Acceptable telemetry granularity for opt-in users?             | Project Lead | v1 beta           | Open   |
| **TBD-004** | Skill conflict resolution UX (how to surface shadowed skills)? | Project Lead | v1 alpha          | Open   |
| **TBD-005** | Minimum viable workflow creation UX?                           | Project Lead | v1 alpha          | Open   |
| **TBD-006** | Should conversation export include embeddings?                 | Project Lead | v1 beta           | Open   |
| **TBD-007** | Workspace-specific settings cascade behavior?                  | Project Lead | v1 alpha          | Open   |
| **TBD-008** | Maximum concurrent MCP servers supported?                      | Project Lead | v1 alpha          | Open   |

---

## 8. Requirements Traceability

### 8.1 Traceability Matrix: BRS → SRS

| BRS Element                        | SRS Requirements                                                                   | Notes                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------- |
| **UC-001** (Configure providers)   | REQ-FUNC-105, REQ-FUNC-106, REQ-FUNC-110, REQ-FUNC-111                             | Profile & API key management        |
| **UC-002** (Conversations)         | REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-010, REQ-FUNC-011                             | Conversation creation and messaging |
| **UC-003** (Branching)             | REQ-FUNC-020, REQ-FUNC-021, REQ-FUNC-022, REQ-FUNC-023, REQ-FUNC-024, REQ-FUNC-025 | Branch operations                   |
| **UC-004** (Skills)                | REQ-FUNC-040, REQ-FUNC-041, REQ-FUNC-045, REQ-FUNC-055                             | Skill discovery and activation      |
| **UC-005** (Tool approval)         | REQ-FUNC-075, REQ-FUNC-076, REQ-FUNC-077, REQ-FUNC-079                             | Tool call processing                |
| **UC-006** (Workflows)             | REQ-FUNC-085, REQ-FUNC-090, REQ-FUNC-095                                           | Workflow definition and execution   |
| **UC-007** (Workspaces)            | REQ-FUNC-120, REQ-FUNC-121, REQ-FUNC-122                                           | Workspace detection and loading     |
| **UC-008** (MCP servers)           | REQ-FUNC-065, REQ-FUNC-066, REQ-FUNC-070                                           | MCP connection and supervision      |
| **UC-009** (Export)                | REQ-FUNC-130, REQ-FUNC-131, REQ-FUNC-132                                           | Conversation export                 |
| **UC-010** (Settings)              | REQ-FUNC-115, REQ-FUNC-116, REQ-FUNC-117, REQ-FUNC-118                             | Tool approval configuration         |
| **BR-001** (API key security)      | REQ-FUNC-110, REQ-FUNC-111, REQ-FUNC-112, REQ-SEC-001                              | Keychain storage                    |
| **BR-002** (Skill priority)        | REQ-FUNC-045, REQ-FUNC-046                                                         | Resolution order                    |
| **BR-003** (Tool approval)         | REQ-FUNC-075, REQ-FUNC-076, REQ-SEC-002                                            | Approval gates                      |
| **BR-004** (Branch append-only)    | REQ-FUNC-020, REQ-FUNC-024                                                         | Branch data integrity               |
| **BR-005** (MCP supervision)       | REQ-FUNC-070, REQ-FUNC-071, REQ-FUNC-072, REQ-REL-004                              | Server monitoring                   |
| **BR-006** (Opt-in telemetry)      | REQ-SEC-003                                                                        | Privacy                             |
| **BR-007** (SKILL.md format)       | REQ-FUNC-040, REQ-FUNC-041                                                         | Skill file format                   |
| **BR-008** (Response streaming)    | REQ-FUNC-012, REQ-PERF-002                                                         | Debounce + streaming                |
| **BR-009** (Workflow DAG)          | REQ-FUNC-085, REQ-FUNC-086, REQ-FUNC-090                                           | Topological execution               |
| **BR-010** (Profile configuration) | REQ-FUNC-105, REQ-FUNC-106                                                         | Profile structure                   |
| **QE-001** (Responsiveness)        | REQ-PERF-001, REQ-PERF-002, REQ-PERF-003                                           | Performance targets                 |
| **QE-002** (Data preservation)     | REQ-REL-001, REQ-REL-002                                                           | Crash recovery                      |
| **QE-003** (Search performance)    | REQ-PERF-004, REQ-FUNC-135                                                         | Search requirements                 |
| **QE-005** (Error clarity)         | REQ-USA-002, REQ-FUNC-014, REQ-FUNC-067, REQ-FUNC-133                              | Error messaging                     |

### 8.2 Goal Coverage Matrix

| Goal                     | Covered by Requirements                        | Coverage |
| ------------------------ | ---------------------------------------------- | -------- |
| **G-1** (Branching)      | REQ-FUNC-020 through REQ-FUNC-025              | Complete |
| **G-2** (Skills)         | REQ-FUNC-040 through REQ-FUNC-057              | Complete |
| **G-3** (Workflows)      | REQ-FUNC-085 through REQ-FUNC-102              | Complete |
| **G-4** (MCP)            | REQ-FUNC-060 through REQ-FUNC-081              | Complete |
| **G-5** (Providers)      | REQ-FUNC-110 through REQ-FUNC-112, §5.1        | Complete |
| **G-6** (UI)             | REQ-FUNC-030 through REQ-FUNC-037, REQ-USA-001 | Complete |
| **G-7** (Onboarding)     | REQ-USA-003                                    | Complete |
| **G-8** (i18n)           | REQ-USA-004                                    | Complete |
| **G-9** (Error handling) | REQ-USA-002, REQ-MAIN-001                      | Complete |

---

## 9. Summary

### 9.1 Requirements Count by Category

| Category                   | Must   | Should | Total   |
| -------------------------- | ------ | ------ | ------- |
| Functional (REQ-FUNC)      | 64     | 37     | 101     |
| Performance (REQ-PERF)     | 4      | 2      | 6       |
| Reliability (REQ-REL)      | 5      | 1      | 6       |
| Security (REQ-SEC)         | 5      | 1      | 6       |
| Usability (REQ-USA)        | 4      | 3      | 7       |
| Maintainability (REQ-MAIN) | 2      | 1      | 3       |
| Compatibility (REQ-COMP)   | 1      | 2      | 3       |
| **Total**                  | **85** | **47** | **132** |

### 9.2 Coverage Summary

| Aspect                              | Status                         |
| ----------------------------------- | ------------------------------ |
| All Use Cases from BRS              | ✓ Covered                      |
| All Business Rules from BRS         | ✓ Covered                      |
| All Quality Expectations quantified | ✓ Quantified with fit criteria |
| All Constraints documented          | ✓ Documented                   |
| All Dependencies documented         | ✓ Documented                   |
| Traceability complete               | ✓ Full matrix                  |
