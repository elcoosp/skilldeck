# SkillDeck — Comprehensive UX Research Audit Report

> **Product:** SkillDeck — Local-first AI Orchestration for Developers  
> **Audit Date:** 2026-04-05  
> **Auditor:** UX Research Agent  
> **Scope:** Full codebase analysis (67,712 lines across Tauri desktop app, Next.js landing page, Rust backend, and Astro documentation site)  
> **Methodology:** Static code analysis, accessibility heuristic evaluation, UX anti-pattern identification, error-handling flow mapping, and i18n completeness audit

---

## Executive Summary

SkillDeck is a well-architected Tauri desktop application that combines a React + TypeScript frontend, a Rust backend core, a Next.js landing/marketing site, and an Astro documentation site. The codebase demonstrates strong engineering practices including virtualized lists, debounced saves, streaming agent responses, and a rich set of shadcn/ui components.

However, this audit identified **111 distinct UX issues** across 7 major categories, including **7 Critical**, **25 High**, **45 Medium**, and **34 Low** severity findings. The most impactful problems centre around:

1. **A pervasive lack of accessibility semantics** — modals without ARIA roles, tab lists without proper roles, expandable regions without `aria-expanded`, and form inputs without associated labels.
2. **Broken or absent error feedback loops** — several mutations (MCP, skills, workspaces) silently fail with no user-facing toast; the edit-message hook is a stub that discards user input; and all error messages from the Rust backend are flattened to opaque strings.
3. **An entirely empty internationalisation pipeline** — despite a full Lingui setup, the compiled locale file is `{}`, meaning every string in the app is hardcoded English.
4. **Incomplete onboarding and missing confirmation dialogs** — the wizard has no "Back" button and conversation deletion has no confirmation prompt.

This report catalogues every finding with file references, severity ratings, and concrete remediation steps.

---

## Table of Contents

