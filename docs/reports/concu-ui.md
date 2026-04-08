Now I have a thorough picture of the existing codebase. Let me write the complete implementation plan for all features across the three apps.Now I have all the context I need. Let me write the full plan.Here is the full, file-by-file implementation plan for all 23 features.

---

## From Codex

### 1 — Quick model switch in input

**`src/store/settings.ts`** — Add `inputModelId: string | null` and `setInputModelId` to `SettingsState`. This is a per-session override that sits on top of the active profile's model.

**`src/components/conversation/message-input.tsx`** — Add a compact model picker button to the bottom action row, left of the send button. Use the existing `useProfiles` to get available profiles, then derive distinct `(provider, modelId)` pairs. On select, write to `useSettingsStore.inputModelId`. When sending, pass `inputModelId ?? profile.model_id` to `commands.sendMessage`. The picker itself is a `DropdownMenu` with a `Cpu` icon, showing the active model name truncated. Only show when `providerReady` is true.

---

### 2 — Thinking mode toggle in input

**`src/store/settings.ts`** — Add `thinkingEnabled: boolean` and `setThinkingEnabled` (default `false`).

**`src/components/conversation/message-input.tsx`** — Add a `BrainCircuit` (lucide) icon button next to the model picker. Toggle `thinkingEnabled` on click; when active render it with `text-primary` tint. Pass a `thinking: boolean` field into `commands.sendMessage` payload. Wire up the Tauri command to forward this as a model parameter (e.g. `anthropic-thinking` budget).

**`src-tauri/src/commands/messages.rs`** — Accept optional `thinking: Option<bool>` in the `send_message` payload struct and forward it into the agent run options.

---

### 3 — Suggested prompts library

**New file: `src/components/conversation/suggested-prompts.tsx`** — A dismissible banner shown only when `messages.length === 0` and `conversationId !== null`. Renders a horizontal scroll of 4–6 prompt chips (hardcoded or loaded from a JSON in `src/lib/suggested-prompts.ts`). Clicking a chip fills the textarea. An "Explore more" button opens a `Dialog` with a categorized grid of prompts (grouped by use-case: coding, writing, analysis…). A `×` button calls `setDismissed(true)` stored in `useUIEphemeralStore`.

**`src/lib/suggested-prompts.ts`** — Static array of `{ label, prompt, category }` objects. Keep at 30–40 entries.

**`src/components/conversation/message-input.tsx`** — Render `<SuggestedPrompts onSelect={(p) => setDraft(p)} />` above the textarea when shown.

**`src/store/ui-ephemeral.ts`** — Add `suggestedPromptsDismissed: Record<string, boolean>` (keyed by conversationId) and `setSuggestedPromptsDismissed`.

---

### 4 — Sort conversations (updated / created)

**`src/store/settings.ts`** — Add `conversationSort: 'updated' | 'created'` (default `'updated'`) and `setConversationSort`.

**`src/components/layout/left-panel.tsx`** — Add a small `Select` (or two-way toggle button) in the header row near the search bar. On change it writes to `conversationSort`. Apply sort in the existing grouping logic: instead of ordering by `updated_at` always, switch between `updated_at` and `created_at` depending on the setting. The existing date-group labels (Today, This week…) stay but reflect the chosen sort key.

---

### 5 — Stacked-card settings UI

**`src/routes/_app/settings.tsx` (layout route)** — Currently each tab is its own route rendering into the layout. Wrap sections inside each settings tab in a visual "card stack": a `<div className="rounded-xl border border-border overflow-hidden divide-y divide-border">` where each `<section>` is a direct child with `px-5 py-4`. This gives the Codex look of a single border-radius on the stack with internal dividers instead of individual cards.

Apply this pattern to: `appearance-tab.tsx`, `preferences-tab.tsx`, `api-keys-tab.tsx`, `approvals-tab.tsx`, `lint-config.tsx`. Create a shared `<SettingsSection title="..." description="...">` wrapper component at `src/components/settings/settings-section.tsx` to avoid repetition.

---

### 6 — Font size in appearance settings

**`src/store/settings.ts`** — Add `uiFontSize: 'sm' | 'md' | 'lg'` (default `'md'`) and `setUiFontSize`.

**`src/main.tsx`** — Read `uiFontSize` from the store and apply a CSS class to `<html>`: `text-sm` / `text-base` / `text-lg`. Use a `useEffect` that subscribes to store changes.

