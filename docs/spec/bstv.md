---

## 📋 Behavioral Specification & Test Verification — SkillDeck v1

| Field | Value |
|-------|-------|
| Project | SkillDeck v1 |
| Document | Behavioral Specification & Test Verification Plan |
| Version | 0.1 (Draft) |
| Date | 2025-01-15 |
| Author | Project Lead, assisted by AI |
| Status | Draft — Pending Review |
| References | SkillDeck v1 Vision (v0.1), BRS/StRS (v0.1), SRS (v0.1), Architecture (v0.1) |

---

## 1. Mental Model: Levels 4–5 in a Modern Stack

This document establishes the verification foundation for SkillDeck v1 across two layers:

**Level 4 — Behavioral Specification**

- BDD scenarios (Given/When/Then) specifying expected behavior
- Decision tables for complex business logic
- State transition specifications for stateful components
- Organized by requirement ID for traceability

**Level 5 — Formal Verification Artifacts**

- Test plans and test case specifications
- NFR verification procedures (performance, reliability, security, accessibility)
- Requirements traceability matrix (full 132 requirements)
- Exploratory testing charters
- Living documentation strategy

---

## 2. Test Strategy Overview

### 2.1 Test Pyramid

```
                    ┌─────────────────────────────────────┐
                    │           E2E Tests                 │
                    │   (Critical user journeys)           │
                    │   Tool: Tauri WebDriver             │
                    │   Count: ~15-20                     │
                    └─────────────────────────────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   │      Integration Tests         │
                   │   (Core + DB + MCP)            │
                   │   Tool: cargo test             │
                   │   Count: ~60-80                │
                   └─────────────────────────────────┘
                                   │
          ┌────────────────────────┴────────────────────────┐
          │              Contract Tests                      │
          │   (IPC commands, Model providers, MCP)           │
          │   Tool: cargo test + custom harness              │
          │   Count: ~40-50                                  │
          └──────────────────────────────────────────────────┘
                                   │
    ┌──────────────────────────────┴──────────────────────────────┐
    │                    Unit Tests                                 │
    │   (Individual Rust modules, React components)               │
    │   Tools: cargo test, Vitest + Testing Library               │
    │   Count: ~250-400                                            │
    └──────────────────────────────────────────────────────────────┘
                                   │
┌──────────────────────────────────┴──────────────────────────────────┐
│                        Static Analysis                              │
│   (Type checking, linting, security scans)                         │
│   Tools: clippy, rust-analyzer, ESLint, SAST, cargo audit         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Test Categories

| Category           | Scope                                     | Automation | Frequency               | Owner    |
| ------------------ | ----------------------------------------- | ---------- | ----------------------- | -------- |
| **Unit**           | Individual functions, modules, components | Full       | Every commit            | Dev team |
| **Contract**       | IPC commands, trait implementations       | Full       | Every commit            | Dev team |
| **Integration**    | Core + DB, Core + MCP, Core + Provider    | Full       | Every PR                | Dev team |
| **BDD/Acceptance** | User-facing behavior                      | Full       | Every PR                | QA + Dev |
| **E2E**            | Full app workflows                        | Full       | Every release           | QA       |
| **Performance**    | NFR verification (latency, throughput)    | Full       | Every release           | QA + Dev |
| **Security**       | Penetration, SAST, dependency audit       | Full       | Every release + monthly | Security |
| **Accessibility**  | Keyboard nav, screen reader, contrast     | Full       | Every release           | QA       |
| **Exploratory**    | Ad-hoc risk-based testing                 | Manual     | Each sprint             | QA       |

### 2.3 Coverage Targets

| Category                   | Target                 | Rationale                                    |
| -------------------------- | ---------------------- | -------------------------------------------- |
| **Line coverage (Rust)**   | ≥ 80%                  | Industry standard; balances effort vs. value |
| **Line coverage (React)**  | ≥ 75%                  | Critical user flows covered                  |
| **Branch coverage (Rust)** | ≥ 70%                  | Important decision paths                     |
| **Requirement coverage**   | 100% Must, ≥90% Should | All critical requirements verified           |
| **NFR coverage**           | 100%                   | All NFRs have verification procedures        |

---

## 3. BDD Scenarios by Requirement

### 3.1 Scenario ID Scheme

| Prefix       | Category              | Example     |
| ------------ | --------------------- | ----------- |
| **SC-FUNC-** | Functional scenarios  | SC-FUNC-001 |
| **SC-PERF-** | Performance scenarios | SC-PERF-001 |
| **SC-SEC-**  | Security scenarios    | SC-SEC-001  |
| **SC-REL-**  | Reliability scenarios | SC-REL-001  |
| **SC-USA-**  | Usability scenarios   | SC-USA-001  |

### 3.2 Functional Scenarios — Conversation Management

---

#### SC-FUNC-001: Create New Conversation

**Traceability:** REQ-FUNC-001, UC-002, JTBD-001

```gherkin
Feature: Conversation Creation
  As a developer
  I want to create a new conversation
  So that I can start interacting with the AI

  Scenario: Create conversation with active profile
    Given the application is running
    And a profile "Claude Sonnet" exists and is active
    When I create a new conversation
    Then a new conversation is created with a unique ID
    And the conversation is associated with the active profile
    And the conversation appears in the sidebar
    And the conversation is set as the active conversation

  Scenario: Create conversation with specific profile
    Given the application is running
    And profiles "Claude Sonnet" and "GPT-4" exist
    When I create a new conversation with profile "GPT-4"
    Then a new conversation is created with a unique ID
    And the conversation is associated with profile "GPT-4"
    And the conversation appears in the sidebar
```

---

#### SC-FUNC-002: Select Existing Conversation

**Traceability:** REQ-FUNC-002, UC-002

```gherkin
Feature: Conversation Selection
  As a developer
  I want to select an existing conversation
  So that I can continue a previous discussion

  Scenario: Select conversation from sidebar
    Given conversations "Project Alpha" and "Bug Fix" exist
    And "Project Alpha" has 10 messages
    When I select conversation "Project Alpha"
    Then the conversation "Project Alpha" becomes active
    And all 10 messages are loaded from the database
    And the messages are displayed in the message thread
    And the conversation title is shown in the header

  Scenario: Select conversation with branches
    Given conversation "Design Review" exists with 5 messages
    And the conversation has 2 branches at message 3
    When I select conversation "Design Review"
    Then the main branch messages are displayed
    And a branch navigator shows "1 of 2"
```

---

#### SC-FUNC-003: Send Message and Receive Streaming Response

**Traceability:** REQ-FUNC-010, REQ-FUNC-011, REQ-FUNC-012, REQ-FUNC-013, UC-002, JTBD-001

```gherkin
Feature: Message Exchange
  As a developer
  I want to send a message and receive a streaming response
  So that I can interact with the AI in real-time

  Scenario: Send message and receive streamed tokens
    Given conversation "Code Review" is active
    And profile "Claude Sonnet" is configured with a valid API key
    When I send the message "Review this function for security issues"
    Then the message is persisted to the database
    And the agent loop builds context including conversation history
    And the model provider is called with the complete request
    And tokens stream from the model in real-time
    And each token batch is rendered within 100ms
    And the streaming text is visible in the message bubble

  Scenario: Complete response is persisted
    Given conversation "Code Review" is active
    When I send a message and the response completes
    Then the assistant message is persisted to the database
    And the token counts (input, output) are recorded
    And the streaming text is cleared from the UI state
    And the message appears as a permanent message in the thread

  Scenario: Cancel streaming response
    Given conversation "Long Discussion" is active
    And a message is being streamed
    When I click the cancel button
    Then the stream stops immediately
    And any partial response is persisted
    And the agent loop is cancelled
```

---

#### SC-FUNC-004: Model Provider Error Handling

**Traceability:** REQ-FUNC-014, REQ-REL-003, ASR-REL-003

```gherkin
Feature: Model Provider Error Handling
  As a developer
  I want graceful error handling when the model API fails
  So that I understand what went wrong and can take action

  Scenario: Rate limit error with retry
    Given conversation "API Test" is active
    And the model provider returns a 429 error
    When I send a message
    Then the system retries with exponential backoff (max 3 attempts)
    And a retry notification is displayed "Retrying..."
    And if retry succeeds, the response continues normally

  Scenario: Permanent error without retry
    Given conversation "API Test" is active
    And the model provider returns a 401 Unauthorized error
    When I send a message
    Then no retry is attempted
    And an error message is displayed "The AI provider rejected your request: Invalid API key"
    And the suggested action "Check your API key in settings" is shown
    And any partial response is preserved

  Scenario: Network timeout during stream
    Given conversation "Slow Network" is active
    And the network connection is lost during streaming
    When a timeout occurs after 30 seconds
    Then an error message is displayed
    And the partial response is preserved
    And the user can retry the message
```

---

#### SC-FUNC-005: Create Branch from Message

**Traceability:** REQ-FUNC-020, UC-003, JTBD-006, BR-004

```gherkin
Feature: Branch Creation
  As a developer
  I want to create a branch from a specific message
  So that I can explore alternative approaches

  Scenario: Create branch at specific message
    Given conversation "Feature Design" is active
    And the conversation has 5 messages
    When I create a branch from message 3
    Then a new branch is created starting from message 3
    And the original message tree is preserved
    And the branch navigator shows "2 of 2"
    And I can continue the conversation in the new branch

  Scenario: Branch preserves parent messages
    Given conversation "Feature Design" has messages 1-5
    And a branch exists at message 3 with messages 3a, 3b
    When I navigate to the branch
    Then messages 1, 2, and 3 are visible (shared prefix)
    And messages 3a and 3b are visible (branch-specific)
    And the scroll position is maintained at the divergence point
```

---

#### SC-FUNC-006: Navigate Between Branches

**Traceability:** REQ-FUNC-021, REQ-FUNC-022, UC-003

```gherkin
Feature: Branch Navigation
  As a developer
  I want to navigate between branches
  So that I can compare different approaches

  Scenario: Navigate to next branch
    Given conversation "Feature Design" has 3 branches
    And I am viewing branch 1 of 3
    When I click the next arrow
    Then branch 2 of 3 is displayed
    And the shared message prefix is preserved
    And the branch-specific messages are updated

  Scenario: Navigate to previous branch
    Given conversation "Feature Design" has 3 branches
    And I am viewing branch 3 of 3
    When I click the previous arrow
    Then branch 2 of 3 is displayed

  Scenario: No branch navigation when single thread
    Given conversation "Simple Chat" has no branches
    Then no branch navigator is displayed
```

---

#### SC-FUNC-007: Merge Branch into Main Thread

**Traceability:** REQ-FUNC-023, UC-003

```gherkin
Feature: Branch Merge
  As a developer
  I want to merge a branch into the main thread
  So that I can incorporate the chosen approach

  Scenario: Merge branch to main thread
    Given conversation "Feature Design" has a branch with messages B1, B2
    And the main thread continues from the divergence point
    When I merge the branch
    Then messages B1 and B2 are appended to the main thread
    And the branch is marked as "merged"
    And the branch navigator is removed
    And the branch messages appear in the main thread chronology

  Scenario: Discard branch
    Given conversation "Feature Design" has an unneeded branch
    When I discard the branch
    Then the branch is marked as "discarded"
    And the branch messages are preserved in the database
    And the branch no longer appears in the navigator
```

---

#### SC-FUNC-008: Enhanced Message Input — Slash Commands

**Traceability:** REQ-FUNC-030

```gherkin
Feature: Message Input Enhancements
  As a developer
  I want enhanced input features
  So that I can quickly access commands and skills

  Scenario: Slash command palette
    Given I am composing a message
    When I type "/"
    Then a command palette appears
    And available slash commands are listed
    And I can select a command with arrow keys and Enter

  Scenario: Skill selector with @
    Given I am composing a message
    And skills "code-review" and "test-generator" are available
    When I type "@"
    Then a skill selector appears
    And available skills are listed
    And selecting a skill activates it for this message
