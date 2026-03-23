# Artifacts & Branches: Integration Blueprint

## 🔗 1. Artifact Lifecycle & Storage

### Creation
- **Code blocks** – When the assistant sends a message containing a code block (triple backticks), the message is persisted. After saving, we parse the markdown and for each code block create an `artifact` record.
- **MCP artifacts** – When an MCP tool call returns non‑textual content (e.g., a file, JSON, binary), we create an artifact during the tool call processing.

### Storage Schema
We already have an `artifacts` table (see `skilldeck-models/src/artifacts.rs`). Add columns:
- `message_id` (UUID, FK) – the message that produced the artifact (or tool call event if from MCP).
- `branch_id` (UUID, nullable) – which branch the artifact belongs to. For messages on the main trunk, this is `NULL`. For messages on a branch, we store the branch ID.
- `parent_artifact_id` (UUID, nullable) – for versioning: when a new version of the same artifact is created, point to the previous version.
- `type` – `"code"`, `"mcp_file"`, `"mcp_json"`, etc.
- `name` – user‑friendly name.
- `content` – the artifact content.
- `language` – optional.
- `metadata` – JSON for additional info (e.g., mime type, tool call ID).

### Linkage to Message & Branch
- For artifacts derived from an assistant message, `message_id` is set; `branch_id` is derived from the message’s branch (if any).
- For artifacts from MCP tool calls (which are attached to a message as part of tool result), they can also reference `message_id` and `branch_id` via the message.

## 🧩 2. Branch‑Aware Artifact Panel

When a user views a branch (active branch), the artifact panel shows:
- All artifacts from messages in that branch.
- **Optionally**, artifacts from ancestor messages (the main trunk up to the branch point). This provides context without cluttering.

*Default behaviour*: Only artifacts from the current branch. User can toggle a filter “Show artifacts from main trunk” if needed.

### Visual indication
- Artifacts that are pinned or have multiple versions show a badge indicating they exist in other branches (e.g., “also in main”, “version 2”).

## 🔄 3. Cross‑Branch Reuse: Copy Artifact to Another Branch

### User Action
In the artifact panel, each artifact has a “Copy to branch…” action. Clicking it opens a branch picker (list of branches for the conversation). After selecting a branch, the artifact content is **inserted into the message input** of that branch as a new user message (with the content wrapped in the appropriate format). The user can then send it.

*Why not create a new artifact directly?* Because the user may want to edit the content before using it, and the artifact should be associated with the new message after it’s sent.

### Technical Flow
1. User selects artifact and target branch.
2. Frontend calls a command `copy_artifact_to_branch(artifact_id, target_branch_id)`.
3. Backend verifies that the target branch exists and belongs to the same conversation.
4. It creates a draft user message in the target branch containing the artifact content, and returns the new message ID.
5. Frontend navigates to that branch (if not already) and focuses the input with the drafted message pre‑filled (or just shows a notification that the content is ready to send).

### Alternative: Direct Insertion as Artifact
For power users, we could offer a “Insert as artifact” option that creates an artifact record directly in the target branch without a message. This would be useful for sharing snippets across branches without clogging the thread. This can be a separate action: “Pin to branch” or “Add artifact to branch”.

## 📝 4. Versioning Across Branches

When the same artifact name (e.g., the same filename or tool output identifier) appears in two branches, they are treated as **versions**.

### Version Grouping
- We group artifacts by a **logical key**: `(conversation_id, type, name)`.  
- Each new artifact with the same key becomes a new version, linked via `parent_artifact_id` in reverse chronological order.

### Diff View
In the artifact panel, when multiple versions exist, a “Diff” button opens a modal where the user can select two versions (by branch, by timestamp) and see a unified diff of the content.

### Conflict Resolution during Branch Merge (future)
If we later implement branch merging, artifacts with the same key from two branches would be treated as a conflict, and the user would resolve using the diff modal.

## 📌 5. Pinning Across Branches

**Pins are branch‑specific** because they relate to what the user is currently focused on. However, a user may want to pin an artifact from another branch to remember it.

### Pin Behavior
- When in branch A, pinning an artifact from branch A pins it for that branch only.
- When in branch B, a different set of pins is shown.
- However, there’s value in “global pins” – artifacts that are always visible regardless of branch. We can provide a “Pin to conversation” option in the artifact panel, which pins the artifact to the whole conversation (and appears in the top bar in all branches). This is a second tier.

### UI
- Two pin icons: a local pin (branch‑specific) and a conversation pin (global).  
- Global pins appear in the top bar in every branch; local pins appear only when in that branch.

## 🔧 Implementation Plan

### Phase 1 (Foundational)
- Extend `artifacts` table with `branch_id`, `parent_artifact_id`.
- When saving messages, parse and create artifacts, setting `branch_id` from message’s branch.
- Build basic artifact panel listing artifacts of current branch.

### Phase 2 (Cross‑Branch Reuse)
- Implement `copy_artifact_to_branch` Tauri command.
- Add “Copy to branch” UI in artifact panel with branch picker.
- Draft message creation in target branch.

### Phase 3 (Versioning & Diff)
- Add version grouping logic.
- Implement diff modal using `react-diff-viewer` (already in deps).
- Expose version selection UI.

### Phase 4 (Pinning)
- Add local and global pin columns to `pinned_artifacts` table (or reuse bookmarks with a `type` field).
- Render pins in top bar, branch‑sensitive.
- Add pin/unpin actions to artifact panel.

## 🧪 Testing Scenarios

1. **Create branch from a message** → artifacts from that message should appear in the new branch’s panel?  
   - They should, because the artifact is associated with the message, which is now part of the branch.

2. **Copy artifact from branch A to branch B** → user sees the content in message input, sends it, and a new artifact (with same key) is created in branch B → becomes a new version of that artifact.

3. **Pin globally** → pinned artifact appears in top bar across all branches; clicking it scrolls to the message in the current branch (if the artifact exists in that branch) or falls back to the original branch.

4. **Diff across branches** → user selects two versions from different branches, sees diff.

## ✅ Success Criteria

- **Artifact reuse** – 30% of branch creations involve copying an artifact from another branch.
- **Version awareness** – 20% of users with multiple versions use the diff feature.
- **Pinning** – 15% of users pin at least one artifact globally; 25% pin locally.

---

**Next**: Wireframes of the artifact panel with branch‑aware features, pin bar with global/local indicators, and diff modal.