**`src/components/settings/appearance-tab.tsx`** — Add a three-way button group (Small / Medium / Large) inside a new `SettingsSection`. Preview text below the buttons updates live.

---

### 7 — Personality / profile settings (per-profile system prompt editor)

The `profiles-tab.tsx` already exists but is likely a management view. The "personality" concept from Codex means surfacing system prompt editing more prominently.

**`src/components/settings/profiles-tab.tsx`** — Add an inline collapsible "Personality" section per profile: a `<Textarea>` bound to `profile.system_prompt`, a character count, and a Save button calling `useUpdateProfile`. Add placeholder text like "You are a helpful assistant with a concise, direct style…".

**`src/routes/_app/settings.profiles.tsx`** — Ensure this route exists and links from the sidebar as "Profiles & Personality".

---

### 8 — Open in editor from conversation bar

**`src/components/layout/left-panel.tsx`** (or the conversation route header) — Add an `ExternalLink` / `Code2` icon button at the top of the panel. On click, call `revealItemInDir` (already imported in `skill-detail-panel.tsx`) with the active workspace path, or `openUrl('vscode://file/' + workspacePath)`. Fall back to `open` dialog if no workspace is active.

Add a settings preference (`preferredEditor: 'vscode' | 'cursor' | 'system'`) in `settings.ts` to control the URL scheme used.

---

## From Goose

### 9 — Keyboard shortcuts reference in settings

**New file: `src/components/settings/shortcuts-tab.tsx`** — A read-only reference table of all keyboard shortcuts. Each row: `<kbd>` for the combo + description. Pull the list from a static `src/lib/keyboard-shortcuts.ts` array that mirrors what is already registered in `app-shell.tsx` via `useHotkeys`.

**`src/routes/_app/settings.shortcuts.tsx`** — New route rendering `<ShortcutsTab />`.

**`src/routeTree.gen.ts`** — Add the new route (or let TanStack Router auto-generate it from the file).

**Settings sidebar** — Add "Shortcuts" link.

---

### 10 — Streaming indicator on conversation list item

**`src/store/ui-ephemeral.ts`** — `agentRunning` is already `Record<string, boolean>`. 

**`src/components/conversation/conversation-item.tsx`** — Import `useUIEphemeralStore`. Read `agentRunning[conversation.id]`. When true, replace the timestamp with a `<BouncingDots />` (already exists at `src/components/ui/bouncing-dots.tsx`) or a pulsing dot `animate-pulse`. Hide the timestamp while streaming; restore it on done.

---

### 11 — Scheduler (scheduled message sending)

This is the largest Goose feature. It needs both UI and a Tauri backend command.

**`src-tauri/src/commands/scheduler.rs`** — New commands: `schedule_message(conversation_id, content, cron_expression) -> UUID`, `list_scheduled_messages(conversation_id) -> Vec<ScheduledMessage>`, `delete_scheduled_message(id)`. Use a simple DB table `scheduled_messages` with a cron string. A background tokio task polls every minute and fires due messages.

**`src/hooks/use-scheduler.ts`** — `useScheduledMessages`, `useScheduleMessage`, `useDeleteScheduledMessage` via TanStack Query.

**`src/components/conversation/message-input.tsx`** — Add a `Clock` icon button that opens a `Dialog` (or popover) with a datetime picker and optional recurrence (none / daily / weekly). On confirm, calls `scheduleMessage` mutation instead of `sendMessage`.

**`src/components/conversation/scheduled-messages-panel.tsx`** — Small panel rendering below `QueueList` (same pattern) showing upcoming scheduled messages with delete buttons. Only shows when there are scheduled messages.

---

### 12 — Auto compaction

**`src/store/settings.ts`** — Add `autoCompactionEnabled: boolean` and `compactionTokenThreshold: number` (default 80000).

**`src-tauri/src/commands/messages.rs`** — Add `compact_conversation(conversation_id) -> String` command that summarizes the conversation using the same agent, truncates old messages, and inserts a summary system message.

**`src/hooks/use-agent-stream.ts`** — In the `'done'` case, after invalidating queries, check if `messages.length * avgTokens > compactionThreshold` and if `autoCompactionEnabled`. If so, call `commands.compactConversation(conversationId)` silently and `toast.info('Conversation auto-compacted')`.