```

---

#### SC-FUNC-009: Enhanced Message Input — File Attachment

**Traceability:** REQ-FUNC-032, REQ-FUNC-036, REQ-FUNC-037

```gherkin
Feature: File Attachment
  As a developer
  I want to attach files to messages
  So that the AI can analyze file contents

  Scenario: Attach file with #
    Given I am composing a message
    And workspace "my-project" is open
    When I type "#"
    Then a file selector appears
    And workspace files are listed
    And I can select a file to attach

  Scenario: Attach image from clipboard
    Given I have an image in my clipboard
    When I paste into the message input
    Then the image is attached to the message
    And an attachment indicator is shown

  Scenario: Attached file included in context
    Given I have attached "src/main.rs" to the message
    When I send the message
    Then the file content is read
    And the content is included in the model request
    And the attachment is shown in the sent message
```

---

### 3.3 Functional Scenarios — Skill System

---

#### SC-FUNC-010: Discover Skills from Filesystem

**Traceability:** REQ-FUNC-040, REQ-FUNC-041, UC-004, BR-007

```gherkin
Feature: Skill Discovery
  As a developer
  I want skills to be discovered automatically
  So that I don't have to manually register each skill

  Scenario: Scan skill directories on startup
    Given skill source directory ".skilldeck/skills" exists
    And directory contains "code-review/SKILL.md" and "test-gen/SKILL.md"
    When the application starts
    Then both SKILL.md files are parsed
    And skills "code-review" and "test-gen" are loaded
    And each skill has metadata from YAML frontmatter
    And each skill has content from the markdown body

  Scenario: Skip malformed SKILL.md
    Given skill source directory contains "broken/SKILL.md" with invalid YAML
    When the application starts
    Then a warning is logged for "broken/SKILL.md"
    And the application does not crash
    And other valid skills are still loaded
```

---

#### SC-FUNC-011: Symlink Safety

**Traceability:** REQ-FUNC-043, REQ-SEC-004, ASR-SEC-003

```gherkin
Feature: Symlink Safety
  As a security-conscious user
  I want symlinked skill directories to be skipped
  So that directory traversal attacks are prevented

  Scenario: Skip symlinked skill directory
    Given skill source directory ".skilldeck/skills" exists
    And "external-skill" is a symlink pointing outside the workspace
    When the application scans for skills
    Then "external-skill" is skipped
    And a warning is logged
    And other skills are loaded normally
```

---

#### SC-FUNC-012: Skill Priority Resolution

**Traceability:** REQ-FUNC-045, REQ-FUNC-046, BR-002, ADR-007

```gherkin
Feature: Skill Resolution
  As a developer
  I want skills to be resolved by priority
  So that workspace-specific skills override global ones

  Scenario: Workspace skill overrides personal skill
    Given personal skill directory contains "formatter" skill
    And workspace skill directory contains "formatter" skill
    When skills are resolved
    Then the workspace "formatter" skill is selected
    And the personal "formatter" skill is shadowed
    And a shadow warning is logged

  Scenario: No conflict when names differ
    Given workspace has skill "formatter"
    And personal directory has skill "linter"
    When skills are resolved
    Then both skills are available
    And no shadow warning is logged
```

---

#### SC-FUNC-013: Skill Hot Reload

**Traceability:** REQ-FUNC-050, REQ-FUNC-051, REQ-FUNC-052

```gherkin
Feature: Skill Hot Reload
  As a developer
  I want skills to reload automatically when files change
  So that I can iterate on skill content

  Scenario: Detect new skill file
    Given the application is running
    And the skill watcher is active
    When I create a new skill file "my-skill/SKILL.md"
    Then the change is detected within 200ms
    And the skill is loaded and added to the registry

  Scenario: Detect skill modification
    Given skill "code-review" is loaded
    When I modify "code-review/SKILL.md"
    Then the change is detected within 200ms
    And the skill content is reloaded
    And the content hash is updated
    And active conversations using the skill are notified

  Scenario: Detect skill deletion
    Given skill "old-skill" is loaded
    When I delete "old-skill/SKILL.md"
    Then the change is detected within 200ms
    And the skill is removed from the registry
    And a removal is logged
```

---

#### SC-FUNC-014: Skill Activation in Conversations

**Traceability:** REQ-FUNC-055, REQ-FUNC-056, REQ-FUNC-057, JTBD-003

```gherkin
Feature: Skill Activation
  As a developer
  I want to activate skills for conversations
  So that the AI follows project-specific conventions

  Scenario: Enable skill for profile
    Given profile "Work" exists
    And skill "company-style" is available
    When I enable skill "company-style" for profile "Work"
    Then the skill is included in the system prompt
    And all conversations using profile "Work" apply the skill

  Scenario: Disable skill
    Given skill "company-style" is enabled for profile "Work"
    When I disable the skill
    Then the skill is excluded from the system prompt
    And the skill remains in the registry

  Scenario: Activate skill via @ mention
    Given I am composing a message
    And skill "security-review" is available
    When I type "@security-review" in the message
    Then the skill is activated for this message only
    And the skill content is injected into the context
```

---

### 3.4 Functional Scenarios — MCP Integration

---

#### SC-FUNC-015: MCP Server Discovery

**Traceability:** REQ-FUNC-060, REQ-FUNC-061, REQ-FUNC-062

```gherkin
Feature: MCP Server Discovery
  As a developer
  I want to discover MCP servers on localhost
  So that I can easily connect to available tools

  Scenario: Discover MCP servers on localhost
    Given MCP servers are running on ports 3000 and 3001
    When I open the MCP discovery interface
    Then localhost ports are scanned with 5-second timeout per port
    And servers on ports 3000 and 3001 are discovered
    And each discovered server shows name and transport type

  Scenario: Discovery with timeout
    Given an MCP server is slow to respond
    When discovery scans the server's port
    Then the scan times out after 5 seconds
    And the server is not shown as discovered
```

---

#### SC-FUNC-016: MCP Server Connection

**Traceability:** REQ-FUNC-065, REQ-FUNC-066, UC-008

```gherkin
Feature: MCP Server Connection
  As a developer
  I want to connect to MCP servers
  So that I can use their tools

  Scenario: Connect to stdio MCP server
    Given MCP server "database-tools" is configured with stdio transport
    When I connect to the server
    Then a subprocess is spawned
    And the initialize method is called via JSON-RPC
    And tools/list is called to discover tools
    And tools are stored in the tool registry
    And the server status becomes "connected"

  Scenario: Connect to SSE MCP server
    Given MCP server "api-wrapper" is configured with SSE transport
    When I connect to the server
    Then an HTTP connection is established
    And the initialize method is called
    And tools are discovered and cached

  Scenario: Connection failure with error
    Given MCP server "broken-server" fails to start
    When I attempt to connect
    Then an error message is displayed
    And the failure reason is shown
    And remediation steps are suggested
```

---

#### SC-FUNC-017: MCP Server Supervision

**Traceability:** REQ-FUNC-070, REQ-FUNC-071, REQ-FUNC-072, REQ-FUNC-073, ASR-REL-002, ADR-008

```gherkin
Feature: MCP Server Supervision
  As a developer
  I want MCP servers to be supervised
  So that they recover from failures automatically

  Scenario: MCP server crashes and restarts
    Given MCP server "database-tools" is connected
    And the server process exits unexpectedly
    When the supervisor detects the failure
    Then the server is restarted after 1 second
    And the failure count is incremented
    And a notification "MCP server database-tools restarted" is shown

  Scenario: Exponential backoff on repeated failures
    Given MCP server "flaky-server" has crashed 2 times
    When it crashes again
    Then the restart delay is 4 seconds (2^2)
    And the failure count is 3

  Scenario: Max retries reached
    Given MCP server "broken-server" has failed 5 times
    When it fails again
    Then no further restart is attempted
    And the server is marked as "failed"
    And a notification is shown to the user
    And the user can manually reconnect
```

---

#### SC-FUNC-018: Tool Call Request

**Traceability:** REQ-FUNC-075, UC-005

```gherkin
Feature: Tool Call Processing
  As a developer
  I want tool calls to be processed correctly
  So that the AI can interact with external tools

  Scenario: Tool call requires approval
    Given MCP tool "read_file" is available
    And tool category "file_reads" requires approval
    When the model requests tool "read_file" with path "/workspace/src/main.rs"
    Then the tool is looked up in the registry
    And an approval gate is created
    And a ToolCallPending event is emitted
    And the agent loop awaits the approval response

  Scenario: Tool call auto-approved
    Given MCP tool "read_file" is available
    And tool category "file_reads" is configured for auto-approval
    When the model requests tool "read_file"
    Then the tool is executed immediately
    And no approval card is displayed
```

---

#### SC-FUNC-019: Tool Approval Gate

**Traceability:** REQ-FUNC-076, REQ-FUNC-077, REQ-FUNC-078, REQ-FUNC-079, ASR-SEC-002, JTBD-004

```gherkin
Feature: Tool Approval Gate
  As a developer
  I want to approve or deny tool calls
  So that I maintain control over external access

  Scenario: Display approval card
    Given a tool call "read_file" requires approval
    And parameters are { "path": "/workspace/secrets.env" }
    When the approval gate is created
    Then an approval card is displayed
    And the tool name "read_file" is shown
    And the parameter path "/workspace/secrets.env" is visible
    And buttons "Approve", "Edit", "Deny" are available

  Scenario: Approve tool call
    Given an approval card is displayed for "read_file"
    When I click "Approve"
    Then the tool is executed via the MCP session
    And the result is streamed to the conversation
    And the approval card is replaced with a tool result card

  Scenario: Edit parameters before approval
    Given an approval card is displayed for "read_file" with path "/etc/passwd"
    When I edit the path to "/workspace/src/main.rs"
    And I click "Approve"
    Then the edited JSON is validated against the tool schema
    And the tool is executed with the edited parameters

  Scenario: Deny tool call
    Given an approval card is displayed for "execute_shell"
    When I click "Deny"
    And I optionally provide a reason "Unsafe operation"
    Then a denial is recorded in the conversation
    And a denial message is sent to the model
    And the model may attempt an alternative action

  Scenario: Cancel approval on navigation
    Given an approval card is displayed for conversation "Session A"
    When I navigate to a different conversation
    Then the approval gate is cancelled
    And the oneshot channel is closed
    And the agent loop receives a cancellation error
```

---

#### SC-FUNC-020: Tool Execution Timeout

**Traceability:** REQ-FUNC-080

```gherkin
Feature: Tool Execution Timeout
  As a developer
  I want tool execution to timeout
  So that hung tools don't block the conversation

  Scenario: Tool execution times out
    Given tool "slow_query" is being executed
    And the tool does not respond within 60 seconds
    When the timeout occurs
    Then a timeout error is returned to the model
    And the failure is logged
    And the user is notified of the timeout
```

---

### 3.5 Functional Scenarios — Workflow Orchestration

---

#### SC-FUNC-021: Define Workflow with DAG

**Traceability:** REQ-FUNC-085, REQ-FUNC-086, UC-006, ASR-STR-003

```gherkin
Feature: Workflow Definition
  As a developer
  I want to define workflows with dependencies
  So that I can orchestrate multi-step processes

  Scenario: Define valid workflow DAG
    Given I want to create a workflow
    When I define steps "analyze", "design", "implement", "test"
    And I set dependencies "analyze" → "design" → "implement" → "test"
    Then the workflow is accepted
    And a DAG visualization is shown

  Scenario: Reject workflow with cycle
    Given I want to create a workflow
    When I define steps with a cycle "A" → "B" → "C" → "A"
    Then the workflow is rejected
    And an error "Cycle detected: A → B → C → A" is shown