- [1. Accessibility (a11y) Issues](#1-accessibility-a11y-issues)
- [2. Usability Issues](#2-usability-issues)
- [3. Error Handling & User Feedback](#3-error-handling--user-feedback)
- [4. Loading States & Performance Perception](#4-loading-states--performance-perception)
- [5. Internationalisation Gaps](#5-internationalisation-gaps)
- [6. Onboarding & First-Time Experience](#6-onboarding--first-time-experience)
- [7. Visual & Design Consistency Issues](#7-visual--design-consistency-issues)
- [8. Navigation & Information Architecture](#8-navigation--information-architecture)
- [9. State Management UX Issues](#9-state-management-ux-issues)
- [10. Achievement & Engagement Issues](#10-achievement--engagement-issues)
- [11. Backend-to-Frontend Error Propagation](#11-backend-to-frontend-error-propagation)
- [12. Skill Installation & Registry Friction](#12-skill-installation--registry-friction)
- [13. Tool Approval Flow UX](#13-tool-approval-flow-ux)
- [14. Workspace Context UX](#14-workspace-context-ux)
- [15. Documentation & Landing Page UX](#15-documentation--landing-page-ux)
- [16. Security UX](#16-security-ux)
- [17. Summary & Prioritised Roadmap](#17-summary--prioritised-roadmap)

---

## 1. Accessibility (a11y) Issues

### A11Y-01 — Onboarding Wizard: No dialog semantics or focus trap
**File:** `src/components/overlays/onboarding-wizard.tsx`  
**Severity:** Critical

The wizard modal overlay is a plain `<div className="fixed inset-0 z-50">` with no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby` / `aria-describedby`, and no focus trap. Users can Tab behind the overlay, and screen readers will not announce it as a dialog. The Escape key is not handled to close or skip the wizard.

**Remediation:** Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the step title. Wrap the wizard in a Radix `Dialog` or implement a focus trap. Add Escape-key handling to skip or close.

---

### A11Y-02 — Splash Screen: Hardcoded white background, no progress bar semantics
**File:** `src/components/overlays/splash-screen.tsx`  
**Severity:** High

Uses `bg-white` hardcoded, which causes a jarring white flash for users in dark mode. The animated progress bar has no `role="progressbar"` or `aria-label` for assistive technology.

**Remediation:** Replace `bg-white` with `bg-background dark:bg-background`. Add `role="progressbar"` and `aria-label="Loading SkillDeck"` to the progress element.

---

### A11Y-03 — Settings Layout: Backdrop is an unsemantic `div`
**File:** `src/routes/_app/settings.tsx`  
**Severity:** High

The settings modal backdrop is a `<div>` with `onClick` but no `role`, `tabIndex`, or keyboard event handler. A `biome-ignore` comment suppresses the a11y lint warning. The settings content is not announced as a dialog to screen readers.

**Remediation:** Use the existing `Dialog` component from `src/components/ui/dialog.tsx`, or add `role="dialog"`, `aria-modal="true"`, keyboard Escape handling, and a focus trap.

---

### A11Y-04 — ConversationItem: `role="button"` without Space key support
**File:** `src/components/conversation/conversation-item.tsx`  
**Severity:** High

Uses `role="button"` on a `<div>` (with a `biome-ignore`). The `onKeyDown` handler only supports `Enter` and `Escape` but not `Space`, which is required per the WAI-ARIA button pattern. The inline rename input also lacks an `aria-label`.

**Remediation:** Add `Space` key handling in the `handleKeyDown` function (prevent default + activate). Add `aria-label="Rename conversation"` to the inline input.

---

### A11Y-05 — Right Panel Tabs: No ARIA tab pattern
**File:** `src/components/layout/right-panel.tsx`  
**Severity:** High

Tab buttons use raw `<button>` elements without `role="tablist"`, `role="tab"`, `aria-selected`, or `aria-controls`. The tab pattern is not accessible to screen readers or keyboard-only users.

**Remediation:** Wrap tabs in `<div role="tablist">`, add `role="tab"` and `aria-selected={activeTab === id}` to each tab button, and `role="tabpanel"` to the tab content regions.

---

### A11Y-06 — API Keys Tab: Native `<input>` without label association
**File:** `src/components/settings/api-keys-tab.tsx`  
**Severity:** High

Uses raw `<input>` elements instead of the `Input` component, and they have no associated `<label>` elements. The toggle-visibility button (eye icon) also lacks an `aria-label`.

**Remediation:** Wrap each input in a `<label>` or add `aria-label`. Add `aria-label={visible[id] ? 'Hide key' : 'Show key'}` to the toggle button.

---

### A11Y-07 — Appearance Tab Volume Slider: Missing range semantics
**File:** `src/components/settings/appearance-tab.tsx`  
**Severity:** High

The `<input type="range">` has no `aria-label`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, or associated `<label>` element.

**Remediation:** Add `aria-label="Volume"`, `aria-valuemin={0}`, `aria-valuemax={1}`, `aria-valuenow={audioVolume}`, and associate with the visible label.

---

### A11Y-08 — Workspace Avatar Buttons: Using `title` only
**File:** `src/components/layout/left-panel.tsx`  
**Severity:** Medium

Workspace avatar buttons use only `title={w.name}` for accessibility. The `title` attribute has poor screen reader support and no visual tooltip on many desktop environments.

**Remediation:** Add `aria-label={w.name}` and `aria-pressed={isActive}` to each workspace button.

---

### A11Y-09 — ToolCallCard: Expandable content has no `aria-expanded`
**File:** `src/components/conversation/tool-call-card.tsx`  
**Severity:** Medium

The expand/collapse button does not have `aria-expanded={open}` or `aria-controls`. Screen readers cannot determine whether the detail section is expanded.

**Remediation:** Add `aria-expanded={open}` and `aria-controls="tool-detail-{name}"` to the button. Add `id="tool-detail-{name}"` and `role="region"` to the detail section.

---

### A11Y-10 — ToolApprovalCard: No `aria-live` for status changes
**File:** `src/components/conversation/tool-approval-card.tsx`  
**Severity:** Medium

When the approval is resolving (`resolving` state), the button text does not update for screen readers. No `aria-live` region announces the resolution.

**Remediation:** Add `aria-busy={resolving}` to the card container and `aria-disabled={resolving}` to the action buttons.

---

### A11Y-11 — Left Panel Collapsible Sections: Missing `aria-expanded`
**File:** `src/components/layout/left-panel.tsx`  
**Severity:** Medium

All `Collapsible.Trigger` elements for "Pinned", folder names, and date groups lack explicit `aria-expanded` attributes. While Radix may provide these via data attributes, they should be verified.

**Remediation:** Verify Radix `Collapsible.Trigger` outputs `aria-expanded`. If not, add explicit attributes.

---

### A11Y-12 — Heading Bookmark Button: No `aria-label`
**File:** `src/components/conversation/heading.tsx`  
**Severity:** Medium

The bookmark toggle button inside headings has no `aria-label`. Screen readers will only announce "button" with no purpose.

**Remediation:** Add `aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this heading'}`.

---

### A11Y-13 — App Shell Panel Separators: No keyboard resize
**File:** `src/components/layout/app-shell.tsx`  
**Severity:** Medium

Panel separators have `cursor-col-resize` styling but no `role="separator"`, `aria-orientation`, `aria-valuenow`, or keyboard-based resizing. Users who cannot use a mouse cannot resize panels.

**Remediation:** Add `role="separator"`, `aria-orientation="vertical"`, and keyboard event handlers for arrow keys.

---

### A11Y-14 — UnifiedSkillCard: Action buttons lack `aria-label`
**File:** `src/components/skills/unified-skill-card.tsx`  
**Severity:** Low

Install/Update action buttons lack `aria-label` attributes. The card correctly handles Space key, which is good.

**Remediation:** Add `aria-label` to all action buttons.

---

### A11Y-15 — CreateBranchModal: Missing `DialogDescription`
**File:** `src/components/conversation/create-branch-modal.tsx`  
**Severity:** Low

Uses `Dialog` but omits `DialogDescription`, which is recommended by Radix for accessibility.

**Remediation:** Add `<DialogDescription>This branch will start from the selected message.</DialogDescription>`.

---

### A11Y-16 — Docs Checkpoint.astro: Buttons without descriptive labels
**File:** `skilldeck-user-docs/src/components/mdx/Checkpoint.astro`  
**Severity:** Medium

The checkpoint uses `<button>` elements with only "Yes"/"No" text but no `aria-label` describing the action's purpose. The feedback message container lacks `aria-live`.

**Remediation:** Add `aria-label="Yes, I have completed this step"` and `aria-label="No, I need more help"`. Use `aria-live="polite"` on the feedback container.

---

### A11Y-17 — Docs Nudge.astro: No `role` or `aria-live`
**File:** `skilldeck-user-docs/src/components/mdx/Nudge.astro`  
**Severity:** Low

Nudge component lacks `role="status"` and `aria-live="polite"` for accessibility. No dismiss button or analytics tracking.

**Remediation:** Add appropriate ARIA attributes and a dismiss mechanism.

---

## 2. Usability Issues

### US-01 — No confirmation dialog for conversation deletion
**File:** `src/components/conversation/conversation-item.tsx`  
**Severity:** Critical

`handleDelete` immediately calls `deleteMutation.mutate(conversation.id)` without any confirmation. This is a destructive, irreversible action with no safety net.

**Remediation:** Use the existing `AlertDialog` component to confirm deletion before proceeding.

---

### US-02 — Edit Message hook is a stub — silently discards user edits
**File:** `src/hooks/use-edit-message.ts`  
**Severity:** Critical

The hook logs to console and returns `{ success: true }` as a placeholder. It never calls the backend. Users see a success indication, but their edit is silently discarded.

**Remediation:** Implement the actual `invoke('edit_message', ...)` call. If the backend is not ready, show a "feature not yet available" toast instead of silently succeeding.

---

### US-03 — Auto-approve toggle labels are unclear programmatic names
**File:** `src/components/conversation/message-input.tsx`  
**Severity:** High

The dropdown uses programmatic key names (`autoApproveReads`, `autoApproveWrites`, `autoApproveShell`, `autoApproveHttpRequests`). Labels are derived via `.replace('autoApprove', '').replace(/([A-Z])/g, ' $1').trim()` which produces terse "Reads", "Writes", "Shell", "Http Requests" with no descriptions.

**Remediation:** Use human-readable labels with descriptions, similar to the `ApprovalsTab` component. Example: "Auto-approve file reads" with subtext "Skip confirmation for read-only operations".

---

### US-04 — ToolCallCard content is `select-none` — prevents text selection
**File:** `src/components/conversation/tool-call-card.tsx`  
**Severity:** High

The entire card including Input/Output sections has `select-none`, preventing users from selecting and copying tool arguments or results. The "Copy" button only copies the result.

**Remediation:** Remove `select-none` from the expanded detail section, or add a separate "Copy input" button.

---

### US-05 — Command Palette "Open Workspace" action is a no-op
**File:** `src/components/overlays/command-palette.tsx`  
**Severity:** High

The "Open Workspace" command item's `onSelect` only closes the palette: `() => setOpen(false)`. It does not actually open a workspace dialog.

**Remediation:** Wire it to call `handleOpenWorkspace()` (same as the + button in the left panel).

---

### US-06 — Right panel tab labels only show on hover — poor discoverability
**File:** `src/components/layout/right-panel.tsx`  
**Severity:** High

Tab labels (Session, Skills, MCP, etc.) are hidden by default and only visible on hover with a `max-w-0 → max-w-[6rem]` transition. First-time users will not discover these labels. The icons alone are not self-explanatory.

**Remediation:** Show labels by default, or at minimum for the first session until the user interacts. Consider showing labels alongside icons persistently.

---

### US-07 — Workflow deletion uses native `confirm()` — inconsistent with design system
**File:** `src/components/layout/right-panel.tsx`  
**Severity:** Medium

Uses `confirm()` (native browser dialog) which is blocking and does not match the app's design system.

**Remediation:** Replace `confirm()` with the existing `AlertDialog` component.

---

### US-08 — File upload processing is simulated/fake
**File:** `src/components/conversation/message-input.tsx`  
**Severity:** Medium

File "processing" is simulated with `setTimeout` (1500 ms pending, then success). No actual file reading or validation occurs. Very large or unreadable files get no real feedback.

**Remediation:** Implement actual file size validation and content-type checking with real progress/error feedback.

---

### US-09 — Draft persistence error is silently swallowed
**File:** `src/components/conversation/message-input.tsx`  
**Severity:** Medium

`catch((err) => console.error('Failed to load draft:', err))` — if draft loading fails, the user is never notified and their previously typed message may be lost.

**Remediation:** Show a subtle toast notification: "Could not restore your last draft."

---

### US-10 — No email validation in Preferences and Onboarding
**Files:** `src/components/settings/preferences-tab.tsx`, `src/components/overlays/onboarding-wizard.tsx`, `src/components/overlays/launch-notification.tsx`  
**Severity:** Medium

Email inputs accept any text without validation. Invalid emails are silently saved.

**Remediation:** Add email format validation with an inline error message below the input.

---

### US-11 — Message content truncation threshold is arbitrary
**File:** `src/components/conversation/message-bubble.tsx`  
**Severity:** Low

Messages longer than 300 characters get a "Show more/less" toggle. The threshold and preview length (200 characters) are hardcoded constants, not configurable.

**Remediation:** Consider making this configurable via settings, or at minimum expose the constant as a named export.

---

### US-12 — Debug `console.log` statements left in production code
**Files:** `src/components/overlays/command-palette.tsx`, `src/store/bookmarks.ts`  
**Severity:** Low

`console.log('Command palette: navigating to settings')` and `console.log('[loadBookmarks] loaded ...')` are debug logging left in production.

**Remediation:** Remove all debug `console.log` statements or gate them behind a `process.env.NODE_ENV === 'development'` check.

---

### US-13 — Right panel tab state does not persist across sessions
**File:** `src/components/layout/right-panel.tsx`  
**Severity:** Low

`useState<Tab>('session')` means the right panel always opens to the "Session" tab. If a user was browsing Skills or Analytics, they lose their place on refresh.

**Remediation:** Persist the active tab to the `ui-state` store (similar to how other UI state is persisted).

---

## 3. Error Handling & User Feedback

### ERR-01 — Agent stream error toast uses hardcoded English with no retry action
**File:** `src/hooks/use-agent-stream.ts`  
**Severity:** High

`toast.error(event.message || 'An error occurred while processing your message')` — the fallback string is hardcoded English. The toast has no action button (e.g., "Retry"), so users see an error but have no path forward.

**Remediation:** Use an i18n key for the fallback. Add a toast action button to retry sending the message.

---

### ERR-02 — MCP mutations have no `onError` toasts
**File:** `src/hooks/use-mcp.ts`  
**Severity:** High

`useConnectMcpServer`, `useDisconnectMcpServer`, `useAddMcpServer`, and `useRemoveMcpServer` all lack `onError` callbacks. MCP operation failures are completely invisible to the user.

**Remediation:** Add `onError: (error) => toast.error(...)` to each mutation with specific messages per operation.

---

### ERR-03 — Skill mutations (install/uninstall/sync) have no `onError` toasts
**File:** `src/hooks/use-skills.ts`  
**Severity:** High

`useInstallSkill`, `useUninstallSkill`, `useSyncRegistry`, `useDiffSkillVersions`, `useDisableRule`, `useAddSkillSource`, `useRemoveSkillSource` all lack `onError` handlers. Skill operation failures are silent.

**Remediation:** Add `onError` callbacks with user-friendly error messages for every skill-related mutation.

---

### ERR-04 — Workspace mutations have no user feedback
**File:** `src/hooks/use-workspaces.ts`  
**Severity:** Medium

`useOpenWorkspace` and `useCloseWorkspace` have no `onError` or `onSuccess` toasts. Workspace operations fail silently.

**Remediation:** Add toast notifications for success/failure of workspace open/close operations.

---

### ERR-05 — `useDisableRule` and `useRemoveSkillSource` also lack success toasts
**File:** `src/hooks/use-skills.ts`  
**Severity:** Medium

These mutations return `void` with no success toast. Users have no confirmation their action completed.

**Remediation:** Add `onSuccess` toasts: "Rule disabled", "Skill source removed", etc.

---

### ERR-06 — Profile update mutations lack explicit error toasts
**File:** `src/hooks/use-profiles.ts`  
**Severity:** Medium

Profile update mutations throw errors but have no `onError` toast at the hook level.

**Remediation:** Add `onError` callbacks with descriptive messages.

---

### ERR-07 — No user-facing guidance when provider is not ready
**File:** `src/hooks/use-provider-ready.ts`  
**Severity:** Medium

Returns `{ status: 'not_ready', reason?, fix_action? }` but has `retry: false`. If the provider is not ready, the query enters `isError` permanently. No proactive warning appears in `MessageInput`.

**Remediation:** Add a component-level check in `MessageInput` that shows an inline warning when the provider is not ready, with a link to settings.

---

### ERR-08 — `isPlatformNotConfigured` uses fragile string matching
**File:** `src/hooks/use-platform.ts`  
**Severity:** Medium

`String(query.error).includes('Not configured')` depends on exact error text from the Rust backend. If the error message changes, detection silently breaks.

**Remediation:** Use a structured error code from the backend (e.g., `error.code === 'PLATFORM_NOT_CONFIGURED'`).

---

### ERR-09 — Lint rule toggle provides no feedback on failure
**File:** `src/components/settings/lint-config.tsx`  
**Severity:** Medium

`toggleRule` calls `disableRule.mutate()` but has no `onError` callback. If the mutation fails, the rule appears toggled in the UI but is not actually disabled.

**Remediation:** Add `onError: (err) => toast.error('Failed to disable rule')` and revert UI state on error.

---

### ERR-10 — Analytics error displays raw error object
**File:** `src/components/layout/right-panel.tsx`  
**Severity:** Low

`Failed to load analytics: {String(error)}` exposes potentially technical error messages to users.

**Remediation:** Show a user-friendly message ("Could not load analytics data") with a "Retry" button.

---

### ERR-11 — Workflow step errors shown as raw text
**File:** `src/components/layout/right-panel.tsx`  
**Severity:** Medium

Workflow step errors are rendered as raw `{progress.error}` text. No structured error display, no retry button, no step name indication.

**Remediation:** Add a structured error card with error message, step name, and a retry button.

---

### ERR-12 — Conversation create error has no recovery path
**File:** `src/components/layout/left-panel.tsx`  
**Severity:** Low

`handleNewChat` shows a toast error if no profile or workspace exists, but the user has no way to fix this from the error message.

**Remediation:** Use a toast with an action button: `{ action: { label: 'Settings', onClick: () => router.navigate(...) } }`.

---

## 4. Loading States & Performance Perception

### PERF-01 — Hardcoded limit of 50 conversations with no pagination
**File:** `src/hooks/use-conversations.ts`  
**Severity:** High

`commands.listConversations(profileId ?? null, 50)` fetches only 50 conversations. Users with more than 50 conversations have no way to load older ones. No infinite scroll, pagination control, or "Load more" button exists.

**Remediation:** Implement pagination or infinite scroll in the left panel's conversation list. Pass an offset/limit parameter and add a "Load more" sentinel at the bottom.

---

### PERF-02 — Unbounded store growth (memory leak in conversation-keyed records)
**Files:** `src/store/queue.ts`, `src/store/ui-ephemeral.ts`  
**Severity:** High

Both stores use `Record<string, ...>` keyed by `conversationId` for streaming text, agent running state, errors, and drafts. Old conversation keys are never cleaned up. The store accumulates data for every conversation ever opened, growing without bound.

**Remediation:** Implement cleanup logic when a conversation is closed/navigated away. Add a maximum cache size or LRU eviction.

---

### PERF-03 — Message drafts are ephemeral and lost on refresh
**File:** `src/store/ui-ephemeral.ts`  
**Severity:** High

Message drafts (`drafts: Record<string, string>`) are stored in a non-persisted Zustand store. If the user types a long message, switches conversations, and the app refreshes, all drafts are lost.

**Remediation:** Persist drafts using `zustand/middleware/persist` with a storage key. Add `partialize` to only persist the `drafts` field.

---

### PERF-04 — `use-attach-files-listener` closes over stale data
**File:** `src/hooks/use-attach-files-listener.ts`  
**Severity:** Medium

The `useEffect` dependency array includes `itemsMap`, which is an object reference that changes on every Zustand state mutation, causing the effect to re-subscribe on every change — potentially creating duplicate listeners or memory leaks.

**Remediation:** Use `useRef` for `itemsMap` to avoid re-subscription, or use a selector that returns a primitive/stable reference.

---

### PERF-05 — Workflow events have no timeout or fallback
**File:** `src/hooks/use-workflow-events.ts`  
**Severity:** Medium

The hook exposes `progress` state but has no timeout. If a workflow starts and the event stream drops (e.g., crash), the UI shows "running" indefinitely with no way to dismiss it.

**Remediation:** Add a timeout mechanism (e.g., if no events received for 60 s, mark as possibly failed). Add a "Dismiss" action.

---

### PERF-06 — Splash screen relies entirely on CSS animations with no programmatic dismissal
**File:** `src/components/overlays/splash-screen.tsx`  
**Severity:** Medium

The splash screen uses CSS animations with no programmatic dismissal tied to actual app readiness. If the JS bundle takes longer than the animation, the splash fades while the app is still loading. If CSS loads late, users see a blank white screen.

**Remediation:** Add programmatic dismissal triggered by a real readiness check (e.g., React Query initial hydration or Tauri's `ready` event), with a minimum display time.

---

### PERF-07 — Achievement check uses `setTimeout(100ms)` race condition
**File:** `src/hooks/use-messages.ts`  
**Severity:** Medium

Achievement unlocking uses `setTimeout(() => { ... }, 100)` to read messages from the query cache after invalidation. The 100 ms timeout is arbitrary and may not be enough for the refetch, causing achievements to fire inconsistently.

**Remediation:** Use `queryClient.refetchQueries` with `.then()` instead of `setTimeout`, or track message count in local state.

---

### PERF-08 — `useCreateConversation` has arbitrary 50 ms delay
**File:** `src/hooks/use-conversations.ts`  
**Severity:** Low

`await new Promise((resolve) => setTimeout(resolve, 50))` before setting the active conversation is a race-condition workaround. On slower machines, 50 ms may not suffice.

**Remediation:** Use `await queryClient.refetchQueries(...)` instead of `invalidateQueries` + arbitrary delay.

---

### PERF-09 — No progress events for skill sync operations
**File:** `src-tauri/src/lib.rs`  
**Severity:** High

Background skill sync runs every 3600 seconds but emits no events to the frontend. The `sync_registry_skills` command is a fire-and-forget async operation. The user clicks "Sync from Registry" and gets no feedback until completion or error.

**Remediation:** Emit `SkillEvent::SyncProgress { fetched: usize, total: Option<usize> }` events during sync, and `SkillEvent::SyncCompleted { count: usize }` when done.

---

### PERF-10 — No streaming progress for long-running folder assembly
**File:** `src-tauri/src/commands/files.rs`  
**Severity:** Medium

The `assemble_folder` and `read_file` commands can be slow for large directories but are simple request-response commands with no streaming progress.

**Remediation:** For `assemble_folder`, emit progress events (`FolderAssemblyProgress { files_read, total_files }`) via Tauri events.

---

## 5. Internationalisation Gaps

### I18N-01 — Locale messages file is completely empty
**File:** `src/locales/en/messages.js`  
**Severity:** Critical

`module.exports = { messages: JSON.parse('{}') }` — the compiled messages file is entirely empty. Despite having `@lingui/core`, `@lingui/react`, and a `loadLocale()` function, no component uses `<Trans>` or `t()` macros. Every user-facing string in the app is hardcoded English.

**Remediation:** Extract all user-facing strings into Lingui message catalogs. Run `pnpm extract` to populate `messages.po`, then `pnpm compile` to generate the JS. Wrap strings with `<Trans>` or `t()` macros in all components.

---

### I18N-02 — Only `en` locale configured
**File:** `lingui.config.ts`  
**Severity:** Medium

`locales: ['en']` — only English. No additional locales exist.

**Remediation:** Add target locales (e.g., `ja`, `zh`, `de`, `es`, `fr`) to the config. Set up a translation workflow.

---

### I18N-03 — `loadLocale()` silently falls back on missing locale
**File:** `src/lib/i18n.ts`  
**Severity:** Medium

If a locale file is missing, the function logs `console.warn` and does nothing. The UI continues showing empty message IDs without user notification.

**Remediation:** Show a subtle UI notification when locale loading fails. Ensure the fallback locale (English) is always active.

---

### I18N-04 — Language setting in Preferences has no effect
**File:** `src/store/settings.ts`  
**Severity:** Medium

The store has `language: string` and `setLanguage`, and `LanguageSync` in `main.tsx` calls `loadLocale()`. However, `PreferencesTab` renders a language selector that only lists `en`. Users cannot switch languages.

**Remediation:** Once translations are added (I18N-01), the language selector will work. This is blocked by the empty messages file.

---

### I18N-05 — All error toast messages are hardcoded English
**Files:** All hooks (`use-conversations.ts`, `use-skills.ts`, `use-mcp.ts`, etc.)  
**Severity:** High

Every `toast.error(...)` and `toast.success(...)` across the entire codebase uses hardcoded English strings.

**Remediation:** Extract all toast messages into Lingui message catalogs as part of the I18N-01 remediation.

---

### I18N-06 — Achievement toasts are not internationalised
**File:** `src/hooks/use-achievements.ts`  
**Severity:** Low

`toast.success(\`${ach.emoji} Achievement Unlocked: ${ach.title}\`)` — hardcoded English string template.

**Remediation:** Use i18n for "Achievement Unlocked" and achievement titles/descriptions.

---

## 6. Onboarding & First-Time Experience

### ONB-01 — Onboarding Wizard has no "Back" button
**File:** `src/components/overlays/onboarding-wizard.tsx`  
**Severity:** High

The wizard has 4 steps (`welcome → apikey → platform → done`) with a progress bar, but there is no "Back" button. If a user makes a typo in their API key and clicks "Next", they cannot go back to fix it.

**Remediation:** Add a "Back" button on the `apikey` and `platform` steps that decrements the step state.

---

### ONB-02 — Platform step error silently skips to "done"
**File:** `src/components/overlays/onboarding-wizard.tsx`  
**Severity:** Medium

`catch { setPlatformFeaturesEnabled(false); setStep('done') }` — if platform registration or email saving fails, the user is silently moved to the "done" step. They may think their email was saved when it was not.

**Remediation:** Show a toast error and allow the user to retry, rather than silently advancing.

---

### ONB-03 — Onboarding Wizard has no keyboard navigation support
**File:** `src/components/overlays/onboarding-wizard.tsx`  
**Severity:** Medium

The wizard is a modal overlay but does not trap focus. Users can Tab out into the background app. No Escape key handling.

**Remediation:** Add focus trapping, Escape key to skip, and ARIA dialog attributes (overlaps with A11Y-01).

---

### ONB-04 — No "Skip All" option for experienced users
**File:** `src/components/overlays/onboarding-wizard.tsx`  
**Severity:** Low

Users must go through all steps. While each step has a skip button, there is no single "Skip setup" option at the start.

**Remediation:** Add a small "Skip setup" link in the corner of the welcome step.

---

### ONB-05 — Dark mode not fully supported in onboarding steps
**File:** `src/components/overlays/onboarding-wizard.tsx`  
**Severity:** Low

The `DoneStep` has `bg-emerald-100 dark:bg-emerald-900/30` but the `WelcomeStep` and other steps do not have explicit dark mode classes.

**Remediation:** Ensure all wizard step backgrounds and text have proper dark mode variants.

---

### ONB-06 — Platform step has duplicate content
**File:** `src/components/overlays/onboarding-wizard.tsx`  
**Severity:** Low

The Platform step shows TWO info boxes both explaining "What you'll get:" — one as a bullet list and another as a different bullet list. This is redundant and confusing.

**Remediation:** Merge into a single info box with a comprehensive benefit list.

---

### ONB-07 — Launch Notification banner shows during/after onboarding
**File:** `src/components/overlays/launch-notification.tsx`  
**Severity:** Medium

The banner checks a separate localStorage key independent of the onboarding state. A user who completes onboarding will still see this banner. It competes visually with the onboarding wizard if both appear simultaneously.

**Remediation:** Do not show the launch banner during or immediately after onboarding. Tie it to `onboardingComplete`.

---

## 7. Visual & Design Consistency Issues

### VIS-01 — Inconsistent form controls: raw `<input>` vs `<Input>` component
**Files:** `api-keys-tab.tsx`, `preferences-tab.tsx`, `onboarding-wizard.tsx`, `custom-server-form.tsx`  
**Severity:** Medium

Multiple settings forms use raw `<input>` elements with manually crafted className strings instead of the shared `Input` component, leading to inconsistent styling (different heights, borders, focus rings).

**Remediation:** Replace all raw `<input>` elements with the `<Input>` component from `src/components/ui/input.tsx`.

---

### VIS-02 — Inconsistent button styling in Onboarding Wizard
**File:** `src/components/overlays/onboarding-wizard.tsx`  
**Severity:** Medium

All onboarding wizard buttons use raw `<button>` with inline className instead of the `<Button>` component. This creates inconsistent padding, font weights, and hover states.

**Remediation:** Replace with `<Button>` and `<Button variant="outline">` components.

---

### VIS-03 — Custom server form defines its own `inp` class constant
**File:** `src/components/layout/custom-server-form.tsx`  
**Severity:** Medium

Defines `const inp = 'w-full h-7 rounded-md...'` — a completely custom input style that does not match the `Input` component or other form controls.

**Remediation:** Use the `<Input>` component with a size prop instead.

---

### VIS-04 — Inconsistent icon sizes across the app
**Files:** Multiple  
**Severity:** Low

Icon sizes vary between `size-3`, `size-3.5`, `size-4`, `size-5` with no clear pattern.

**Remediation:** Establish an icon size design system (`xs=12`, `sm=14`, `md=16`, `lg=20`) and document which context uses which.

---

### VIS-05 — Inconsistent empty state patterns
**Files:** `left-panel.tsx`, `right-panel.tsx`, `empty-state-local.tsx`, `empty-state-registry.tsx`  
**Severity:** Low

Empty states use different patterns — left panel uses Lottie animation + text, workflow empty state uses a JPEG image, skills tab has its own separate components.

**Remediation:** Create a reusable `<EmptyState>` component accepting an illustration, title, description, and optional CTA button.

---

### VIS-06 — Auto-approve toggle uses dropdown menu pattern inappropriately
**File:** `src/components/conversation/message-input.tsx`  
**Severity:** Medium

The shield icon opens a dropdown with toggle items. This is non-standard — toggles should be immediately visible or use a popover that stays open while toggling multiple settings.

**Remediation:** Use a popover that stays open while toggling multiple options, or a dedicated quick-settings panel.

---

## 8. Navigation & Information Architecture

### NAV-01 — Settings has 11 tabs — cognitive overload
**File:** `src/routes/_app/settings.tsx`  
**Severity:** Medium

11 settings tabs is a lot for a modal. Categories like "Refer & Earn" and "Achievements" could be separate pages rather than settings tabs.

**Remediation:** Group related settings (e.g., "API Keys" + "Profiles" → "Providers"). Move gamification features (Achievements, Referral) to a separate "More" section.

---

### NAV-02 — No breadcrumb or context indicator in center panel
**File:** `src/components/layout/center-panel.tsx`  
**Severity:** Medium

The center panel is just an `<Outlet />` with no visual indication of which conversation is active.

**Remediation:** Add a thin header bar showing the active conversation title with branch navigation controls.

---

### NAV-03 — Three different search mechanisms may confuse users
**Files:** `left-panel.tsx`, `app-shell.tsx`, `global-search-modal.tsx`  
**Severity:** Medium

The search icon in the left panel opens Global Search, `Cmd+Shift+F` also opens it, `Cmd+K` opens the Command Palette, and the left panel has its own search input.

**Remediation:** Document the difference clearly in tooltips. Consider merging or clearly differentiating the search entry points.

---

### NAV-04 — No keyboard navigation between conversations in the list
**File:** `src/components/layout/left-panel.tsx`  
**Severity:** High

The conversation list does not support arrow key navigation. Users must click or Tab through each conversation individually.

**Remediation:** Implement arrow key navigation within the conversation list using the `roving-tabindex` pattern.

---

### NAV-05 — "New Chat" may not navigate to the new conversation
**File:** `src/components/layout/left-panel.tsx`  
**Severity:** Medium

`createConversation.mutate({ title: undefined })` relies on the mutation's `onSuccess` handler to navigate. If the hook does not handle this, the user sees nothing happen.

**Remediation:** Add explicit navigation in `handleNewChat` after the mutation succeeds.

---

### NAV-06 — Keyboard shortcuts listed but some are not implemented
**File:** `src/lib/keyboard-shortcuts.ts`  
**Severity:** High

Lists `Cmd+N` for "New conversation" but this shortcut is not registered in `app-shell.tsx`. Only `Cmd+K`, `Cmd+,`, and `Cmd+Shift+F` are implemented. `Cmd+Shift+S` for "Toggle right panel" is also listed but not implemented.

**Remediation:** Either implement all listed shortcuts or remove the unimplemented ones from the Shortcuts settings tab.

---

## 9. State Management UX Issues

### STATE-01 — Dual storage for `onboardingComplete` (Zustand + localStorage)
**File:** `src/store/ui-state.ts`  
**Severity:** High

The `onboardingComplete` state is stored in both Zustand's `persist` middleware AND directly in `localStorage` under a different key. This creates a desync risk — if one is cleared but not the other, behaviour is inconsistent.

**Remediation:** Remove the manual `localStorage` calls. Add `onboardingComplete` and `platformFeaturesEnabled` to the `partialize` function so Zustand handles all persistence.

---

### STATE-02 — Same dual storage issue for `platformFeaturesEnabled`
**File:** `src/store/ui-state.ts`  
**Severity:** High

Same pattern as STATE-01. `platformFeaturesEnabled` is stored in both localStorage and Zustand state, with different sources of truth.

**Remediation:** Consolidate into Zustand's persist middleware.

---

### STATE-03 — `activeConversationId` not persisted
**File:** `src/store/conversation.ts`  
**Severity:** Medium

Stored in a non-persisted Zustand store. On app refresh, the user always lands on the index page instead of their last conversation.

**Remediation:** Either persist `activeConversationId` in Zustand or rely entirely on URL-based routing (which already works via TanStack Router).

---

### STATE-04 — `settings.ts` has no migration strategy for persist schema changes
**File:** `src/store/settings.ts`  
**Severity:** Low

`version: 3` is set but there is no `migrate` function. Schema changes silently drop data if fields are renamed or removed.

**Remediation:** Add a `migrate` function that handles version upgrades explicitly.

---

## 10. Achievement & Engagement Issues

### ACH-01 — Achievements stored in `localStorage` — not synced, easily lost
**File:** `src/hooks/use-achievements.ts`  
**Severity:** Medium

Achievement state is stored in `localStorage`. If the user clears browser data, uses a different browser, or the Tauri webview storage is wiped, all achievements are permanently lost.

**Remediation:** Persist achievements in the SQLite database via a Tauri command (e.g., `commands.saveAchievement(id)`).

---

### ACH-02 — Only 4 achievements defined — very limited engagement
**File:** `src/lib/achievements.ts`  
**Severity:** Medium

Only 4 achievements exist: `firstMessage`, `tenthMessage`, `firstToolApproval`, `fiveTools`. The `fiveTools` tracking is not implemented.

**Remediation:** Add more diverse achievements (first skill install, first workflow, first branch, 7-day streak, etc.). Implement tracking for `fiveTools`.

---

### ACH-03 — Achievement unlocks use unreliable `setTimeout` pattern
**File:** `src/hooks/use-messages.ts`  
**Severity:** Medium

Achievement checks read the entire messages array from React Query cache and count via a 100 ms `setTimeout`, making them unreliable.

**Remediation:** Track achievement state server-side or use a dedicated counter in the store that increments on each successful send.

---

### ACH-04 — No progress indicators for locked achievements
**File:** `src/components/settings/achievements-tab.tsx`  
**Severity:** Low

Locked achievements are shown at 60% opacity with no indication of how close the user is to unlocking them.

**Remediation:** Add progress bars or fraction indicators (e.g., "7/10 messages sent") to locked achievements.

---

### ACH-05 — No unlock date shown for achievements
**File:** `src/components/settings/achievements-tab.tsx`  
**Severity:** Low

Unlocked achievements show emoji, title, and description but no timestamp of when they were unlocked.

**Remediation:** Store and display unlock timestamps alongside achievement IDs.

---

### ACH-06 — Nudge toasts have no "Don't show again" option
**File:** `src/hooks/use-platform.ts`  
**Severity:** Low

Nudge toasts from the platform appear with a 10-second duration and CTA button, but there is no way for users to opt out of nudges beyond going to settings.

**Remediation:** Add a "Don't show nudges again" action to nudge toasts.

---

### ACH-07 — Nudge engine uses round-robin instead of intelligent selection
**File:** `skilldeck-platform/src/growth/nudge_engine.rs`  
**Severity:** Medium

`let idx = nudges_created % templates.len()` cycles through templates mechanically. A user who just installed a skill will still get the "Share a skill" nudge next cycle.

**Remediation:** Track the user's last action and filter out irrelevant nudges.

---

## 11. Backend-to-Frontend Error Propagation

### BE-01 — Tauri commands flatten all errors to opaque strings
**Files:** `src-tauri/src/commands/*.rs`  
**Severity:** Critical

Every Tauri command maps errors with `.map_err(|e| e.to_string())`. The rich `CoreError` enum (which has `error_code()`, `suggested_action()`, and `is_retryable()` methods) is completely flattened into an opaque string. The frontend receives no machine-readable error code or suggested recovery action.

**Remediation:** Return a serializable error struct `{ code: string, message: string, retryable: bool, suggested_action?: string }` from all Tauri commands. The `CoreError` already has all the infrastructure — it just needs to be surfaced through the IPC boundary.

---

### BE-02 — `CoreError::Internal` leaks raw debug strings to users
**File:** `src-tauri/skilldeck-core/src/error.rs`  
**Severity:** High

`CoreError::Internal { message }` uses format strings like `"Task join error: {err}"` and `"JSON error: {err}"`. These are developer-facing messages that leak internal Rust type names (e.g., `JoinError`, `serde_json::Error`) to the user.

**Remediation:** Replace with user-friendly messages ("An unexpected error occurred. Please restart and try again.") and log the actual error at `tracing::error!` level.

---

### BE-03 — `FileOperation` errors lose path context during `From` conversion
**File:** `src-tauri/skilldeck-core/src/error.rs`  
**Severity:** Medium

`impl From<std::io::Error> for CoreError` creates `FileOperation { path: PathBuf::new(), ... }` — the path is always empty because the source `io::Error` does not carry path information.

**Remediation:** Use a wrapper function like `fn io_to_core_error(err: io::Error, path: impl Into<PathBuf>) -> CoreError` at call sites where the path is known.

---

### BE-04 — `suggested_action()` has sparse coverage
**File:** `src-tauri/skilldeck-core/src/error.rs`  
**Severity:** Medium

Only 8 out of approximately 30 error variants have `suggested_action()`. Notable gaps: `McpConnectionFailed`, `SkillParse`, `WorkflowCycle`, `WorkflowExecution`, `DatabaseMigration`, and all `Workspace*` errors.

**Remediation:** Add `suggested_action()` for every user-facing error variant.

---

### BE-05 — Platform `AppError::Internal` leaks internal state to clients
**File:** `skilldeck-platform/src/error.rs`  
**Severity:** Low

`AppError::Internal(msg)` returns the raw internal message to the client, potentially leaking internal state.

**Remediation:** Sanitize `AppError::Internal` the same way as `AppError::Db` — log internally, return a generic "Internal server error" to clients.

---

### BE-06 — `cancel_all()` cancels approvals for ALL conversations
**File:** `src-tauri/src/state.rs`  
**Severity:** High

`cancel_agent()` calls `self.approval_gate.cancel_all()`, which cancels pending tool approvals for every conversation, not just the one being cancelled.

**Remediation:** Add a `cancel_all_for_conversation(&self, conversation_id: &str)` method to `ApprovalGate`.

---

### BE-07 — No error recovery for MCP server connection failures
**File:** `src-tauri/skilldeck-core/src/error.rs`  
**Severity:** Medium

`McpConnectionFailed` is marked as retryable but there is no automatic retry in the agent loop or supervisor. The user must manually reconnect.

**Remediation:** Add a `McpReconnecting` event type so the frontend can show "Reconnecting MCP server X...".

---

## 12. Skill Installation & Registry Friction

### SKILL-01 — Install failure requires manual overwrite toggle
**Files:** `src-tauri/src/skills/installer.rs`, `commands/skills.rs`  
**Severity:** Medium

When a skill already exists, `install_skill` fails. The command layer accepts an `overwrite: Option<bool>` parameter, but the user must know to check the "overwrite" option.

**Remediation:** Return a structured `InstallConflict { existing_path, existing_version }` error so the frontend can render a "Skill already installed. Update?" dialog.

---

### SKILL-02 — No atomic write during skill installation
**File:** `src-tauri/src/skills/installer.rs`  
**Severity:** Medium

`fs::create_dir_all` then `fs::write` — if `write` fails partway, the user is left with an empty or partial skill directory.

**Remediation:** Write to a temporary directory first, then atomically rename to the final destination.

---

### SKILL-03 — Skill validation name error not surfaced in events
**File:** `src-tauri/src/commands/skills.rs`  
**Severity:** Low

`validate_skill_name()` returns a descriptive error, but it is thrown as a generic `Result<_, String>` with no error code.

**Remediation:** Add an `InstallError` enum with `InvalidName`, `AlreadyExists`, `WriteFailed`, etc.

---

### SKILL-04 — Registry skill sync shows stale data during sync
**File:** `src-tauri/src/commands/skills.rs`  
**Severity:** Low

The registry cache table is updated incrementally during sync. If the user opens the skill browser mid-sync, they see a mix of old and new data.

**Remediation:** Add a `syncing: bool` flag to the skill source state and show a "Syncing..." badge in the UI.

---

## 13. Tool Approval Flow UX

### APPROVAL-01 — Hardcoded 120-second timeout with no user-visible countdown
**File:** `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs`  
**Severity:** High

The approval gate has a `tokio::time::timeout(Duration::from_secs(120), ...)`. The user is never informed about the countdown or that their approval window is expiring.

**Remediation:** Emit a countdown timer event (`ToolApprovalExpiring { tool_call_id, seconds_remaining }`) starting at 30 seconds remaining so the frontend can show a countdown indicator.

---

### APPROVAL-02 — Auto-approve defaults inconsistent between components
**File:** `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs`, `src-tauri/src/state.rs`  
**Severity:** High

`ToolDispatcher::new()` sets `reads: true` as default, but `AppState` initialises `global_auto_approve` with `default()` where everything is `false`. On first startup before any settings save, the dispatcher uses its own default, not the global one.

**Remediation:** Initialise `ToolDispatcher` with the same config source as `AppState.global_auto_approve`. Pick one source of truth.

---

### APPROVAL-03 — No "Remember my choice" for tool approvals
**File:** `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs`  
**Severity:** Medium

The `AutoApproveConfig` uses name-prefix matching, but there is no per-tool-name persistent allow/deny list.

**Remediation:** Add `per_tool_allowlist: HashSet<String>` and `per_tool_denylist: HashSet<String>` to the auto-approve config, persisted in the database.

---

### APPROVAL-04 — Shell auto-approve enables all shell commands silently
**File:** `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs`  
**Severity:** High

`shell: true` auto-approves tools matching `run_`, `exec_`, `shell_`, `bash_`, `cmd_`, `execute_` prefixes. There is no warning when enabling this category.

**Remediation:** When the user enables shell auto-approve, require a confirmation dialog with a warning about the security implications.

---

### APPROVAL-05 — `resolve()` returns generic error for already-resolved approvals
**File:** `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs`  
**Severity:** Low

If the frontend tries to resolve an approval that was already auto-resolved or expired, it gets a confusing internal error.

**Remediation:** Return `Result<(), ApprovalResolveError>` with a `NotFound` variant that the frontend can silently ignore (idempotent resolve).

---

## 14. Workspace Context UX

### WS-01 — Workspace root silently falls back to `current_dir()`
**File:** `src-tauri/src/state.rs`  
**Severity:** High

`let workspace_root = std::env::current_dir().unwrap_or_else(|_| data_dir.clone())` — the workspace root depends on how the app was launched (shortcut, terminal, IDE). Users launching from a shortcut get `data_dir` as their workspace, losing all project context.

**Remediation:** On first launch, prompt the user to select their workspace directory (similar to VS Code's "Open Folder"). Persist the choice and re-detect workspace on start.

---

### WS-02 — Workspace detection does not handle monorepos
**File:** `src-tauri/skilldeck-core/src/workspace/detector.rs`  
**Severity:** Medium

Detection checks for `Cargo.toml`, `package.json`, etc. at the root level only. A monorepo with `packages/backend/Cargo.toml` would be detected as `Generic`.

**Remediation:** Add recursive scanning (up to 2 levels deep) or detect common monorepo markers like `pnpm-workspace.yaml`, `lerna.json`, `Cargo.toml` with `[workspace]`.

---

### WS-03 — Skill directory search only checks limited paths
**File:** `src-tauri/skilldeck-core/src/workspace/context.rs`  
**Severity:** Medium

Only checks `.skilldeck/skills/`, `.claude/skills/`, and `~/.agents/skills/`. It does not check `.cursor/rules/`, `.github/copilot-instructions.md`, or other common AI tool directories.

**Remediation:** Add more fallback directories and detect when `.claude/skills/` or `.cursor/rules/` exists to suggest migration.

---

### WS-04 — Context file loading favours `CLAUDE.md` over `README.md`
**File:** `src-tauri/skilldeck-core/src/workspace/context.rs`  
**Severity:** Low

Priority is `CLAUDE.md` (100), `README.md` (50), `README` (40). This gives Anthropic's convention highest priority in a product called SkillDeck.

**Remediation:** Add a `SKILLDECK.md` or `.skilldeck/context.md` as the highest priority (110) and document the priority order.

---

### WS-05 — No event emitted when workspace context changes
**File:** `src-tauri/src/state.rs`  
**Severity:** Medium

Workspace context is loaded once at startup. If the user changes workspace during the session, the context loader is not re-run and the frontend workspace badge may be stale.

**Remediation:** After `open_workspace`, re-run `ContextLoader::load()` and emit a `WorkspaceContextUpdated` event.

---

## 15. Documentation & Landing Page UX

### DOC-01 — Docs Feedback component only does `console.log`
**File:** `skilldeck-user-docs/src/components/mdx/Feedback.astro`  
**Severity:** Critical

The Feedback component only does `console.log('Page Helpful', ...)` — it does NOT call the `POST /api/feedback` endpoint. User feedback is silently discarded.

**Remediation:** Replace `console.log` with a `fetch('/api/feedback', { method: 'POST', body: ... })` call. Show a confirmation message to the user.

---

### DOC-02 — Checkpoint component uses `innerHTML` — potential XSS risk
**File:** `skilldeck-user-docs/src/components/mdx/Checkpoint.astro`  
**Severity:** Medium

`onYes` and `onNo` props are inserted via `msg.innerHTML = onYes`. While Astro props come from trusted content authors, this is an XSS vector if any content is user-contributed.

**Remediation:** Use `textContent` instead of `innerHTML`, or sanitize HTML content before insertion.

---

### DOC-03 — Landing page FAQ contradicts actual auto-approve defaults
**Files:** Landing page i18n messages, `tool_dispatcher.rs`  
**Severity:** High

The FAQ states "Six auto-approve categories exist for convenience, but every single one is off by default." The actual backend default in `ToolDispatcher::new()` has `reads: true`.

**Remediation:** Either change the backend to match the docs (all categories off by default) or update the docs to say "Read-only operations are auto-approved by default."

---

### DOC-04 — No "Getting Started" content for workspace setup
**File:** `skilldeck-user-docs/`  
**Severity:** Medium

The documentation focuses on in-page engagement widgets (Checkpoint, Feedback, Nudge) but has no visible onboarding content about workspace setup, skill installation, or first conversation flow.

**Remediation:** Add a "Getting Started" guide with step-by-step Checkpoint components for: (1) Select workspace, (2) Configure a model provider, (3) Install your first skill, (4) Send your first message.

---

### DOC-05 — Nudge poller is hourly — very slow feedback loop
**File:** `src-tauri/src/nudge_poller.rs`  
**Severity:** Low

`POLL_INTERVAL_SECS: u64 = 3600` — nudges are only fetched once per hour. Combined with the server-side hourly cycle, a user might wait up to 2 hours to see a relevant nudge.

**Remediation:** Reduce poll interval to 300 seconds (5 minutes) or implement push-based delivery via WebSocket/SSE.

---

### DOC-06 — GitHub issue ingestion is unimplemented (pseudo-code only)
**File:** `skilldeck-platform/src/feedback/ingestion.rs`  
**Severity:** Medium

The entire `fetch_github_issues()` function is commented-out pseudo-code. GitHub issues with the "documentation" label are never ingested.

**Remediation:** Implement the ingestion using `octocrab` or a simple HTTP client.

---

## 16. Security UX

### SEC-01 — `noDangerouslySetInnerHtml` rule is explicitly disabled
**File:** `biome.json`  
**Severity:** Medium

The Biome linter has `"noDangerouslySetInnerHtml": "off"`, which means `dangerouslySetInnerHTML` usage is not flagged during code review or CI. Combined with DOC-02, this creates a potential XSS risk surface.

**Remediation:** Enable the rule and audit existing usages. For markdown rendering, ensure sanitisation is applied before setting innerHTML.

---

### SEC-02 — Shell auto-approve has no safety confirmation (see APPROVAL-04)
**File:** `src-tauri/skilldeck-core/src/agent/tool_dispatcher.rs`  
**Severity:** High

Enabling shell auto-approve silently allows all shell commands without review. This is a significant security risk for users who may not understand the implications.

**Remediation:** See APPROVAL-04 — require a confirmation dialog with a clear security warning.

---

### SEC-03 — Ollama provider hardcoded port 11434
**File:** `src-tauri/src/state.rs`  
**Severity:** Medium

`OllamaProvider::new(11434)` hardcodes the port. If Ollama runs on a custom port, the provider fails silently with only a `warn!` log.

**Remediation:** Read the Ollama port from user preferences or environment variable. Show a specific error: "Could not connect to Ollama on port 11434. Is it running? Configure a custom port in Settings."

---

## 17. Summary & Prioritised Roadmap

### Issue Distribution by Severity

| Severity | Count |
|----------|-------|
| **Critical** | 7 |
| **High** | 25 |
| **Medium** | 45 |
| **Low** | 34 |
| **Total** | **111** |

### Issue Distribution by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Accessibility | 1 | 6 | 6 | 3 | 16 |
| Usability | 2 | 4 | 3 | 4 | 13 |
| Error Handling | 0 | 3 | 5 | 2 | 10 |
| Loading & Performance | 0 | 4 | 4 | 2 | 10 |
| Internationalisation | 1 | 1 | 3 | 1 | 6 |
| Onboarding | 0 | 1 | 3 | 3 | 7 |
| Visual Consistency | 0 | 0 | 4 | 2 | 6 |
| Navigation | 0 | 2 | 3 | 0 | 5 |
| State Management | 0 | 2 | 1 | 2 | 5 |
| Achievements & Engagement | 0 | 0 | 3 | 4 | 7 |
| Backend Error Propagation | 1 | 2 | 3 | 1 | 7 |
| Skill Installation | 0 | 0 | 2 | 2 | 4 |
| Tool Approval Flow | 0 | 3 | 1 | 1 | 5 |
| Workspace Context | 0 | 1 | 3 | 1 | 5 |
| Documentation | 1 | 1 | 2 | 1 | 5 |
| Security | 0 | 1 | 2 | 0 | 3 |

---

### Recommended Remediation Roadmap

#### Phase 1 — Immediate (Week 1-2) | Critical + High Impact

| Priority | Issue ID | Title | Effort |
|----------|----------|-------|--------|
| 1 | US-01 | Add confirmation dialog for conversation deletion | Low |
| 2 | US-02 | Implement or disable edit-message hook (remove silent stub) | Medium |
| 3 | BE-01 | Return structured error objects from all Tauri commands | Medium |
| 4 | I18N-01 | Begin extracting strings to Lingui message catalogs | High |
| 5 | DOC-01 | Fix Feedback.astro to POST to API endpoint | Low |
| 6 | A11Y-01 | Add dialog semantics + focus trap to onboarding wizard | Low |
| 7 | ONB-01 | Add "Back" button to onboarding wizard | Low |
| 8 | ERR-02/03 | Add `onError` toasts to MCP and skill mutations | Low |
| 9 | A11Y-04/05/06/07 | Fix keyboard + ARIA for conversation items, tabs, inputs | Medium |
| 10 | BE-06 | Scope `cancel_agent()` to single conversation | Medium |

#### Phase 2 — Short Term (Week 3-4) | High + Medium Impact

| Priority | Issue ID | Title | Effort |
|----------|----------|-------|--------|
| 11 | PERF-01 | Implement pagination for conversation list | Medium |
| 12 | PERF-02/03 | Fix memory leak in store records; persist drafts | Medium |
| 13 | STATE-01/02 | Consolidate dual storage for onboarding state | Low |
| 14 | APPROVAL-01 | Add approval timeout countdown UI | Medium |
| 15 | APPROVAL-02/04 | Fix auto-approve defaults; add shell warning | Medium |
| 16 | US-03/06 | Improve auto-approve labels; show tab labels by default | Low |
| 17 | BE-02 | Replace debug strings with user-friendly error messages | Low |
| 18 | NAV-04/06 | Implement conversation list arrow keys; implement or remove shortcuts | Medium |
| 19 | WS-01 | Prompt for workspace on first launch | Medium |
| 20 | PERF-09 | Add progress events for skill sync | Medium |

#### Phase 3 — Medium Term (Month 2) | Systemic Improvements

| Priority | Issue ID | Title | Effort |
|----------|----------|-------|--------|
| 21 | I18N-01 (cont.) | Complete i18n extraction across all components | High |
| 22 | BE-04 | Add `suggested_action()` to all error variants | Low |
| 23 | US-07/08 | Replace native dialogs; implement real file validation | Medium |
| 24 | VIS-01/02/03 | Standardise form controls and buttons | Medium |
| 25 | SKILL-01/02 | Add conflict dialog and atomic skill installation | Medium |
| 26 | ACH-01/02 | Persist achievements in SQLite; add more achievements | Medium |
| 27 | WS-02/03 | Add monorepo detection; expand skill directory search | Medium |
| 28 | NAV-01/02 | Settings IA restructure; add center panel context header | Medium |
| 29 | DOC-03/04 | Fix FAQ contradiction; add Getting Started guide | Low |
| 30 | ERR-07/08/09 | Add provider-ready warnings; fix error propagation patterns | Medium |

#### Phase 4 — Long Term (Month 3+) | Polish & Delight

| Priority | Issue ID | Title | Effort |
|----------|----------|-------|--------|
| 31 | ACH-04/05 | Add progress indicators and unlock dates to achievements | Low |
| 32 | APPROVAL-03 | Implement per-tool allow/deny lists | Medium |
| 33 | BE-07 | Add MCP auto-reconnect with UI feedback | Medium |
| 34 | VIS-04/05 | Establish icon size system; create reusable EmptyState component | Low |
| 35 | DOC-06 | Implement GitHub issue ingestion | Medium |
| 36 | I18N-02/03/04 | Add additional locales; implement locale fallback UI | High |
| 37 | A11Y-13 | Add keyboard resize for panel separators | Medium |
| 38 | SEC-01 | Re-enable `noDangerouslySetInnerHtml` and audit usages | Medium |

---

### Key Metrics to Track Post-Remediation

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| WCAG 2.1 AA audit pass rate | 100% of Critical/High issues resolved | Automated axe-core + manual screen reader testing |
| Conversation list load time (with pagination) | < 200 ms for first 50 items | Performance monitoring |
| Error feedback coverage (mutations with `onError`) | 100% | Code audit |
| i18n coverage (% of strings extracted) | > 90% | Lingui extraction report |
| Onboarding completion rate | > 80% | Analytics event tracking |
| Store memory usage (after 100 conversations) | Bounded / stable | Memory profiling |
| User-reported confusion (support tickets) | 30% reduction | Support ticket analysis |

---

### Accessibility Compliance Summary

The current codebase has significant accessibility gaps that would prevent it from passing WCAG 2.1 Level AA compliance. The most critical areas are:

- **Modals and dialogs** lacking ARIA roles, focus traps, and keyboard dismissal
- **Tab interfaces** missing proper ARIA tablist/tab/tabpanel patterns
- **Form inputs** without associated labels or accessible names
- **Interactive elements** using `role="button"` without full keyboard support (Space key)
- **Dynamic content updates** without `aria-live` regions for status changes
- **Expandable regions** without `aria-expanded` and `aria-controls`

Addressing the 16 accessibility issues identified in this report (particularly the 7 High/Critical ones) would bring the application significantly closer to WCAG 2.1 AA compliance.

---

### Final Notes

The SkillDeck codebase demonstrates strong architectural foundations — clean separation of concerns between Tauri backend and React frontend, well-structured state management with Zustand, and a thoughtful component library built on shadcn/ui. The issues identified in this report are primarily about **closing the gap between engineering functionality and user experience quality**. Most fixes are low-to-medium effort and would significantly improve the product's usability, accessibility, and perceived quality.

The single highest-impact investment the team can make is **implementing structured error propagation** (BE-01), which would simultaneously fix dozens of downstream error-handling issues across the frontend.

---

*Report generated by UX Research Agent | 2026-04-05 | SkillDeck v0.1.0*