**`src/components/settings/preferences-tab.tsx`** — Add a `SettingsSection` for "Context management" with a toggle for auto-compaction and a threshold slider.

---

### 13 — App version in settings

**`src-tauri/tauri.conf.json`** — Version is already defined here.

**New file: `src/hooks/use-app-version.ts`**:
```ts
import { getVersion } from '@tauri-apps/api/app'
export function useAppVersion() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => { getVersion().then(setVersion) }, [])
  return version
}
```

**`src/components/settings/preferences-tab.tsx`** (or a footer in the settings layout) — Render `v{version}` in muted small text at the bottom of the settings sidebar or in the About section.

---

### 14 — Hover → copy / edit actions on messages

**`src/components/conversation/message-bubble.tsx`** — Add a `group` class to the outer wrapper. Inside, render a hover action bar: `<div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 absolute top-2 right-2">`. Buttons: Copy (clipboard write of `message.content`), Edit (only for user messages), Retry (already partially exists via `retryAvailable`). Use `size="icon-xs"` `Button` with `ghost` variant, matching the pattern in `queue-item.tsx`.

The timestamp currently shown statically should move inside this hover area or hide behind `group-hover`.

---

### 15 — Edit message: in-place or new branch

**`src/components/conversation/message-bubble.tsx`** — When Edit is clicked on a user message, show a small `AlertDialog` (or inline choice): "Edit in place" vs "Edit on new branch". 

- **In place:** transform the bubble into an editable textarea (see feature 16).
- **New branch:** call `useCreateBranch` (already exists) with the message index as the branch point, then open the new branch.

**`src/hooks/use-messages.ts`** — Add `useEditMessage`: calls `commands.editMessage(messageId, newContent)` which updates the message and re-runs the agent from that point.

---

### 16 — Edit message → transforms into input

**`src/components/conversation/message-bubble.tsx`** — When "Edit in place" is confirmed, set a local `isEditing` state. When true, replace the message content with a `<Textarea>` auto-focused, pre-filled with `message.content`. Below: "Save & Resend" (calls `useEditMessage` then triggers agent re-run) and "Cancel" buttons. On Escape → cancel. On Ctrl+Enter → save. Match the `QueueEditForm` UX pattern already in the codebase.

---

## From Opencode

### 17 — Auto-approve toggle in chat input

The `toolApprovals` settings already exist in `src/store/settings.ts`. The feature here is a quick-toggle button directly in the message input bar so users don't have to open settings.

**`src/components/conversation/message-input.tsx`** — Add a `ShieldCheck` / `Shield` icon button. When any approval is already set to `true`, show it as active. On click, open a small `DropdownMenu` with checkboxes for each approval category (reads, writes, shell, HTTP). Each toggle calls `setToolApprovals`. This replaces the friction of going to Settings → Approvals mid-conversation.

---

### 18 — Git repo init hint when workspace loads

**`src-tauri/src/commands/workspace.rs`** — Add `check_git_status(workspace_path) -> GitStatus` returning `{ is_git_repo: bool, has_uncommitted: bool }`. Uses `std::process::Command` to run `git rev-parse --is-inside-work-tree`.

**`src/hooks/use-workspace-git.ts`** — `useWorkspaceGitStatus(workspacePath)` — a query that calls the above command.

**`src/components/conversation/message-thread.tsx`** or **center panel** — When `activeWorkspace` is set and `gitStatus.is_git_repo === false`, render a dismissible `<Alert>` banner: "This folder isn't a git repo. Initialize one?" with a button calling `commands.runShell('git init', workspacePath)`. Dismissed state stored in `useUIEphemeralStore` keyed by workspace path.

---

### 19 — Workspace switcher in left bar + conversations per workspace

The left panel already has `useWorkspaces` and `useWorkspaceStore`. The gap is a persistent, visible workspace selector above the conversation list.

**`src/components/layout/left-panel.tsx`** — Replace or augment the current workspace badge area with a full workspace switcher dropdown at the very top of the left panel. Design: a button showing the active workspace name (or "No workspace" if none) with a `ChevronDown`. The `DropdownMenu` lists all open workspaces + an "Open folder…" option (calls existing `useOpenWorkspace`). Selecting a workspace calls `setActiveWorkspaceId`.

**`src/hooks/use-conversations.ts`** — The `useConversations` hook already accepts `profileId`. Add an optional `workspaceId` param and pass it to `commands.listConversations` so the list scopes to the active workspace.