```

---

#### SC-FUNC-022: Execute Sequential Workflow

**Traceability:** REQ-FUNC-090, REQ-FUNC-093

```gherkin
Feature: Sequential Workflow Execution
  As a developer
  I want workflows to execute in dependency order
  So that each step has its prerequisites ready

  Scenario: Execute steps in order
    Given workflow "Code Review" has steps "analyze" → "review" → "report"
    When I start the workflow
    Then step "analyze" runs first
    And after "analyze" completes, step "review" runs
    And after "review" completes, step "report" runs
    And each step completion updates the DAG visualization

  Scenario: Step failure blocks dependents
    Given workflow "Code Review" has steps "analyze" → "review"
    When step "analyze" fails
    Then step "review" is marked as "blocked"
    And the workflow status is "failed"
    And I can retry "analyze" or abort the workflow
```

---

#### SC-FUNC-023: Execute Parallel Workflow

**Traceability:** REQ-FUNC-091

```gherkin
Feature: Parallel Workflow Execution
  As a developer
  I want independent steps to run in parallel
  So that workflows complete faster

  Scenario: Execute parallel steps
    Given workflow "Multi-module Analysis" has steps "analyze-auth", "analyze-api", "analyze-db"
    And all steps have no dependencies on each other
    When I start the workflow
    Then all three steps start simultaneously
    And each step runs in its own subagent
    And the DAG shows all steps as "running"

  Scenario: Aggregate parallel results
    Given parallel steps "analyze-auth" and "analyze-api" complete
    When both results are available
    Then results are aggregated
    And a combined result is presented for the next step
```

---

#### SC-FUNC-024: Subagent Lifecycle

**Traceability:** REQ-FUNC-095, REQ-FUNC-096, REQ-FUNC-097, REQ-FUNC-098, REQ-FUNC-099

```gherkin
Feature: Subagent Management
  As a developer
  I want to manage subagent sessions
  So that I can control parallel AI tasks

  Scenario: Spawn subagent for workflow step
    Given workflow step "analyze-auth" is starting
    When the step spawns a subagent
    Then a new subagent session is created
    And the session has its own message history
    And the session is isolated from the parent conversation
    And a subagent card shows "Running"

  Scenario: Subagent completes
    Given subagent "analyze-auth" is running
    When the subagent completes its task
    Then the status changes to "Done"
    And a result summary is generated
    And options "Merge" and "Discard" appear

  Scenario: Merge subagent result
    Given subagent "analyze-auth" has completed
    When I click "Merge"
    Then the result summary is appended to the parent conversation
    And the subagent card is removed
    And the subagent session is preserved for audit

  Scenario: Discard subagent result
    Given subagent "analyze-auth" has completed
    When I click "Discard"
    Then the result is not added to the parent conversation
    And the subagent session is preserved for audit

  Scenario: Subagent error
    Given subagent "analyze-auth" is running
    When an error occurs in the subagent
    Then the error is displayed in the subagent card
    And options "Retry" and "Discard" appear
```

---

#### SC-FUNC-025: Evaluator-Optimizer Pattern

**Traceability:** REQ-FUNC-100, REQ-FUNC-101, REQ-FUNC-102

```gherkin
Feature: Evaluator-Optimizer Workflow
  As a developer
  I want iterative refinement loops
  So that outputs improve through evaluation

  Scenario: Run evaluator-optimizer loop
    Given workflow "Refine Code" uses evaluator-optimizer pattern
    And max iterations is set to 5
    When I start the workflow
    Then the generator step produces initial output
    And the evaluator step reviews the output
    And if the evaluator rejects, feedback is sent to the generator
    And the next iteration begins
    And the iteration counter increments

  Scenario: Evaluator accepts output
    Given evaluator-optimizer is on iteration 2
    When the evaluator accepts the output
    Then the loop terminates
    And the final output is returned
    And the DAG shows "completed" status

  Scenario: Max iterations reached
    Given evaluator-optimizer has run 5 iterations
    When the evaluator still rejects
    Then the loop terminates
    And the best result is presented
    And a note "Max iterations reached" is shown
```

---

### 3.6 Functional Scenarios — Profile & Configuration

---

#### SC-FUNC-026: Profile Management

**Traceability:** REQ-FUNC-105, REQ-FUNC-106, REQ-FUNC-107, REQ-FUNC-108, REQ-FUNC-109, UC-001

```gherkin
Feature: Profile Management
  As a developer
  I want to manage profiles
  So that I can switch between different AI configurations

  Scenario: Create new profile
    Given the application is running
    When I create a profile named "Personal Projects"
    Then a new Profile entity is created with a unique ID
    And default settings are applied
    And the profile appears in the profile list

  Scenario: Switch active profile
    Given profiles "Work" and "Personal" exist
    And "Work" is active
    When I select "Personal" as active
    Then the model provider configuration for "Personal" is loaded
    And MCP servers for "Personal" are connected
    And skills for "Personal" are enabled

  Scenario: Duplicate profile
    Given profile "Work" exists with specific settings
    When I duplicate "Work" as "Work-Backup"
    Then a new profile is created
    And all settings are copied
    And a new unique ID is assigned

  Scenario: Delete profile
    Given profile "Old" exists
    And conversation "Archive" uses profile "Old"
    When I delete profile "Old"
    Then the profile is marked as deleted
    And conversation "Archive" is reassigned to the default profile
```

---

#### SC-FUNC-027: API Key Storage in Keychain

**Traceability:** REQ-FUNC-110, REQ-FUNC-111, REQ-FUNC-112, REQ-FUNC-113, ASR-SEC-001, ADR-009

```gherkin
Feature: API Key Management
  As a security-conscious developer
  I want API keys stored securely
  So that they are never exposed in the database or files

  Scenario: Store API key in OS keychain
    Given I enter an Anthropic API key
    When I save the key
    Then the key is stored in the OS keychain
    And the key is NOT stored in the database
    And the key is NOT stored in config files
    And the key is NOT logged

  Scenario: Retrieve API key for authentication
    Given an API key is stored for provider "Anthropic"
    When the application needs to authenticate
    Then the key is retrieved from the OS keychain at runtime
    And the key is used for the API request
    And the key is cleared from memory after use

  Scenario: Delete API key
    Given an API key exists for provider "Anthropic"
    When I delete the key
    Then the key is removed from the OS keychain
    And the provider is marked as unavailable

  Scenario: Keychain unavailable
    Given the OS keychain is inaccessible
    When I attempt to store an API key
    Then an error is displayed "Keychain unavailable"
    And the key is NOT stored anywhere
    And the operation is aborted
```

---

#### SC-FUR-028: Tool Approval Configuration

**Traceability:** REQ-FUNC-115, REQ-FUNC-116, REQ-FUNC-117, REQ-FUNC-118, UC-010

```gherkin
Feature: Tool Approval Configuration
  As a developer
  I want to configure tool approval settings
  So that I can balance security and productivity

  Scenario: Configure auto-approve for file reads
    Given profile "Trusted Workspace" exists
    When I enable auto-approve for "file_reads"
    Then subsequent file read tools execute without approval gates
    And the setting is stored per profile

  Scenario: Apply "Safe Mode" preset
    Given profile "Work" exists
    When I apply "Safe Mode" preset
    Then all tool categories require approval
    And the configuration is saved

  Scenario: Apply "Trusted Environment" preset
    Given profile "Personal" exists
    When I apply "Trusted Environment" preset
    Then "file_reads" and "database_selects" are auto-approved
    And other categories require approval
```

---

### 3.7 Functional Scenarios — Workspace Management

---

#### SC-FUNC-029: Workspace Detection

**Traceability:** REQ-FUNC-120, REQ-FUNC-121, REQ-FUNC-122, REQ-FUNC-123, UC-007

```gherkin
Feature: Workspace Detection
  As a developer
  I want workspace context to be detected automatically
  So that skills and context are project-specific

  Scenario: Detect Rust project
    Given I open workspace "/projects/my-rust-app"
    And the directory contains "Cargo.toml"
    When the workspace is scanned
    Then project type is detected as "Rust"
    And CLAUDE.md is loaded if present
    And README.md is loaded if present
    And .gitignore patterns are noted

  Scenario: Detect Node project
    Given I open workspace "/projects/my-node-app"
    And the directory contains "package.json"
    When the workspace is scanned
    Then project type is detected as "Node"
    And context files are loaded

  Scenario: Detect Python project
    Given I open workspace "/projects/my-python-app"
    And the directory contains "pyproject.toml"
    When the workspace is scanned
    Then project type is detected as "Python"

  Scenario: Load workspace-specific skills
    Given I open workspace "/projects/my-app"
    And the directory contains ".skilldeck/skills/review/SKILL.md"
    When the workspace is opened
    Then the workspace skill "review" is loaded with highest priority
```

---

#### SC-FUNC-030: Multi-Workspace Support

**Traceability:** REQ-FUNC-125, REQ-FUNC-126, REQ-FUNC-127, REQ-FUNC-128

```gherkin
Feature: Multi-Workspace Support
  As a developer
  I want to work with multiple workspaces
  So that I can switch between projects

  Scenario: Open multiple workspaces
    Given workspace "frontend" and "backend" exist
    When I open both workspaces
    Then separate workspace contexts are maintained
    And I can switch between them
    And each workspace has its own skill context

  Scenario: Switch workspaces
    Given workspaces "frontend" and "backend" are open
    And I am in workspace "frontend"
    When I switch to workspace "backend"
    Then skills are reloaded for "backend"
    And context files for "backend" are loaded
    And the previous workspace context is preserved

  Scenario: Conversation tagged with workspace
    Given workspace "frontend" is open
    When I create a conversation
    Then the conversation is tagged with workspace "frontend"
    And the conversation is visible when filtering by workspace

  Scenario: Close workspace
    Given workspace "frontend" is open
    When I close the workspace
    Then the workspace context is unloaded
    And conversations are preserved
    And the previous workspace context is restored
```

---

### 3.8 Functional Scenarios — Export & Search

---

#### SC-FUNC-031: Conversation Export

**Traceability:** REQ-FUNC-130, REQ-FUNC-131, REQ-FUNC-132, REQ-FUNC-133, UC-009

```gherkin
Feature: Conversation Export
  As a developer
  I want to export conversations
  So that I can share or archive them

  Scenario: Export as Markdown
    Given conversation "Design Review" exists
    When I export the conversation as Markdown
    Then a .md file is generated
    And the file contains frontmatter metadata
    And the file contains threaded message content
    And the file is saved to the selected location

  Scenario: Export as JSON
    Given conversation "Design Review" exists with branches
    When I export the conversation as JSON
    Then a .json file is generated
    And the file contains the complete structure
    And branches are included
    And metadata is preserved

  Scenario: Export multiple conversations
    Given conversations "Session 1" and "Session 2" exist
    When I export both conversations
    Then a .zip archive is created
    And each conversation is a separate file

  Scenario: Export with filesystem error
    Given I attempt to export to a read-only directory
    When the export fails
    Then an error is displayed
    And the specific permission issue is shown
    And the suggested action is "Choose a different location"
```

---

#### SC-FUNC-032: Conversation Search

**Traceability:** REQ-FUNC-135, REQ-FUNC-136, REQ-FUNC-137, QE-003

```gherkin
Feature: Conversation Search
  As a developer
  I want to search across conversations
  So that I can find previous discussions

  Scenario: Full-text search
    Given 1000 conversations exist
    And conversation "API Design" contains "GraphQL schema"
    When I search for "GraphQL"
    Then results are returned within 500ms
    And conversation "API Design" is in the results
    And the matching text is highlighted

  Scenario: Search with context
    Given search results are displayed
    When I view a result
    Then the surrounding context is shown
    And I can navigate to the full conversation

  Scenario: FTS optimization
    Given SQLite-FTS is available
    When I perform a search
    Then the FTS index is used
    And performance is optimized
