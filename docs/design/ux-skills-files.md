# User Research Study Plan: "Skill Marketplace" Chat Integration

## 🎯 Research Overview

### The Insight: "Skill" is a Noun, Not Just a File
Based on the `skills-marketplace` documentation, a "Skill" is not merely a file to be uploaded; it is a structured, versioned, and validated entity (defined by `SKILL.md`) that exists within a complex ecosystem (Registry, Workspace, Personal).

**The UX Problem**: The previous "Skill File" button suggested a simple file upload, ignoring the rich marketplace architecture (Trust Badges, Linting, Local vs. Remote resolution) defined in the system specs.

**The Solution**: We must pivot from "File Upload" to **"Skill Activation"**. The chat input is the command line for the agent; attaching a skill changes the agent's *capabilities*, not just its context.

---

## 📋 Phase 1: Mental Model Alignment

### A. The "Skill" vs. "File" Distinction
Users need to understand the difference between the two triggers:
*   **`#` (Context/File)**: Injects *data* (PDFs, CSVs, Codebases). The agent *reads* this.
*   **`@` (Capability/Skill)**: Injects *behavior* (Instructions, Prompts, Tools). The agent *acts* using this.

### B. The Resolution Order (The "Shadowing" Concept)
The documentation specifies a strict priority: **Workspace > Personal > Team > Registry**.
*   **User Expectation**: "I want to use my local version of 'Data Cleaner'."
*   **System Reality**: The system must check `./.skilldeck/skills/` first, then `~/.agents/skills/`, then the Platform Registry.
*   **UX Challenge**: The UI must clearly show *which version* of the skill is being activated to prevent "Skill Shadowing" confusion (where a local skill overrides a registry one silently).

---

## 🚀 Phase 2: UX Implementation Plan

### Feature 1: The `@` Skill Selector (Command Palette)

**Interaction Specification:**
When the user types `@` or clicks the "Skill" icon in the bottom bar:

1.  **Trigger**: A "Skill Command Palette" opens.
2.  **Search Behavior**: The search queries the **Merged Skill List** (Local + Registry).
    *   *Note*: This aligns with `Chunk 4` of the implementation plan ("Merge: local overrides registry").
3.  **Visual Hierarchy (The "Trust Badge" Integration)**:
    *   **Local Skills**: Display a "Local" badge (Green/Blue) and the path (`./workspace` or `~/.agents`).
    *   **Registry Skills**: Display the "Trust Badge" (Security Score) and version number.
4.  **Selection Result**: A "Skill Chip" is added to the chat input.

**Example UI State:**
> User types: `@Data` > System shows:
> 1.  **[Local]** `Data-Cleaner` (Workspace) - *v1.2 (Modified 2 days ago)*
> 2.  **[Registry]** `Data-Visualizer` (Verified Safe) - *v3.1 by @data-org*

### Feature 2: The "Skill Chip" & Validation Feedback

Since the system includes a Linter (`skilldeck-lint`), the chat input is the first line of defense.

**Interaction Flow:**
1.  User selects a Skill (e.g., `@Experimental-Script`).
2.  System runs `lint_skill` in the background (Tauri Command).
3.  **If Warnings Exist**: The Skill Chip turns **Yellow**.
    *   *Action*: Clicking the chip opens a popover showing the `LintWarning` message and `suggested_fix`.
4.  **If Errors Exist**: The Skill Chip turns **Red**.
    *   *Action*: The "Send" button is disabled until the skill is removed or the error is acknowledged (if allowed).

### Feature 3: Bottom Bar "Skill" Button

This button serves as the "Discovery" entry point.
*   **Action**: Opens a full "Skill Browser" modal (as defined in `Chunk 4` of the implementation plan) *or* injects the `@` symbol to trigger the lightweight palette.
*   **Recommendation**: Inject `@` for speed, but include a "Browse All..." option at the bottom of the palette to open the full Marketplace UI for discovery.

---

## 📊 Detailed Interaction Flows

### Flow A: Activating a Registry Skill (The "Install" Flow)
1.  User types `@Advanced-SQL`.
2.  System finds it in the Registry (not local).
3.  UI shows: `Advanced-SQL [Registry] (Install Required)`.
4.  User selects it.
5.  **System Action**: Prompt user: *"This skill is not installed. Install to Personal Library to use?"*
    *   *Alignment*: This matches `Chunk 8` (Installation Flow).
6.  User confirms.
7.  System copies skill to `~/.agents/skills/` and activates it.
8.  Chip turns into **[Local]**.

### Flow B: Handling Security Risks
1.  User types `@Dangerous-Script`.
2.  User selects it from the list.
3.  System detects `security_score < 2` or `sec-dangerous-tools` error.
4.  **UI Response**: The chip appears **Red** immediately.
5.  **Interstitial**: A warning modal appears (as per `Chunk 10`): *"This skill contains dangerous commands. Are you sure?"*
6.  User must explicitly confirm to proceed.

---

## 📈 Recommendations & Priority Matrix

### High Priority (Critical Path)

**1. Implement the "Merged Source" Search API**
*   **Requirement**: The `@` trigger needs a backend command `search_skills(query)` that returns the merged list (Local + Registry) respecting the priority order.
*   **Why**: Users expect to find *their* skills first, then public ones.

**2. Visual Differentiation in the Palette**
*   **Requirement**: Do not render all skills the same.
*   **Design**: Use Icons or Badges to distinguish `[Local]` vs `[Registry]`. This prevents the "Why is my skill not updating?" issue (where a user sees a local old version and thinks it's the registry version).

### Medium Priority (Refinement)

**3. Inline Lint Feedback**
*   **Requirement**: Integrate the `skilldeck-lint` results into the Skill Chip.
*   **UX Benefit**: "Configurable Linting" allows users to see *why* a skill might be problematic before they send a prompt, saving them a failed execution.

**4. "Skill Info" Popover**
*   **Action**: Clicking a Skill Chip should show a popover with:
    *   Description.
    *   Source (Workspace/Personal/Registry).
    *   Trust Badge (Security Score).

---

## 💡 Researcher's Summary
By referencing the `skills-marketplace` architecture, we have elevated the "Skill File" feature from a simple file upload to a **Contextual Skill Activation System**. The chat input now serves as the primary interface for the Skill Marketplace, allowing users to discover, install, lint, and activate skills directly within their workflow.