**`src/store/workspace.ts`** — Verify `activeWorkspaceId` is persisted (it should be via existing persist middleware).

---

### 20 — Global search scoped to workspace

**`src/components/search/global-search-modal.tsx`** — When `activeWorkspaceId` is set, pass it as a filter to the search command. Add a small "Workspace" badge or toggle in the search UI to switch between global and workspace-scoped results.

**`src-tauri/src/commands/search.rs`** — Accept optional `workspace_id: Option<UUID>` in the search command, filtering conversations by workspace.

---

### 21 — Audio effects in settings

**New file: `src/lib/audio.ts`** — A tiny audio manager:
```ts
const sounds = {
  messageSent: new Audio('/sounds/send.mp3'),
  messageReceived: new Audio('/sounds/receive.mp3'),
  toolApproved: new Audio('/sounds/approve.mp3'),
}
export function playSound(name: keyof typeof sounds) {
  if (!useSettingsStore.getState().audioEnabled) return
  sounds[name].currentTime = 0
  sounds[name].play().catch(() => {})
}
```
Add 3 short sound files to `public/sounds/` (wav or mp3, <50KB each).

**`src/store/settings.ts`** — Add `audioEnabled: boolean` and `audioVolume: number` (0–1, default 0.5).

**`src/components/settings/appearance-tab.tsx`** — Add a `SettingsSection` "Sound effects" with an enable toggle and a volume slider (only shown when enabled).

**`src/hooks/use-agent-stream.ts`** — Call `playSound('messageReceived')` in the `'done'` case.

**`src/components/conversation/message-input.tsx`** — Call `playSound('messageSent')` after a successful `sendMutation`.

---

### 22 — File tree on right panel (icon toggle)

**`src/components/layout/right-panel.tsx`** — Add a `FolderTree` tab to the existing tab bar (already has Session, Skills, MCP, Workflow, Analytics, Artifacts). The tab icon is `FolderTree` from lucide.

**New file: `src/components/workspace/file-tree-panel.tsx`** — Calls `commands.listWorkspaceFiles(workspacePath)` (new command, returns a recursive file/dir tree). Renders it with the existing `FileTreeRenderer` pattern already present in the codebase (found in the code block renderer). Clicking a file opens it via `openUrl('vscode://file/...')` or via the preferred editor setting.

**`src-tauri/src/commands/workspace.rs`** — Add `list_workspace_files(path, max_depth: u8) -> Vec<FileEntry>` using `walkdir`.

---

### 23 — Open workspace terminal (top-right icon)

**`src/components/layout/right-panel.tsx`** or the conversation route header — Add a `Terminal` icon button in the panel header row (alongside whatever icons are already there). On click, call `commands.openTerminal(workspacePath)`.

**`src-tauri/src/commands/workspace.rs`** — Add `open_terminal(path: String)` that uses `tauri-plugin-shell` to open the system terminal at the given path:
```rust
// macOS: open -a Terminal <path>
// Windows: wt -d <path> or cmd /K cd <path>
// Linux: x-terminal-emulator or $TERM
```
Detect OS at runtime with `std::env::consts::OS`.

---

## Cross-cutting integration notes

**`src/store/settings.ts`** — This file gets several new fields across the plan. Add them all in one pass: `inputModelId`, `thinkingEnabled`, `conversationSort`, `uiFontSize`, `preferredEditor`, `audioEnabled`, `audioVolume`, `autoCompactionEnabled`, `compactionTokenThreshold`.

**`src/store/ui-overlays.ts`** — Add `shortcutsOpen: boolean` / `setShortcutsOpen` for the keyboard shortcut sheet if you want it accessible outside of settings.

**`src/lib/keyboard-shortcuts.ts`** — Create this as a single source of truth array that `app-shell.tsx` reads for `useHotkeys` registrations *and* `shortcuts-tab.tsx` reads for display. This prevents the reference table going stale.

**`src/components/global-event-listeners.tsx`** — Mount `useQueueEvents` (Bug 1 fix) here, keeping the pattern consistent with `useMcpEvents`, `useSkillEvents`, `useSubagentEvents`.

**`src/routes/_app/settings.ts`** — Add routes for `settings.shortcuts` and ensure the settings sidebar links list is updated everywhere it's rendered.