```

---

### 3.9 Functional Scenarios — Clipboard & Notifications

---

#### SC-FUNC-033: Clipboard Integration

**Traceability:** REQ-FUNC-140, REQ-FUNC-141, REQ-FUNC-142

```gherkin
Feature: Clipboard Integration
  As a developer
  I want to use clipboard for copy/paste
  So that I can share content easily

  Scenario: Copy message as Markdown
    Given a message is displayed
    When I copy the message
    Then the content is copied as Markdown
    And the content is in the system clipboard

  Scenario: Copy code block
    Given a code block artifact is displayed
    When I copy the code
    Then the code is copied as plain text
    And the code is in the system clipboard

  Scenario: Paste text
    Given I have text in the clipboard
    When I paste into the message input
    Then the text is inserted at the cursor position

  Scenario: Paste image
    Given I have an image in the clipboard
    When I paste into the message input
    Then the image is attached to the message
```

---

#### SC-FUNC-034: OS Notifications

**Traceability:** REQ-FUNC-145, REQ-FUNC-146, REQ-FUNC-147, REQ-FUNC-148

```gherkin
Feature: OS Notifications
  As a developer
  I want OS notifications for important events
  So that I stay informed even when the app is in the background

  Scenario: Workflow completion notification
    Given a workflow is running
    And the app is not focused
    When the workflow completes successfully
    Then an OS notification is sent
    And the notification indicates completion

  Scenario: Tool approval pending notification
    Given a tool call is awaiting approval
    And the app is not focused
    When the approval gate is created
    Then an OS notification is sent
    And the notification indicates pending approval

  Scenario: Error notification
    Given an error requiring attention occurs
    When the error occurs
    Then an OS notification is sent
    And the notification shows the error summary

  Scenario: Notifications disabled
    Given notifications are disabled for the app
    When any notification-triggering event occurs
    Then no OS notification is sent
```

---

### 3.10 Functional Scenarios — Built-in Tools

---

#### SC-FUNC-035: loadSkill Built-in Tool

**Traceability:** REQ-FUNC-150, REQ-FUNC-151, REQ-FUNC-152

```gherkin
Feature: loadSkill Built-in Tool
  As the AI
  I want to load skills dynamically
  So that I can adapt to the current context

  Scenario: Load skill by name
    Given skill "code-review" is in the registry
    When the model requests loadSkill with name "code-review"
    Then the skill is looked up
    And the skill content is injected into the context
    And no user approval is required

  Scenario: Skill not found
    Given skill "nonexistent" is not in the registry
    When the model requests loadSkill with name "nonexistent"
    Then an error is returned to the model
    And the model may try an alternative
```

---

#### SC-FUNC-036: spawnSubagent Built-in Tool

**Traceability:** REQ-FUNC-155, REQ-FUNC-156, REQ-FUNC-157

```gherkin
Feature: spawnSubagent Built-in Tool
  As the AI
  I want to spawn subagents
  So that I can parallelize work

  Scenario: Spawn subagent
    Given the model requests spawnSubagent with task "Analyze auth module"
    When the request is processed
    Then a new subagent session is created
    And the task description is stored
    And an inline subagent card shows "Running"
    And no user approval is required for spawning

  Scenario: Subagent completes
    Given subagent is running
    When the subagent completes
    Then the card shows "Done"
    And options "Merge" and "Discard" appear
```

---

#### SC-FUNC-037: mergeSubagentResults Built-in Tool

**Traceability:** REQ-FUNC-160, REQ-FUNC-161

```gherkin
Feature: mergeSubagentResults Built-in Tool
  As the AI
  I want to merge subagent results
  So that I can combine parallel outputs

  Scenario: Merge results
    Given subagent results are available
    When the model requests mergeSubagentResults
    Then results are displayed in the parent conversation
    And the user can confirm or edit the merge

  Scenario: Multiple subagent results
    Given multiple subagent results are available
    When results are displayed
    Then each result has individual merge controls
    And the user can merge selectively
```

---

## 4. NFR Verification Plans

### 4.1 Performance Verification

---

#### PERF-001: Application Startup Time

**Target:** < 3 seconds on reference hardware (8-core CPU, 16GB RAM, SSD)

**Verification Method:**

| Step | Action                                 | Measurement |
| ---- | -------------------------------------- | ----------- |
| 1    | Kill all SkillDeck processes           | —           |
| 2    | Start timer                            | t₀          |
| 3    | Launch SkillDeck                       | —           |
| 4    | Stop timer when main UI is interactive | t₁          |
| 5    | Calculate startup time                 | t₁ - t₀     |

**Test Cases:**

```gherkin
Feature: Startup Performance
  As a developer
  I want the app to start quickly
  So that I can begin work immediately

  Scenario: Cold start
    Given SkillDeck is not running
    And the system has been rebooted
    When I launch SkillDeck
    Then the main UI is interactive within 3 seconds
    And p95 over 10 runs is ≤ 3 seconds

  Scenario: Warm start
    Given SkillDeck was recently closed
    When I launch SkillDeck
    Then the main UI is interactive within 2 seconds
```

**Tools:** Custom harness, Criterion benchmark

**Acceptance Criteria:** p95 ≤ 3 seconds across 10 runs on each platform (macOS, Windows, Linux)

---

#### PERF-002: Message Render Latency

**Target:** < 100ms (p99) from token receipt to DOM update

**Verification Method:**

| Step | Action                   | Measurement |
| ---- | ------------------------ | ----------- |
| 1    | Start streaming response | —           |
| 2    | Inject token batch at t₀ | t₀          |
| 3    | Measure DOM update time  | t₁          |
| 4    | Calculate latency        | t₁ - t₀     |
| 5    | Repeat for 1000+ tokens  | —           |

**Test Cases:**

```gherkin
Feature: Message Render Latency
  As a developer
  I want tokens to render quickly
  So that the conversation feels responsive

  Scenario: Token batch render
    Given a message is streaming
    When a token batch arrives
    Then the DOM is updated within 100ms
    And p99 over 100 batches is ≤ 100ms

  Scenario: Sustained streaming
    Given 5000 tokens are streaming
    When each batch renders
    Then no frame takes > 100ms
    And the UI remains responsive
```

**Tools:** Chrome DevTools Performance panel, custom profiler

**Acceptance Criteria:** p99 ≤ 100ms

---

#### PERF-003: UI Responsiveness (60fps)

**Target:** All interactions complete within 16ms (60fps)

**Verification Method:**

| Interaction             | Measurement |
| ----------------------- | ----------- |
| Typing in input         | Frame time  |
| Scrolling message list  | Frame time  |
| Opening settings        | Frame time  |
| Switching conversations | Frame time  |

**Test Cases:**

```gherkin
Feature: UI Responsiveness
  As a developer
  I want the UI to remain responsive
  So that interactions feel smooth

  Scenario: Typing in message input
    Given I am typing rapidly
    When each keystroke is processed
    Then frame time is ≤ 16ms
    And no dropped frames are detected

  Scenario: Scrolling long conversation
    Given a conversation with 500 messages
    When I scroll through the thread
    Then frame time is ≤ 16ms
    And scrolling is smooth
```

**Tools:** Chrome DevTools, frame timing API

**Acceptance Criteria:** No frame > 16ms during interactions

---

#### PERF-004: Search Performance

**Target:** < 500ms for 1000 conversations

**Verification Method:**

| Step | Action                                        |
| ---- | --------------------------------------------- |
| 1    | Create 1000 conversations with varied content |
| 2    | Execute search query                          |
| 3    | Measure time from query to results displayed  |

**Test Cases:**

```gherkin
Feature: Search Performance
  As a developer
  I want search to be fast
  So that I can quickly find content

  Scenario: Search across 1000 conversations
    Given 1000 conversations exist
    When I search for a common term
    Then results appear within 500ms
    And p95 over 10 searches is ≤ 500ms
```

**Tools:** Custom harness with stopwatch

**Acceptance Criteria:** p95 ≤ 500ms

---

#### PERF-005: Conversation Load Time

**Target:** < 2 seconds for 500 messages

**Verification Method:**

| Step | Action                                     |
| ---- | ------------------------------------------ |
| 1    | Create conversation with 500 messages      |
| 2    | Clear cache                                |
| 3    | Select conversation                        |
| 4    | Measure time from selection to full render |

**Test Cases:**

```gherkin
Feature: Conversation Load Performance
  As a developer
  I want conversations to load quickly
  So that I can access my history

  Scenario: Load large conversation
    Given a conversation with 500 messages
    When I select the conversation
    Then all messages are rendered within 2 seconds
    And the branch navigator is initialized
```

**Tools:** Custom harness

**Acceptance Criteria:** Load time ≤ 2 seconds

---

#### PERF-006: Concurrent MCP Servers

**Target:** No > 20% degradation with 100 concurrent MCP servers

**Verification Method:**

| Step | Action                                          |
| ---- | ----------------------------------------------- |
| 1    | Measure baseline performance with 0 MCP servers |
| 2    | Connect 100 mock MCP servers                    |
| 3    | Measure performance metrics                     |
| 4    | Compare to baseline                             |

**Test Cases:**

```gherkin
Feature: Concurrent MCP Server Performance
  As a developer
  I want the app to handle many MCP servers
  So that I can use many tools

  Scenario: 100 concurrent MCP servers
    Given 100 mock MCP servers are connected
    When I perform normal operations
    Then memory increase is < 500MB
    And response time degradation is < 20%
```

**Tools:** Mock MCP server harness, memory profiler

**Acceptance Criteria:** < 20% performance degradation

---

### 4.2 Reliability Verification

---

#### REL-001: Crash Recovery

**Target:** No data loss on crash

**Verification Method:**

| Step | Action                                   |
| ---- | ---------------------------------------- |
| 1    | Start conversation, send messages        |
| 2    | Force-kill application process           |
| 3    | Restart application                      |
| 4    | Verify last persisted message is present |

**Test Cases:**

```gherkin
Feature: Crash Recovery
  As a developer
  I want my data to survive crashes
  So that I don't lose work

  Scenario: Recover from crash during message write
    Given I am sending a message
    When the application is force-killed
    And I restart the application
    Then the last persisted message is present
    And no data corruption is detected

  Scenario: Crash during streaming
    Given a response is streaming
    When the application crashes
    And I restart
    Then the partial response is preserved
```

**Tools:** Custom harness with process kill

**Acceptance Criteria:** All test cases pass with no data loss

---

#### REL-002: Database Integrity

**Target:** SQLite WAL mode prevents corruption

**Verification Method:**

| Step | Action                            |
| ---- | --------------------------------- |
| 1    | Verify WAL mode is enabled        |
| 2    | Execute database integrity check  |
| 3    | Simulate crash during transaction |
| 4    | Verify integrity after recovery   |

**Test Cases:**

```gherkin
Feature: Database Integrity
  As a developer
  I want the database to remain consistent
  So that my data is reliable

  Scenario: WAL mode enabled
    Given the database is initialized
    Then journal_mode is 'WAL'
    And synchronous is 'NORMAL'

  Scenario: Integrity after crash
    Given a transaction is in progress
    When a crash occurs
    And the application restarts
    Then PRAGMA integrity_check returns 'ok'
```

**Tools:** SQLite PRAGMA commands

**Acceptance Criteria:** All integrity checks pass

---

#### REL-003: Model API Retry

**Target:** Retry with exponential backoff on 429/5xx errors

**Verification Method:**

| Step | Action                              |
| ---- | ----------------------------------- |
| 1    | Configure mock server to return 429 |
| 2    | Send message                        |
| 3    | Verify retry behavior               |
| 4    | Verify backoff timing               |

**Test Cases:**

```gherkin
Feature: Model API Retry
  As a developer
  I want transient failures to be retried
  So that I don't lose work

  Scenario: Retry on 429
    Given mock model API returns 429
    When I send a message
    Then the system retries up to 3 times
    And backoff delays are 1s, 2s, 4s (±10% jitter)

  Scenario: Max retries exceeded
    Given mock model API returns 429 repeatedly
    When 3 retries fail
    Then an error is shown
    And the partial response is preserved
```

**Tools:** Mock HTTP server

**Acceptance Criteria:** Correct retry behavior with proper backoff

---

#### REL-004: MCP Supervision

**Target:** Auto-restart with exponential backoff

**Verification Method:**

| Step | Action                  |
| ---- | ----------------------- |
| 1    | Connect MCP server      |
| 2    | Kill MCP process        |
| 3    | Verify restart behavior |
| 4    | Verify backoff timing   |

**Test Cases:**

```gherkin
Feature: MCP Supervision
  As a developer
  I want MCP servers to recover from failures
  So that tools remain available

  Scenario: Restart on crash
    Given MCP server "tools" is connected
    When the server process is killed
    Then the server is restarted after 1s
    And the failure count is incremented

  Scenario: Exponential backoff
    Given MCP server has failed 2 times
    When it fails again
    Then restart delay is 4 seconds
    And max 5 attempts are made
```

**Tools:** Custom harness, process monitoring

**Acceptance Criteria:** Correct supervision behavior

---

#### REL-005: Offline Handling

**Target:** Graceful degradation when offline

**Verification Method:**

| Step | Action                         |
| ---- | ------------------------------ |
| 1    | Start application with network |
| 2    | Disconnect network             |
| 3    | Attempt operations             |
| 4    | Verify graceful degradation    |

**Test Cases:**

```gherkin
Feature: Offline Handling
  As a developer
  I want the app to work offline
  So that I can continue working

  Scenario: Offline message send
    Given the network is disconnected
    When I send a message
    Then an offline indicator is shown
    And local data is preserved
    And when network returns, the message is sent

  Scenario: MCP server unavailable
    Given network is disconnected
    Then MCP servers show "disconnected"
    And operations queue for retry
```

**Tools:** Network simulation

**Acceptance Criteria:** Graceful degradation without crashes

---

#### REL-006: Non-Blocking Operations

**Target:** UI thread not blocked during I/O

**Verification Method:**

| Step | Action                       |
| ---- | ---------------------------- |
| 1    | Start heavy I/O operation    |
| 2    | Measure UI thread activity   |
| 3    | Verify UI remains responsive |

**Test Cases:**

```gherkin
Feature: Non-Blocking Operations
  As a developer
  I want I/O not to block the UI
  So that the app stays responsive

  Scenario: Heavy database operation
    Given 1000 conversations are being loaded
    When I interact with the UI
    Then response time is ≤ 16ms
    And no frame drops occur
```

**Tools:** Thread profiler, frame timing

**Acceptance Criteria:** UI thread never blocked > 16ms

---

### 4.3 Security Verification

---

#### SEC-001: API Key Storage

**Target:** API keys only in OS keychain

**Verification Method:**

| Step | Action                              |
| ---- | ----------------------------------- |
| 1    | Store an API key                    |
| 2    | Search database for key pattern     |
| 3    | Search config files for key pattern |
| 4    | Search logs for key pattern         |
| 5    | Verify key exists in OS keychain    |

**Test Cases:**

```gherkin
Feature: API Key Storage Security
  As a security-conscious user
  I want API keys stored securely
  So that they cannot be leaked

  Scenario: Key not in database
    Given an API key is stored
    When I search the database for the key
    Then no matches are found

  Scenario: Key not in config files
    Given an API key is stored
    When I search all config files
    Then no matches are found

  Scenario: Key not in logs
    Given an API key is stored
    When I search all log files
    Then no matches are found

  Scenario: Key in keychain
    Given an API key is stored for provider "Anthropic"
    When I query the OS keychain
    Then the key is found under service "skilldeck-anthropic"
```

**Tools:** grep, file search, keychain CLI

**Acceptance Criteria:** All searches return zero matches; keychain contains key

---

#### SEC-002: Tool Approval Gates

**Target:** All external tools require approval unless configured otherwise

**Verification Method:**

| Step | Action                              |
| ---- | ----------------------------------- |
| 1    | Trigger tool call for each category |
| 2    | Verify approval gate presence       |
| 3    | Attempt to bypass approval          |
| 4    | Verify bypass is blocked            |

**Test Cases:**

```gherkin
Feature: Tool Approval Gates
  As a security-conscious user
  I want tool calls to require approval
  So that I control external access

  Scenario: File read requires approval
    Given tool "read_file" is requested
    When the tool call is processed
    Then an approval card is displayed
    And execution waits for approval

  Scenario: Shell command requires approval
    Given tool "execute_shell" is requested
    When the tool call is processed
    Then an approval card is displayed

  Scenario: Cannot bypass approval
    Given an approval gate is active
    When I attempt to execute the tool without approval
    Then execution is blocked
```

**Tools:** Integration tests

**Acceptance Criteria:** All categories require approval by default

---

#### SEC-003: Telemetry Opt-in

**Target:** No network calls without opt-in

**Verification Method:**

| Step | Action                             |
| ---- | ---------------------------------- |
| 1    | Disable telemetry                  |
| 2    | Monitor network traffic            |
| 3    | Verify no telemetry requests       |
| 4    | Enable telemetry                   |
| 5    | Verify telemetry requests are sent |

**Test Cases:**

```gherkin
Feature: Telemetry Opt-in
  As a privacy-conscious user
  I want telemetry to be opt-in
  So that my data is not sent without consent

  Scenario: No telemetry without opt-in
    Given telemetry is disabled (default)
    When I use the application
    Then no requests to telemetry endpoints are made

  Scenario: Telemetry with opt-in
    Given telemetry is enabled
    When I use the application
    Then anonymized usage data is sent
```

**Tools:** Network monitor (Wireshark, Charles Proxy)

**Acceptance Criteria:** No telemetry without opt-in

---

#### SEC-004: Symlink Skip

**Target:** Symlinked directories are not scanned

**Verification Method:**

| Step | Action                         |
| ---- | ------------------------------ |
| 1    | Create symlink skill directory |
| 2    | Run skill scan                 |
| 3    | Verify symlink is skipped      |
| 4    | Verify warning is logged       |

**Test Cases:**

```gherkin
Feature: Symlink Skip
  As a security-conscious user
  I want symlinked skills to be skipped
  So that directory traversal is prevented

  Scenario: Symlink skill skipped
    Given skill directory "external" is a symlink
    When skill scan runs
    Then "external" is not loaded
    And a warning is logged
```

**Tools:** Integration test

**Acceptance Criteria:** Symlinks skipped with warning

---

#### SEC-005: File Access Restriction

**Target:** Tools cannot access files outside workspace without approval

**Verification Method:**

| Step | Action                                 |
| ---- | -------------------------------------- |
| 1    | Attempt to read file outside workspace |
| 2    | Verify approval gate shows full path   |
| 3    | Verify user can deny                   |

**Test Cases:**

```gherkin
Feature: File Access Restriction
  As a security-conscious user
  I want file access restricted
  So that my files are protected

  Scenario: Read outside workspace requires approval
    Given workspace "/projects/my-app" is open
    When tool requests file "/etc/passwd"
    Then approval card shows full path "/etc/passwd"
    And I can deny the request
```

**Tools:** Integration test

**Acceptance Criteria:** External file access requires approval

---

#### SEC-006: TLS Version

**Target:** TLS 1.2+ for all external connections

**Verification Method:**

| Step | Action                                      |
| ---- | ------------------------------------------- |
| 1    | Capture network traffic                     |
| 2    | Verify TLS version on all HTTPS connections |
| 3    | Attempt connection with TLS 1.0/1.1         |
| 4    | Verify connection is rejected               |

**Test Cases:**

```gherkin
Feature: TLS Version
  As a security-conscious user
  I want all connections to use modern TLS
  So that data is encrypted securely

  Scenario: All connections use TLS 1.2+
    Given I send a message to Claude API
    When the connection is established
    Then TLS version is ≥ 1.2

  Scenario: Reject TLS 1.0/1.1
    Given server only supports TLS 1.1
    When connection is attempted
    Then connection is rejected
```

**Tools:** Network analyzer, OpenSSL s_client

**Acceptance Criteria:** All connections TLS 1.2+

---

#### SEC-007: Dependency Audit

**Target:** No known vulnerabilities in dependencies

**Verification Method:**

| Step | Action                                  |
| ---- | --------------------------------------- |
| 1    | Run cargo audit                         |
| 2    | Run npm audit                           |
| 3    | Verify no critical/high vulnerabilities |

**Test Cases:**

```gherkin
Feature: Dependency Audit
  As a security-conscious user
  I want dependencies to be secure
  So that vulnerabilities are minimized

  Scenario: No known vulnerabilities
    Given dependencies are installed
    When I run security audit
    Then no critical or high vulnerabilities are found
```

**Tools:** cargo audit, npm audit

**Acceptance Criteria:** Clean audit or documented exceptions

---

#### SEC-008: Penetration Testing

**Target:** No critical/high findings from OWASP WSTG

**Verification Method:**

| Step | Action                           |
| ---- | -------------------------------- |
| 1    | Run OWASP ZAP automated scan     |
| 2    | Perform manual penetration tests |
| 3    | Document findings                |
| 4    | Verify remediation               |

**Test Cases:**

```gherkin
Feature: Penetration Testing
  As a security-conscious user
  I want the app to resist attacks
  So that my data is protected

  Scenario: OWASP WSTG desktop tests
    Given the application is running
    When OWASP WSTG tests are executed
    Then no critical findings are present
    And high findings have remediation plan
```

**Tools:** OWASP ZAP, manual testing

**Acceptance Criteria:** No critical/high vulnerabilities

---

### 4.4 Accessibility Verification

---

#### USA-001: Keyboard Navigation

**Target:** All workflows completable via keyboard

**Verification Method:**

| Step | Action                         |
| ---- | ------------------------------ |
| 1    | Disconnect mouse               |
| 2    | Navigate through all workflows |
| 3    | Verify all actions accessible  |

**Test Cases:**

```gherkin
Feature: Keyboard Navigation
  As a user with motor impairments
  I want to use keyboard only
  So that I can use the application

  Scenario: Navigate conversation list
    Given the app is running
    When I use Tab and arrow keys
    Then I can select any conversation
    And I can create a new conversation
    And I can delete a conversation

  Scenario: Navigate message thread
    Given a conversation is open
    When I use keyboard shortcuts
    Then I can scroll through messages
    And I can copy message content
    And I can reply to a message

  Scenario: Command palette via keyboard
    Given the app is running
    When I press Cmd+K
    Then the command palette opens
    And I can navigate with arrow keys
    And I can select with Enter
```

**Tools:** Manual testing

**Acceptance Criteria:** All workflows keyboard-accessible

---

#### USA-002: Screen Reader Compatibility

**Target:** Usable with VoiceOver/NVDA

**Verification Method:**

| Step | Action                       |
| ---- | ---------------------------- |
| 1    | Enable screen reader         |
| 2    | Navigate application         |
| 3    | Verify ARIA labels present   |
| 4    | Verify logical reading order |

**Test Cases:**

```gherkin
Feature: Screen Reader Compatibility
  As a visually impaired user
  I want the app to work with screen readers
  So that I can use it effectively

  Scenario: VoiceOver navigation
    Given VoiceOver is enabled
    When I navigate the app
    Then all interactive elements are announced
    And the reading order is logical
    And ARIA labels are accurate

  Scenario: NVDA navigation
    Given NVDA is enabled
    When I navigate the app
    Then all elements are accessible
```

**Tools:** VoiceOver, NVDA

**Acceptance Criteria:** Usable with screen readers

---

#### USA-003: Color Contrast

**Target:** WCAG 2.1 AA compliance

**Verification Method:**

| Step | Action                                 |
| ---- | -------------------------------------- |
| 1    | Run axe DevTools                       |
| 2    | Test all color combinations            |
| 3    | Verify contrast ratio ≥ 4.5:1 for text |

**Test Cases:**

```gherkin
Feature: Color Contrast
  As a visually impaired user
  I want sufficient contrast
  So that I can read content

  Scenario: Text contrast
    Given the app is displayed
    When I test text contrast
    Then all text has contrast ratio ≥ 4.5:1
    And large text has ratio ≥ 3:1
```

**Tools:** axe DevTools

**Acceptance Criteria:** WCAG 2.1 AA compliant

---

#### USA-004: Focus Indicators

**Target:** Visible focus ring on all interactive elements

**Verification Method:**

| Step | Action                         |
| ---- | ------------------------------ |
| 1    | Tab through all elements       |
| 2    | Verify visible focus indicator |
| 3    | Test high contrast mode        |

**Test Cases:**

```gherkin
Feature: Focus Indicators
  As a keyboard user
  I want visible focus indicators
  So that I know where I am

  Scenario: Focus ring visible
    Given I tab through the app
    When focus moves to an element
    Then a visible focus ring appears
    And the ring is 2px minimum

  Scenario: High contrast mode
    Given OS high contrast mode is enabled
    When focus moves
    Then focus indicator is visible
```

**Tools:** Manual testing

**Acceptance Criteria:** All elements have visible focus

---

#### USA-005: Onboarding Completion

**Target:** 90% of users complete onboarding in < 5 minutes

**Verification Method:**

| Step | Action                          |
| ---- | ------------------------------- |
| 1    | Recruit 10 first-time users     |
| 2    | Ask them to complete onboarding |
| 3    | Measure completion time         |
| 4    | Record success rate             |

**Test Cases:**

```gherkin
Feature: Onboarding Usability
  As a new user
  I want to complete onboarding quickly
  So that I can start using the app

  Scenario: First-time user onboarding
    Given 10 first-time users
    When they complete onboarding
    Then 9+ users complete in < 5 minutes
    And 90%+ success rate
```

**Tools:** Usability study

**Acceptance Criteria:** 90% success rate in < 5 minutes

---

## 5. Test Plans & Test Case Specifications

### 5.1 Test Plan

| Field                         | Value                                                         |
| ----------------------------- | ------------------------------------------------------------- |
| **Test Plan Identifier**      | TP-SKILLDECK-V1-001                                           |
| **Introduction**              | This plan defines the verification approach for SkillDeck v1  |
| **Test Items**                | skilldeck-core crate, Tauri shell, React frontend             |
| **Features to be Tested**     | All Must and Should requirements                              |
| **Features NOT to be Tested** | Won't requirements, deferred TBDs                             |
| **Approach**                  | Risk-based, automation-first, test pyramid                    |
| **Pass/Fail Criteria**        | All Must verified; ≥90% Should verified; no P0/P1 bugs        |
| **Suspension Criteria**       | Blocker bug blocks further testing                            |
| **Resumption Criteria**       | Bug fixed and verified                                        |
| **Test Deliverables**         | Test reports, coverage reports, RTM                           |
| **Environment**               | macOS 11+, Windows 10+, Linux (Ubuntu 22.04), 8-core/16GB/SSD |
| **Schedule**                  | Aligned with sprints and release milestones                   |
| **Risks**                     | Environment setup; MCP ecosystem instability                  |
| **Approvals**                 | Project Lead, QA Lead                                         |

### 5.2 Entry/Exit Criteria

**Entry Criteria:**

- Code merged to test branch
- CI build passing
- Test environment provisioned
- Test data available
- Test cases reviewed

**Exit Criteria:**

- 100% Must requirements verified
- ≥90% Should requirements verified
- No open P0 or P1 defects
- Coverage targets met:
  - Rust line coverage ≥ 80%
  - React line coverage ≥ 75%
  - Branch coverage ≥ 70%
- Performance NFRs validated
- Security scan clean
- Accessibility audit passed

---

## 6. Requirements Traceability Matrix

### 6.1 Full Matrix by Requirement Category

---

#### 6.1.1 Conversation Management Requirements

| REQ ID       | Description                          | Priority | Test Case(s)          | Verification Method | Status |
| ------------ | ------------------------------------ | -------- | --------------------- | ------------------- | ------ |
| REQ-FUNC-001 | Create conversation with profile     | Must     | SC-FUNC-001           | Test                | —      |
| REQ-FUNC-002 | Select conversation from sidebar     | Must     | SC-FUNC-002           | Test                | —      |
| REQ-FUNC-003 | Display messages in branch structure | Must     | SC-FUNC-002           | Test                | —      |
| REQ-FUNC-004 | Rename conversation                  | Should   | TC-FUNC-004           | Test                | —      |
| REQ-FUNC-005 | Archive conversation                 | Should   | TC-FUNC-005           | Test                | —      |
| REQ-FUNC-010 | Send message triggers agent loop     | Must     | SC-FUNC-003           | Test                | —      |
| REQ-FUNC-011 | Build context and call provider      | Must     | SC-FUNC-003           | Test                | —      |
| REQ-FUNC-012 | Stream tokens with < 100ms latency   | Must     | SC-FUNC-003, PERF-002 | Test                | —      |
| REQ-FUNC-013 | Persist assistant message            | Must     | SC-FUNC-003           | Test                | —      |
| REQ-FUNC-014 | Display error with action            | Must     | SC-FUNC-004           | Test                | —      |
| REQ-FUNC-015 | Cancel streaming response            | Must     | SC-FUNC-003           | Test                | —      |
| REQ-FUNC-020 | Create branch from message           | Must     | SC-FUNC-005           | Test                | —      |
| REQ-FUNC-021 | Display branch navigator             | Must     | SC-FUNC-006           | Test                | —      |
| REQ-FUNC-022 | Navigate between branches            | Must     | SC-FUNC-006           | Test                | —      |
| REQ-FUNC-023 | Merge branch to main thread          | Should   | SC-FUNC-007           | Test                | —      |
| REQ-FUNC-024 | Discard branch                       | Should   | SC-FUNC-007           | Test                | —      |
| REQ-FUNC-025 | Hide navigator when no branches      | Must     | SC-FUNC-006           | Test                | —      |
| REQ-FUNC-030 | Slash command palette                | Should   | SC-FUNC-008           | Test                | —      |
| REQ-FUNC-031 | Skill selector with @                | Should   | SC-FUNC-008           | Test                | —      |
| REQ-FUNC-032 | File selector with #                 | Should   | SC-FUNC-009           | Test                | —      |
| REQ-FUNC-033 | Global command palette (Cmd+K)       | Should   | SC-FUNC-033           | Test                | —      |
| REQ-FUNC-034 | Send with Cmd+Enter                  | Must     | TC-FUNC-034           | Test                | —      |
| REQ-FUNC-035 | Edit previous message with up arrow  | Should   | TC-FUNC-035           | Test                | —      |
| REQ-FUNC-036 | Attach file to message               | Should   | SC-FUNC-009           | Test                | —      |
| REQ-FUNC-037 | Paste image from clipboard           | Should   | SC-FUNC-009           | Test                | —      |

---

#### 6.1.2 Skill System Requirements

| REQ ID       | Description                       | Priority | Test Case(s)         | Verification Method | Status |
| ------------ | --------------------------------- | -------- | -------------------- | ------------------- | ------ |
| REQ-FUNC-040 | Scan skill directories on startup | Must     | SC-FUNC-010          | Test                | —      |
| REQ-FUNC-041 | Parse SKILL.md frontmatter        | Must     | SC-FUNC-010          | Test                | —      |
| REQ-FUNC-042 | Skip malformed SKILL.md           | Must     | SC-FUNC-010          | Test                | —      |
| REQ-FUNC-043 | Skip symlinked skill directories  | Must     | SC-FUNC-011, SEC-004 | Test                | —      |
| REQ-FUNC-045 | Resolve skills by priority        | Must     | SC-FUNC-012          | Test                | —      |
| REQ-FUNC-046 | Log shadowed skills               | Should   | SC-FUNC-012          | Test                | —      |
| REQ-FUNC-047 | Display active skills             | Must     | TC-FUNC-047          | Test                | —      |
| REQ-FUNC-050 | Detect skill changes within 200ms | Should   | SC-FUNC-013          | Test                | —      |
| REQ-FUNC-051 | Reload modified skill             | Should   | SC-FUNC-013          | Test                | —      |
| REQ-FUNC-052 | Remove deleted skill              | Should   | SC-FUNC-013          | Test                | —      |
| REQ-FUNC-055 | Enable skill for profile          | Must     | SC-FUNC-014          | Test                | —      |
| REQ-FUNC-056 | Disable skill                     | Must     | SC-FUNC-014          | Test                | —      |
| REQ-FUNC-057 | Activate skill via @ mention      | Should   | SC-FUNC-014          | Test                | —      |

---

#### 6.1.3 MCP Integration Requirements

| REQ ID       | Description                        | Priority | Test Case(s)         | Verification Method | Status |
| ------------ | ---------------------------------- | -------- | -------------------- | ------------------- | ------ |
| REQ-FUNC-060 | Discover MCP servers on localhost  | Should   | SC-FUNC-015          | Test                | —      |
| REQ-FUNC-061 | Scan with 5s timeout per port      | Should   | SC-FUNC-015          | Test                | —      |
| REQ-FUNC-062 | Display discovered servers         | Should   | SC-FUNC-015          | Test                | —      |
| REQ-FUNC-065 | Connect to MCP server              | Must     | SC-FUNC-016          | Test                | —      |
| REQ-FUNC-066 | Discover tools on connect          | Must     | SC-FUNC-016          | Test                | —      |
| REQ-FUNC-067 | Display connection error           | Must     | SC-FUNC-016          | Test                | —      |
| REQ-FUNC-068 | Timeout after 30s                  | Must     | TC-FUNC-068          | Test                | —      |
| REQ-FUNC-070 | Monitor MCP server health          | Must     | SC-FUNC-017, REL-004 | Test                | —      |
| REQ-FUNC-071 | Restart with backoff               | Must     | SC-FUNC-017          | Test                | —      |
| REQ-FUNC-072 | Mark failed after max retries      | Must     | SC-FUNC-017          | Test                | —      |
| REQ-FUNC-073 | Manual reconnect                   | Should   | SC-FUNC-017          | Test                | —      |
| REQ-FUNC-075 | Determine approval requirement     | Must     | SC-FUNC-018          | Test                | —      |
| REQ-FUNC-076 | Display approval card              | Must     | SC-FUNC-019          | Test                | —      |
| REQ-FUNC-077 | Execute approved tool              | Must     | SC-FUNC-019          | Test                | —      |
| REQ-FUNC-078 | Validate edited parameters         | Should   | SC-FUNC-019          | Test                | —      |
| REQ-FUNC-079 | Record denial and notify model     | Must     | SC-FUNC-019          | Test                | —      |
| REQ-FUNC-080 | Timeout tool execution at 60s      | Must     | SC-FUNC-020          | Test                | —      |
| REQ-FUNC-081 | Auto-approve configured categories | Should   | SC-FUNC-018          | Test                | —      |

---

#### 6.1.4 Workflow Requirements

| REQ ID       | Description                           | Priority | Test Case(s) | Verification Method | Status |
| ------------ | ------------------------------------- | -------- | ------------ | ------------------- | ------ |
| REQ-FUNC-085 | Define workflow with DAG              | Should   | SC-FUNC-021  | Test                | —      |
| REQ-FUNC-086 | Reject workflow with cycle            | Should   | SC-FUNC-021  | Test                | —      |
| REQ-FUNC-087 | Support three patterns                | Should   | TC-FUNC-087  | Test                | —      |
| REQ-FUNC-090 | Execute in topological order          | Should   | SC-FUNC-022  | Test                | —      |
| REQ-FUNC-091 | Execute independent steps in parallel | Should   | SC-FUNC-023  | Test                | —      |
| REQ-FUNC-092 | Display DAG visualization             | Should   | TC-FUNC-092  | Test                | —      |
| REQ-FUNC-093 | Block dependent steps on failure      | Should   | SC-FUNC-022  | Test                | —      |
| REQ-FUNC-094 | Notify workflow completion            | Should   | TC-FUNC-094  | Test                | —      |
| REQ-FUNC-095 | Spawn subagent for step               | Should   | SC-FUNC-024  | Test                | —      |
| REQ-FUNC-096 | Display subagent result card          | Should   | SC-FUNC-024  | Test                | —      |
| REQ-FUNC-097 | Merge subagent result                 | Should   | SC-FUNC-024  | Test                | —      |
| REQ-FUNC-098 | Discard subagent result               | Should   | SC-FUNC-024  | Test                | —      |
| REQ-FUNC-099 | Display subagent error                | Should   | SC-FUNC-024  | Test                | —      |
| REQ-FUNC-100 | Run evaluator-optimizer loop          | Should   | SC-FUNC-025  | Test                | —      |
| REQ-FUNC-101 | Feed feedback to generator            | Should   | SC-FUNC-025  | Test                | —      |
| REQ-FUNC-102 | Terminate at max iterations           | Should   | SC-FUNC-025  | Test                | —      |

---

#### 6.1.5 Profile & Configuration Requirements

| REQ ID       | Description                        | Priority | Test Case(s)         | Verification Method | Status |
| ------------ | ---------------------------------- | -------- | -------------------- | ------------------- | ------ |
| REQ-FUNC-105 | Create profile                     | Must     | SC-FUNC-026          | Test                | —      |
| REQ-FUNC-106 | Switch active profile              | Must     | SC-FUNC-026          | Test                | —      |
| REQ-FUNC-107 | Duplicate profile                  | Should   | SC-FUNC-026          | Test                | —      |
| REQ-FUNC-108 | Delete profile                     | Should   | SC-FUNC-026          | Test                | —      |
| REQ-FUNC-109 | Use default profile                | Must     | SC-FUNC-026          | Test                | —      |
| REQ-FUNC-110 | Store key in OS keychain           | Must     | SC-FUNC-027, SEC-001 | Test                | —      |
| REQ-FUNC-111 | Retrieve key at runtime            | Must     | SC-FUNC-027          | Test                | —      |
| REQ-FUNC-112 | Delete key from keychain           | Must     | SC-FUNC-027          | Test                | —      |
| REQ-FUNC-113 | Handle unavailable keychain        | Must     | SC-FUNC-027          | Test                | —      |
| REQ-FUNC-115 | Configure tool approval categories | Should   | SC-FUNC-028          | Test                | —      |
| REQ-FUNC-116 | Auto-approve by category           | Should   | SC-FUNC-028          | Test                | —      |
| REQ-FUNC-117 | Apply Safe Mode preset             | Should   | SC-FUNC-028          | Test                | —      |
| REQ-FUNC-118 | Apply Trusted Environment preset   | Should   | SC-FUNC-028          | Test                | —      |

---

#### 6.1.6 Workspace Management Requirements

| REQ ID       | Description                     | Priority | Test Case(s) | Verification Method | Status |
| ------------ | ------------------------------- | -------- | ------------ | ------------------- | ------ |
| REQ-FUNC-120 | Detect project type             | Must     | SC-FUNC-029  | Test                | —      |
| REQ-FUNC-121 | Load context files              | Must     | SC-FUNC-029  | Test                | —      |
| REQ-FUNC-122 | Load workspace skills           | Must     | SC-FUNC-029  | Test                | —      |
| REQ-FUNC-123 | Respect .gitignore              | Should   | TC-FUNC-123  | Test                | —      |
| REQ-FUNC-125 | Support multiple workspaces     | Should   | SC-FUNC-030  | Test                | —      |
| REQ-FUNC-126 | Reload skills on switch         | Should   | SC-FUNC-030  | Test                | —      |
| REQ-FUNC-127 | Tag conversation with workspace | Should   | SC-FUNC-030  | Test                | —      |
| REQ-FUNC-128 | Preserve on workspace close     | Should   | SC-FUNC-030  | Test                | —      |

---

#### 6.1.7 Export & Search Requirements

| REQ ID       | Description                   | Priority | Test Case(s)          | Verification Method | Status |
| ------------ | ----------------------------- | -------- | --------------------- | ------------------- | ------ |
| REQ-FUNC-130 | Export as Markdown            | Should   | SC-FUNC-031           | Test                | —      |
| REQ-FUNC-131 | Export as JSON                | Should   | SC-FUNC-031           | Test                | —      |
| REQ-FUNC-132 | Export multiple as zip        | Should   | SC-FUNC-031           | Test                | —      |
| REQ-FUNC-133 | Handle export error           | Should   | SC-FUNC-031           | Test                | —      |
| REQ-FUNC-135 | Full-text search < 500ms      | Should   | SC-FUNC-032, PERF-004 | Test                | —      |
| REQ-FUNC-136 | Highlight and show context    | Should   | SC-FUNC-032           | Test                | —      |
| REQ-FUNC-137 | Use SQLite FTS when available | Should   | SC-FUNC-032           | Test                | —      |

---

#### 6.1.8 Clipboard & Notification Requirements

| REQ ID       | Description                      | Priority | Test Case(s) | Verification Method | Status |
| ------------ | -------------------------------- | -------- | ------------ | ------------------- | ------ |
| REQ-FUNC-140 | Copy message as Markdown         | Must     | SC-FUNC-033  | Test                | —      |
| REQ-FUNC-141 | Copy code as plain text          | Must     | SC-FUNC-033  | Test                | —      |
| REQ-FUNC-142 | Paste text and image             | Must     | SC-FUNC-033  | Test                | —      |
| REQ-FUNC-145 | Workflow completion notification | Should   | SC-FUNC-034  | Test                | —      |
| REQ-FUNC-146 | Tool approval notification       | Should   | SC-FUNC-034  | Test                | —      |
| REQ-FUNC-147 | Error notification               | Should   | SC-FUNC-034  | Test                | —      |
| REQ-FUNC-148 | Respect notification setting     | Should   | SC-FUNC-034  | Test                | —      |

---

#### 6.1.9 Built-in Tools Requirements

| REQ ID       | Description               | Priority | Test Case(s) | Verification Method | Status |
| ------------ | ------------------------- | -------- | ------------ | ------------------- | ------ |
| REQ-FUNC-150 | Load skill by name        | Should   | SC-FUNC-035  | Test                | —      |
| REQ-FUNC-151 | No approval for loadSkill | Should   | SC-FUNC-035  | Test                | —      |
| REQ-FUNC-152 | Error if skill not found  | Should   | SC-FUNC-035  | Test                | —      |
| REQ-FUNC-155 | Spawn subagent            | Should   | SC-FUNC-036  | Test                | —      |
| REQ-FUNC-156 | Display subagent card     | Should   | SC-FUNC-036  | Test                | —      |
| REQ-FUNC-157 | No approval for spawn     | Should   | SC-FUNC-036  | Test                | —      |
| REQ-FUNC-160 | Merge subagent results    | Should   | SC-FUNC-037  | Test                | —      |
| REQ-FUNC-161 | Individual merge controls | Should   | SC-FUNC-037  | Test                | —      |

---

#### 6.1.10 Non-Functional Requirements

| REQ ID       | Description                  | Priority | Test Case(s)                          | Verification Method | Status |
| ------------ | ---------------------------- | -------- | ------------------------------------- | ------------------- | ------ |
| REQ-PERF-001 | Startup < 3s                 | Must     | PERF-001                              | Test                | —      |
| REQ-PERF-002 | Render < 100ms               | Must     | PERF-002                              | Test                | —      |
| REQ-PERF-003 | 60fps UI                     | Must     | PERF-003                              | Test                | —      |
| REQ-PERF-004 | Search < 500ms               | Should   | PERF-004                              | Test                | —      |
| REQ-PERF-005 | Load 500 msg < 2s            | Should   | PERF-005                              | Test                | —      |
| REQ-PERF-006 | 100 MCP servers              | Should   | PERF-006                              | Test                | —      |
| REQ-REL-001  | No data loss on crash        | Must     | REL-001                               | Test                | —      |
| REQ-REL-002  | SQLite WAL mode              | Must     | REL-002                               | Test                | —      |
| REQ-REL-003  | API retry with backoff       | Must     | REL-003                               | Test                | —      |
| REQ-REL-004  | MCP supervision              | Must     | REL-004                               | Test                | —      |
| REQ-REL-005  | Offline graceful degradation | Should   | REL-005                               | Test                | —      |
| REQ-REL-006  | Non-blocking operations      | Must     | REL-006                               | Test                | —      |
| REQ-SEC-001  | Keys in keychain only        | Must     | SEC-001                               | Test                | —      |
| REQ-SEC-002  | Tool approval gates          | Must     | SEC-002                               | Test                | —      |
| REQ-SEC-003  | Opt-in telemetry             | Must     | SEC-003                               | Test                | —      |
| REQ-SEC-004  | Symlink skip                 | Must     | SEC-004                               | Test                | —      |
| REQ-SEC-005  | File access restriction      | Should   | SEC-005                               | Test                | —      |
| REQ-SEC-006  | TLS 1.2+                     | Must     | SEC-006                               | Test                | —      |
| REQ-USA-001  | Keyboard navigation          | Must     | USA-001                               | Test                | —      |
| REQ-USA-002  | Error messages with action   | Must     | SC-FUNC-004, SC-FUNC-016, SC-FUNC-031 | Test                | —      |
| REQ-USA-003  | Onboarding < 5 min           | Must     | USA-005                               | Test                | —      |
| REQ-USA-004  | i18n support                 | Should   | TC-USA-004                            | Test                | —      |
| REQ-USA-005  | Token counter display        | Should   | TC-USA-005                            | Test                | —      |
| REQ-USA-006  | Token usage per message      | Should   | TC-USA-006                            | Test                | —      |
| REQ-USA-007  | Visual feedback for long ops | Must     | TC-USA-007                            | Test                | —      |

---

### 6.2 Summary Statistics

| Category        | Total   | Must   | Should | Test Cases | Scenarios |
| --------------- | ------- | ------ | ------ | ---------- | --------- |
| Functional      | 101     | 64     | 37     | 120+       | 37        |
| Performance     | 6       | 4      | 2      | 6          | 6         |
| Reliability     | 6       | 5      | 1      | 6          | 6         |
| Security        | 6       | 5      | 1      | 8          | 8         |
| Usability       | 7       | 4      | 3      | 7          | 5         |
| Maintainability | 3       | 2      | 1      | —          | —         |
| Compatibility   | 3       | 1      | 2      | —          | —         |
| **Total**       | **132** | **85** | **47** | **147+**   | **62**    |

---

## 7. Exploratory Testing Charters

### ET-001: Error Handling When Model API Unavailable

| Field              | Content                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Charter ID**     | ET-001                                                                                                                              |
| **Mission**        | Explore error handling when the model API is completely unavailable                                                                 |
| **Timebox**        | 90 minutes                                                                                                                          |
| **Scope**          | In: Message sending, retry behavior, error messages, recovery                                                                       |
| **Out of Scope**   | Other API providers, MCP tools                                                                                                      |
| **Setup**          | Configure invalid API endpoint, start app                                                                                           |
| **Focus Areas**    | Timeout behavior, error messages clarity, ability to retry, partial state preservation                                              |
| **Test Ideas**     | - Send message with completely invalid endpoint<br>- Kill network mid-stream<br>- Rate limit simulation<br>- Long timeout scenarios |
| **Notes**          | —                                                                                                                                   |
| **Anomalies**      | —                                                                                                                                   |
| **Conclusion**     | —                                                                                                                                   |
| **Recommendation** | —                                                                                                                                   |

---

### ET-002: Branch Creation with 50+ Messages

| Field              | Content                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Charter ID**     | ET-002                                                                                                                                        |
| **Mission**        | Explore branch creation and navigation in large conversations                                                                                 |
| **Timebox**        | 60 minutes                                                                                                                                    |
| **Scope**          | In: Branch creation, navigation, merge/discard, UI performance                                                                                |
| **Out of Scope**   | Search, export, MCP tools                                                                                                                     |
| **Setup**          | Create conversation with 50+ messages and multiple branch points                                                                              |
| **Focus Areas**    | UI responsiveness, scroll position preservation, branch navigator accuracy                                                                    |
| **Test Ideas**     | - Create branch at message 5, 15, 25, 40<br>- Navigate rapidly between branches<br>- Merge after many branches<br>- Discard multiple branches |
| **Notes**          | —                                                                                                                                             |
| **Anomalies**      | —                                                                                                                                             |
| **Conclusion**     | —                                                                                                                                             |
| **Recommendation** | —                                                                                                                                             |

---

### ET-003: MCP Server Failure Recovery

| Field              | Content                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Charter ID**     | ET-003                                                                                                                                |
| **Mission**        | Explore MCP server failure and recovery scenarios                                                                                     |
| **Timebox**        | 90 minutes                                                                                                                            |
| **Scope**          | In: MCP server crashes, restart behavior, tool availability, error messages                                                           |
| **Out of Scope**   | Workflow execution, other providers                                                                                                   |
| **Setup**          | Connect multiple MCP servers, prepare kill scripts                                                                                    |
| **Focus Areas**    | Restart timing, backoff behavior, tool availability during restart, notification clarity                                              |
| **Test Ideas**     | - Kill one MCP process, observe restart<br>- Kill same server multiple times<br>- Kill all MCP servers<br>- Corrupt MCP server binary |
| **Notes**          | —                                                                                                                                     |
| **Anomalies**      | —                                                                                                                                     |
| **Conclusion**     | —                                                                                                                                     |
| **Recommendation** | —                                                                                                                                     |

---

### ET-004: Workflow Execution with Conflicting Subagent Results

| Field              | Content                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Charter ID**     | ET-004                                                                                                                                   |
| **Mission**        | Explore workflow behavior when subagents produce conflicting results                                                                     |
| **Timebox**        | 60 minutes                                                                                                                               |
| **Scope**          | In: Parallel workflows, subagent cards, merge/discard, aggregation                                                                       |
| **Out of Scope**   | Sequential workflows, MCP tools                                                                                                          |
| **Setup**          | Create workflow with parallel subagents that may disagree                                                                                |
| **Focus Areas**    | Conflict detection, merge UI, error handling, aggregation quality                                                                        |
| **Test Ideas**     | - Run workflow with intentionally conflicting prompts<br>- Merge one, discard others<br>- All subagents fail<br>- One subagent times out |
| **Notes**          | —                                                                                                                                        |
| **Anomalies**      | —                                                                                                                                        |
| **Conclusion**     | —                                                                                                                                        |
| **Recommendation** | —                                                                                                                                        |

---

### ET-005: Skill Resolution with 100+ Skills

| Field              | Content                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Charter ID**     | ET-005                                                                                                      |
| **Mission**        | Explore skill system behavior with many skills across sources                                               |
| **Timebox**        | 60 minutes                                                                                                  |
| **Scope**          | In: Skill loading, resolution, UI performance, shadowing                                                    |
| **Out of Scope**   | Workflow, MCP                                                                                               |
| **Setup**          | Create 100+ skill files across 4 source directories                                                         |
| **Focus Areas**    | Startup time, skill list performance, shadow warnings, memory usage                                         |
| **Test Ideas**     | - Load app with 100 skills<br>- Many shadowed skills<br>- Rapidly modify skill files<br>- Delete all skills |
| **Notes**          | —                                                                                                           |
| **Anomalies**      | —                                                                                                           |
| **Conclusion**     | —                                                                                                           |
| **Recommendation** | —                                                                                                           |

---

### ET-006: Onboarding for Non-Technical Users

| Field              | Content                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Charter ID**     | ET-006                                                                                                                             |
| **Mission**        | Explore onboarding experience from a non-technical perspective                                                                     |
| **Timebox**        | 60 minutes                                                                                                                         |
| **Scope**          | In: Onboarding wizard, Playground, error messages                                                                                  |
| **Out of Scope**   | Advanced features, MCP configuration                                                                                               |
| **Setup**          | Fresh install, no prior knowledge assumption                                                                                       |
| **Focus Areas**    | Clarity of instructions, error handling, time to first success, confusion points                                                   |
| **Test Ideas**     | - Enter invalid API key<br>- Skip optional steps<br>- Try to use features before completing setup<br>- Network issues during setup |
| **Notes**          | —                                                                                                                                  |
| **Anomalies**      | —                                                                                                                                  |
| **Conclusion**     | —                                                                                                                                  |
| **Recommendation** | —                                                                                                                                  |

---

### ET-007: Offline Behavior and Reconnection

| Field              | Content                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Charter ID**     | ET-007                                                                                                                  |
| **Mission**        | Explore app behavior when going offline and reconnecting                                                                |
| **Timebox**        | 90 minutes                                                                                                              |
| **Scope**          | In: Offline mode, cached data, reconnection, pending operations                                                         |
| **Out of Scope**   | Performance testing, security testing                                                                                   |
| **Setup**          | Start with network, prepare to disconnect                                                                               |
| **Focus Areas**    | Graceful degradation, data preservation, reconnection behavior                                                          |
| **Test Ideas**     | - Send message while offline<br>- Disconnect mid-stream<br>- Reconnect with pending operations<br>- Long offline period |
| **Notes**          | —                                                                                                                       |
| **Anomalies**      | —                                                                                                                       |
| **Conclusion**     | —                                                                                                                       |
| **Recommendation** | —                                                                                                                       |

---

### ET-008: Token Counter Accuracy at Context Limit

| Field              | Content                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Charter ID**     | ET-008                                                                                                                                 |
| **Mission**        | Explore token counter behavior near context window limits                                                                              |
| **Timebox**        | 60 minutes                                                                                                                             |
| **Scope**          | In: Token counting, context window limits, truncation, warnings                                                                        |
| **Out of Scope**   | Other NFRs                                                                                                                             |
| **Setup**          | Model with known context window, long conversation                                                                                     |
| **Focus Areas**    | Counter accuracy, user warnings, truncation behavior                                                                                   |
| **Test Ideas**     | - Build conversation approaching limit<br>- Observe counter updates<br>- Hit limit, observe behavior<br>- Truncation vs. summarization |
| **Notes**          | —                                                                                                                                      |
| **Anomalies**      | —                                                                                                                                      |
| **Conclusion**     | —                                                                                                                                      |
| **Recommendation** | —                                                                                                                                      |

---

## 8. Living Documentation Strategy

### 8.1 Principles

| Principle                  | Implementation                                               |
| -------------------------- | ------------------------------------------------------------ |
| **Single source of truth** | BDD feature files in `tests/features/` alongside code        |
| **Executable specs**       | Gherkin scenarios run as tests via Rust test framework       |
| **Auto-generated docs**    | Reports generated from test runs, published to internal wiki |
| **Version controlled**     | All specs in Git, reviewed via PR                            |
| **Updated with code**      | Specs updated as part of feature development                 |

### 8.2 Directory Structure

```
skilldeck/
├── tests/
│   ├── features/                  # BDD feature files
│   │   ├── conversations/
│   │   │   ├── create-conversation.feature
│   │   │   ├── send-message.feature
│   │   │   ├── branch-conversation.feature
│   │   │   └── message-input.feature
│   │   ├── skills/
│   │   │   ├── load-skill.feature
│   │   │   ├── resolve-skills.feature
│   │   │   └── hot-reload.feature
│   │   ├── mcp/
│   │   │   ├── connect-mcp.feature
│   │   │   ├── supervise-mcp.feature
│   │   │   └── tool-approval.feature
│   │   ├── workflows/
│   │   │   ├── define-workflow.feature
│   │   │   ├── execute-workflow.feature
│   │   │   └── subagent-lifecycle.feature
│   │   ├── profiles/
│   │   │   ├── manage-profiles.feature
│   │   │   └── api-key-storage.feature
│   │   ├── workspaces/
│   │   │   ├── detect-workspace.feature
│   │   │   └── multi-workspace.feature
│   │   ├── export/
│   │   │   ├── export-conversation.feature
│   │   │   └── search.feature
│   │   └── built-in-tools/
│   │       ├── load-skill-tool.feature
│   │       ├── spawn-subagent.feature
│   │       └── merge-results.feature
│   ├── integration/               # Integration tests
│   │   ├── agent_loop.rs
│   │   ├── skill_resolver.rs
│   │   ├── workflow_executor.rs
│   │   ├── mcp_client.rs
│   │   └── provider_retry.rs
│   ├── performance/               # Performance tests
│   │   ├── startup_time.rs
│   │   ├── render_latency.rs
│   │   ├── search_performance.rs
│   │   └── concurrent_mcp.rs
│   ├── security/                  # Security tests
│   │   ├── keychain_storage.rs
│   │   ├── symlink_skip.rs
│   │   └── file_access.rs
│   └── accessibility/             # Accessibility tests
│       ├── keyboard_nav.rs
│       └── contrast.rs
├── docs/
│   └── test-reports/              # Generated reports
│       ├── coverage/
│       ├── bdd-report.html
│       └── performance-report.html
└── src/                           # React frontend
    └── __tests__/                 # Component tests
        ├── components/
        │   ├── conversation-list.test.tsx
        │   ├── message-bubble.test.tsx
        │   ├── branch-nav.test.tsx
        │   ├── tool-approval-card.test.tsx
        │   ├── subagent-card.test.tsx
        │   └── message-input.test.tsx
        ├── hooks/
        │   ├── use-conversations.test.ts
        │   ├── use-agent-stream.test.ts
        │   └── use-messages.test.ts
        └── lib/
            └── invoke.test.ts
```

### 8.3 Tooling

| Tool                         | Purpose                     |
| ---------------------------- | --------------------------- |
| **cargo test**               | Rust unit/integration tests |
| **Vitest + Testing Library** | React component tests       |
| **Cucumber-like runner**     | BDD scenario execution      |
| **k6**                       | Performance tests           |
| **axe DevTools**             | Accessibility tests         |
| **cargo tarpaulin**          | Coverage reports            |
| **GitHub Actions**           | CI/CD automation            |

---

## Summary

### Document Statistics

| Category             | Count |
| -------------------- | ----- |
| BDD Scenarios        | 37    |
| Performance Tests    | 6     |
| Reliability Tests    | 6     |
| Security Tests       | 8     |
| Accessibility Tests  | 5     |
| Exploratory Charters | 8     |
| Requirements Traced  | 132   |
| Test Cases           | 147+  |

### Coverage Summary

| Requirement Priority | Total   | Traced  | Coverage |
| -------------------- | ------- | ------- | -------- |
| Must                 | 85      | 85      | 100%     |
| Should               | 47      | 47      | 100%     |
| Won't                | 0       | 0       | —        |
| **Total**            | **132** | **132** | **100%** |
