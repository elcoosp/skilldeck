# SkillDeck UX Research Analysis: Semi-Implemented Features & Gaps

## 🎯 Research Overview

### Objectives
- **Primary Questions**: What features are currently partially implemented or missing from the user experience? How do these gaps affect user workflows and satisfaction?
- **Methods Used**: Codebase inspection, feature mapping, interaction flow analysis, and heuristic evaluation.
- **Participants**: (Indirect) Developers and end-users inferred from code comments, missing UI elements, and incomplete API integrations.
- **Timeline**: Analysis of codebase snapshot (March 2026).

### Key Findings Summary
1. **Workflow Execution is Unreachable**: Users can create and save workflows but cannot run them from the UI. The workflow engine exists in the backend but lacks a frontend trigger.
2. **Skill Sharing is Hidden**: The `ShareSkillModal` is implemented but never surfaced in the skill card or detail panel, preventing users from sharing skills as GitHub Gists.
3. **Lint Rule Configuration is Inaccessible**: The `LintConfig` component exists but is not added to the settings overlay, leaving users unable to disable lint rules.
4. **Global Search is Incomplete**: Clicking a search result does not scroll to the specific message, breaking the primary intent of the feature.
5. **Workflow Editor is Developer-Only**: The only interface for creating workflows is raw JSON editing, which is inaccessible to non-technical users.
6. **Achievements Are Uncelebrated**: The `useAchievements` hook triggers toasts, but there is no dedicated UI to view unlocked achievements, reducing motivation.
7. **Skill Source Management is Hidden**: The `SkillSources` component is not wired into settings, preventing users from adding custom skill directories.
8. **Internationalization is Half-Implemented**: While i18n is set up, there is no language switcher in the main app, limiting global adoption.
9. **Platform Integration Has Opaque Errors**: The platform registration flow shows generic error messages, and some platform commands are marked as binary in the codebase, indicating incomplete API coverage.
10. **MessageThread Logging Clutters Console**: Excessive `console.log` statements in production build will degrade performance and confuse users if they inspect the console.

## 👥 User Insights

### User Personas

**Primary Persona: Alex – Senior Developer (Power User)**
- **Demographics**: 28–40, experienced in DevOps and AI tooling.
- **Goals**: Automate complex tasks, share reusable AI skills with team, fine‑tune workflows.
- **Pain Points**: Cannot share skills from the UI; cannot run workflows from the UI; must edit JSON to create workflows.
- **Behaviors**: Spends hours tuning workflows, expects version‑controlled skills, looks for community‑shared content.

**Secondary Persona: Jamie – Team Lead (Manager)**
- **Demographics**: 35–50, oversees multiple developers, cares about team productivity.
- **Goals**: Enable team to adopt AI‑assisted development, track team usage, get insights.
- **Pain Points**: No visibility into team skill usage (analytics exist but not surfaced), no way to manage skill sources centrally.
- **Behaviors**: Prefers UI over configuration files, looks for metrics to justify tool adoption.

**Tertiary Persona: Sam – New User (Beginner)**
- **Demographics**: 22–30, new to AI tools, wants guided onboarding.
- **Goals**: Quickly start a conversation, understand what skills are, install community skills.
- **Pain Points**: Onboarding wizard covers basic API key and email but doesn’t explain skills or workflows; no in-app guidance for advanced features.
- **Behaviors**: Relies heavily on UI hints, expects consistent feedback, may abandon if stuck.

### User Journey Mapping

| Phase | Touchpoints | Pain Points | Opportunities |
|-------|-------------|-------------|----------------|
| **Discovery** | Landing page, docs | No interactive demo; feature list is text. | Add a sandbox or guided tour. |
| **Onboarding** | Welcome wizard, settings | API key step assumes familiarity; platform email step is optional but unclear benefit. | Show benefits of platform features upfront; provide example keys. |
| **First Conversation** | Center panel, message input | Unclear how to use skills; no example prompt suggestions. | Provide a “Try a skill” button or sample prompts. |
| **Skill Exploration** | Skills tab, marketplace | Skill cards show status but no share button; update available badge leads to diff but not auto‑update. | Add share icon, one‑click update. |
| **Workflow Creation** | Workflow tab, JSON editor | Non‑technical users stuck; no visual editor. | Integrate node‑based editor (e.g., using @xyflow/react already in dependencies). |
| **Sharing & Collaboration** | (Missing) | No way to share skills or workflows from UI. | Expose share modal in skill detail and workflow list. |
| **Customization** | Settings | No lint rule config, no skill source management. | Add missing tabs to settings overlay. |
| **Feedback Loop** | In‑app, platform | No feedback form; nudge system exists but may feel intrusive. | Add a “Give feedback” button in help menu. |

## 📊 Usability Findings

### Task Performance (Inferred)

| Task | Completion Rate (Estimated) | Pain Points |
|------|----------------------------|-------------|
| Start a conversation | High (90%) | Users may not know about profile selection. |
| Install a skill | Medium (70%) | Blocked skills require extra confirmation; registry sync might fail silently. |
| Share a skill | Low (0%) | Feature not surfaced in UI. |
| Create a workflow | Very Low (10%) | JSON editing is intimidating; no visual guidance. |
| Run a workflow | None (0%) | No “Run” button. |
| Disable a lint rule | None (0%) | No UI to access this setting. |
| Add custom skill source | None (0%) | No UI to manage sources. |

### User Satisfaction (Qualitative)
- Users would likely appreciate the powerful backend but become frustrated when encountering missing UI affordances.
- The skill marketplace and lint warnings provide good feedback, but the lack of share/update shortcuts reduces perceived value.
- Workflow users may abandon the feature entirely without a visual editor.

## 🎯 Recommendations

### High Priority (Immediate Action)
1. **Add Missing UI Tabs to Settings Overlay**  
   - Include **Lint Rules** and **Skill Sources** tabs in the settings sidebar.  
   - Implement a toggle list for lint rules and a form to add/remove skill source directories.  
   - **Impact**: Empowers power users and enables proper configuration.  
   - **Effort**: Medium (existing components just need wiring).  
   - **Success Metric**: Settings page includes both tabs, and users can successfully disable rules/add sources.

2. **Add Share Button to Skill Cards/Detail**  
   - Place a “Share as Gist” button in `SkillDetailPanel` and optionally on `UnifiedSkillCard`.  
   - Trigger `ShareSkillModal` when clicked.  
   - **Impact**: Unlocks the knowledge‑compounding value of the product.  
   - **Effort**: Low (modal already exists).  
   - **Success Metric**: Share action is used by at least 10% of active users within a month.

3. **Complete Global Search Scroll-to-Message**  
   - Implement the commented‑out `scroll to specific message` logic in `GlobalSearchModal` to navigate to the message after selecting a result.  
   - **Impact**: Makes search truly useful; users expect to jump to results.  
   - **Effort**: Low (backend already provides message ID; need frontend scroll logic).  
   - **Success Metric**: Users report search as helpful in feedback.

4. **Add “Run” Button to Workflow List**  
   - In `WorkflowTab`, add a “Run” button next to each saved workflow.  
   - Call the backend workflow executor (needs command to be added if missing) and show live progress.  
   - **Impact**: Workflows become usable; closes a major gap.  
   - **Effort**: Medium (backend executor exists; need to expose via Tauri command and UI integration).  
   - **Success Metric**: Workflow executions recorded in analytics.

### Medium Priority (Next Quarter)
5. **Introduce Visual Workflow Editor**  
   - Replace the JSON textarea with a node‑based editor using `@xyflow/react`.  
   - Allow drag‑and‑drop steps, define dependencies visually.  
   - **Impact**: Democratizes workflow creation; reduces friction for non‑technical users.  
   - **Effort**: High (new component, state management, serialization).  
   - **Success Metric**: 30% increase in workflow creation rate.

6. **Add Achievements Dashboard**  
   - Create a new tab in settings or a separate modal to show unlocked achievements and progress toward others.  
   - Use the existing `useAchievements` store.  
   - **Impact**: Gamification boosts engagement and encourages exploration.  
   - **Effort**: Medium (UI development).  
   - **Success Metric**: Users refer to achievements in feedback.

7. **Implement Language Switcher in Main App**  
   - Add a language selector (e.g., in settings) and use `i18n` to switch locale.  
   - Translate key UI strings for at least one additional language (e.g., French).  
   - **Impact**: Expands global reach; fulfills i18n commitment.  
   - **Effort**: Medium (translations, UI).  
   - **Success Metric**: Non‑English users increase.

8. **Improve Platform Error Messaging**  
   - Show specific error messages when platform registration fails (e.g., network, auth, server).  
   - Add a retry button with exponential backoff in the UI.  
   - **Impact**: Reduces user confusion and support tickets.  
   - **Effort**: Low (modify existing error handling).  
   - **Success Metric**: Decrease in support inquiries about platform connection.

### Long-term Opportunities
9. **Build a Skill/Workflow Gallery**  
   - Extend the marketplace to include user‑submitted skills and workflows via Gist integration.  
   - Allow rating, comments, and installation counts.  
   - **Impact**: Creates a community ecosystem; aligns with “Team Knowledge” win theme.  
   - **Effort**: High (requires backend for aggregation, moderation).  
   - **Success Metric**: 100+ community skills shared within 6 months.

10. **Conduct Usability Testing on Onboarding Flow**  
    - Recruit 10 new users to test the onboarding wizard and first conversation.  
    - Observe where they get stuck (e.g., API key step, profile selection).  
    - Iterate based on findings.  
    - **Impact**: Reduces drop‑off rate; improves retention.  
    - **Effort**: Medium (planning, recruitment, analysis).  
    - **Success Metric**: Onboarding completion rate >85%.

11. **Add In-App Feedback Mechanism**  
    - Include a “Feedback” button (e.g., in help menu) that opens a modal.  
    - Send feedback to platform using existing `sendActivityEvent` or a dedicated endpoint.  
    - **Impact**: Provides direct channel for user input; complements nudge system.  
    - **Effort**: Low (modal + API call).  
    - **Success Metric**: 5+ feedback submissions per week.

## 📈 Success Metrics

### Quantitative Measures
- Task completion rate for sharing a skill: **0% → 15%** within first month after adding share button.
- Workflow creation rate: **<1% → 10%** after visual editor introduction.
- Settings page usage: **+200%** after adding missing tabs.
- Global search usage: **+50%** after scroll-to-message fix.
- Language switcher adoption: **5%** of users choose non‑English locale.

### Qualitative Indicators
- User interviews: “I love that I can finally share my skills with my team.”
- Reduced frustration: “I couldn’t figure out how to run the workflow I made – where’s the play button?”
- Positive sentiment: “The workflow editor is like a superpower for automating my code reviews.”

---
**UX Researcher**: AI UX Research Agent  
**Research Date**: March 2026  
**Next Steps**:  
1. Present findings to product and engineering teams.  
2. Prioritize high‑impact recommendations for next sprint.  
3. Schedule usability testing for onboarding flow.  
**Impact Tracking**: Re‑evaluate after 3 months to measure improvements in task completion and satisfaction.

I'm using the writing-plans skill to create the implementation plan.

# SkillDeck UX Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete missing UI features identified in UX research: add missing settings tabs, enable skill sharing, complete global search, add workflow run button, improve platform error handling, remove console logs, add achievements dashboard, and add language switcher.

**Architecture:** Frontend React with Zustand stores, TanStack Query, and Tauri IPC. Backend Rust (skilldeck-core) with existing WorkflowExecutor and event system. Changes are primarily frontend with one new Tauri command for workflow execution.

**Tech Stack:** React, TypeScript, Tailwind CSS, Zustand, TanStack Query, Tauri (Rust backend).

---

## Chunk 1: Settings – Add Lint Rules and Skill Sources Tabs

**Goal:** Make the existing `LintConfig` and `SkillSources` components accessible from the settings overlay.

**Files:**
- Modify: `src/components/overlays/settings-overlay.tsx`
- No changes to lint-config.tsx or skill-sources.tsx (they already self‑contained)

- [ ] **Step 1: Import the missing components in settings-overlay.tsx**

Add imports for `LintConfig` and `SkillSources`:

```tsx
import { LintConfig } from '@/components/settings/lint-config'
import { SkillSources } from '@/components/settings/skill-sources'
```

- [ ] **Step 2: Extend the settings tabs array to include new tabs**

In the `settings-overlay.tsx`, find the array of tab definitions (around line 45) and add two new entries:

```tsx
{
  id: 'lint',
  label: 'Lint Rules',
  Icon: AlertTriangle  // or any appropriate icon (import from lucide-react)
},
{
  id: 'sources',
  label: 'Skill Sources',
  Icon: Folder
}
```

Make sure to import the icons: `AlertTriangle`, `Folder`.

- [ ] **Step 3: Add conditional rendering for new tabs**

In the content pane section (after the sidebar), add new cases:

```tsx
{settingsTab === 'lint' && <LintConfig />}
{settingsTab === 'sources' && <SkillSources />}
```

- [ ] **Step 4: Update the type definition for SettingsTab**

In `src/store/ui.ts`, update the `SettingsTab` type to include the new tab IDs:

```ts
type SettingsTab =
  | 'apikeys'
  | 'profiles'
  | 'approvals'
  | 'appearance'
  | 'preferences'
  | 'referral'
  | 'platform'
  | 'lint'          // new
  | 'sources'       // new
```

- [ ] **Step 5: Test**

Run the app, open settings, verify the new tabs appear, and that their content renders correctly.

---

## Chunk 2: Skill Sharing – Add Share Button to Skill Detail Panel

**Goal:** Allow users to share a skill as a GitHub Gist directly from the skill detail panel.

**Files:**
- Modify: `src/components/skills/skill-detail-panel.tsx`
- The modal `ShareSkillModal` already exists.

- [ ] **Step 1: Import the ShareSkillModal component**

Add at the top of `skill-detail-panel.tsx`:

```tsx
import { ShareSkillModal } from '@/components/skills/share-skill-modal'
```

- [ ] **Step 2: Add state for controlling modal visibility**

Inside the component, add:

```tsx
const [showShareModal, setShowShareModal] = useState(false)
```

- [ ] **Step 3: Add a “Share as Gist” button**

In the actions section (bottom of the panel), add a new button, e.g., after the “Re-lint” button:

```tsx
<Button
  variant="outline"
  className="w-full"
  onClick={() => setShowShareModal(true)}
  disabled={isBusy}
>
  <Share2 className="mr-2 h-3.5 w-3.5" />
  Share as Gist
</Button>
```

Import `Share2` from `lucide-react`.

- [ ] **Step 4: Render the modal when state is true**

Add at the end of the component (after the `ConflictResolver`):

```tsx
{showShareModal && skill.localData?.path && (
  <ShareSkillModal
    skillName={skill.name}
    contentMd={skill.localData?.content_md ?? ''}
    onClose={() => setShowShareModal(false)}
  />
)}
```

Note: We need to pass the skill content. For local skills, we have `localData.content_md`. For registry-only skills, they are not installed, so we only show share button when the skill is installed (local). We can conditionally render the button only when `skill.localData` exists.

- [ ] **Step 5: Add share button to UnifiedSkillCard (optional but recommended)**

In `src/components/skills/unified-skill-card.tsx`, add a share button next to the install/update buttons (if skill is installed). This provides quicker access.

- [ ] **Step 6: Test**

Open a skill detail for an installed skill, click “Share as Gist”, and verify the modal appears and works (requires GitHub token). If no token, it should prompt.

---

## Chunk 3: Global Search – Implement Scroll to Message

**Goal:** When a user clicks a search result, the app should navigate to the conversation and scroll to the specific message, highlighting it.

**Files:**
- Modify: `src/components/search/global-search-modal.tsx`
- Modify: `src/components/layout/center-panel.tsx`
- Modify: `src/store/ui.ts` (add scroll target state)

- [ ] **Step 1: Add scroll target state to UI store**

In `src/store/ui.ts`, add:

```ts
// In the UIState interface
scrollToMessageId: string | null
setScrollToMessageId: (id: string | null) => void

// In the store implementation
scrollToMessageId: null,
setScrollToMessageId: (id) => set({ scrollToMessageId: id })
```

- [ ] **Step 2: In global-search-modal, set active conversation and scroll target**

Modify `handleSelectResult`:

```ts
const handleSelectResult = (result: GlobalSearchResult) => {
  setActiveConversation(result.conversation_id)
  setScrollToMessageId(result.message_id)
  onClose()
}
```

- [ ] **Step 3: In CenterPanel, watch for scroll target and scroll to message**

Add a `useEffect` in `CenterPanel` that watches `scrollToMessageId` and `messages`:

```ts
const scrollToMessageId = useUIStore((s) => s.scrollToMessageId)
const setScrollToMessageId = useUIStore((s) => s.setScrollToMessageId)

useEffect(() => {
  if (!scrollToMessageId || !messages.length) return
  const targetMessage = messages.find(m => m.id === scrollToMessageId)
  if (targetMessage) {
    // Find index in original messages (not filtered by search)
    const fullIndex = messages.findIndex(m => m.id === scrollToMessageId)
    threadRef.current?.scrollToMessage(fullIndex)
    // Highlight the message (flash)
    setHighlightedMessageId(scrollToMessageId)
    setTimeout(() => setHighlightedMessageId(null), 800)
    setScrollToMessageId(null)
  }
}, [scrollToMessageId, messages, setScrollToMessageId])
```

- [ ] **Step 4: Ensure MessageThread exposes scrollToMessage**

`MessageThread` already has `scrollToMessage` method. The ref is `threadRef` in `CenterPanel`. Confirm it works.

- [ ] **Step 5: Test**

Search for a term, click a result, verify you're taken to the conversation and the message is scrolled into view and flashes.

---

## Chunk 4: Workflow Execution – Add Run Button

**Goal:** Allow users to execute a saved workflow from the UI and see its progress.

**Backend:** Add a Tauri command that accepts a workflow definition ID or JSON and runs it via `WorkflowExecutor`.

**Frontend:** Add a “Run” button in the Workflow tab next to each saved workflow.

**Files:**
- Create: `src-tauri/src/commands/workflow_execution.rs` (or add to existing workflows.rs)
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs` (register new command)
- Modify: `src/components/layout/right-panel.tsx` (WorkflowTab)
- Possibly modify: `src/hooks/use-workflow-definitions.ts` (add run mutation)

- [ ] **Step 1: Create backend command to run a workflow**

In `src-tauri/src/commands/workflows.rs`, add a new command:

```rust
#[specta]
#[tauri::command]
pub async fn run_workflow_definition(
    state: State<'_, Arc<AppState>>,
    id: String, // workflow definition ID
) -> Result<String, String> {
    let db = state.registry.db.connection().await.map_err(|e| e.to_string())?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let def = skilldeck_models::workflow_definitions::Entity::find_by_id(uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Workflow definition {} not found", id))?;

    // Deserialize definition_json into WorkflowDefinition
    let definition: skilldeck_core::workflow::types::WorkflowDefinition = serde_json::from_value(def.definition_json)
        .map_err(|e| e.to_string())?;

    // Create a channel for events
    let (tx, mut rx) = tokio::sync::mpsc::channel::<skilldeck_core::workflow::types::WorkflowEvent>(128);

    // Spawn execution
    let provider_id = "ollama".to_string(); // Or resolve from profile later
    let model_id = skilldeck_core::providers::OllamaProvider::fetch_installed_models()
        .await
        .into_iter()
        .next()
        .map(|m| m.id)
        .unwrap_or_else(|| "llama3.2:latest".to_string());

    let provider = state.registry.get_provider(&provider_id)
        .ok_or_else(|| format!("Provider {} not available", provider_id))?;

    let executor = skilldeck_core::workflow::WorkflowExecutor::with_provider(
        tx,
        provider,
        model_id,
        state.config.agent.max_eval_opt_iterations,
    );

    let execution_id = Uuid::new_v4();
    let execution_id_str = execution_id.to_string();

    // Spawn task to run the workflow
    let app_handle = state.app_handle.clone();
    tokio::spawn(async move {
        // Start execution
        let state_result = executor.execute(definition).await;
        // Forward events from rx to Tauri events? Or store results.
        // For now, we'll just log and maybe emit a workflow-event.
        while let Some(event) = rx.recv().await {
            // Emit as Tauri event (if needed)
            let _ = app_handle.emit("workflow-event", event);
        }
        match state_result {
            Ok(final_state) => {
                // Emit completion event
                let _ = app_handle.emit("workflow-event", skilldeck_core::workflow::types::WorkflowEvent::Completed { id: final_state.id });
            }
            Err(e) => {
                let _ = app_handle.emit("workflow-event", skilldeck_core::workflow::types::WorkflowEvent::Failed { id: execution_id, error: e.to_string() });
            }
        }
    });

    Ok(execution_id_str)
}
```

- [ ] **Step 2: Register the command**

In `src-tauri/src/commands/mod.rs`, add:

```rust
pub mod workflows;
```

In `src-tauri/src/lib.rs`, add `run_workflow_definition` to the `collect_commands!` macro.

- [ ] **Step 3: Add run mutation hook**

In `src/hooks/use-workflow-definitions.ts`, add:

```ts
export function useRunWorkflowDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await (commands as any).runWorkflowDefinition(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data as string // execution ID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] })
    }
  })
}
```

- [ ] **Step 4: Add run button to WorkflowTab**

In `src/components/layout/right-panel.tsx`, in the `WorkflowTab` component, add a button to each saved workflow:

```tsx
<div key={wf.id} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/30 transition-colors">
  <div className="flex-1 min-w-0">
    <p className="text-xs font-medium truncate">{wf.name}</p>
    <p className="text-[10px] text-muted-foreground">
      Updated {new Date(wf.updated_at).toLocaleDateString()}
    </p>
  </div>
  <Button
    size="icon-xs"
    variant="ghost"
    onClick={() => runMutation.mutate(wf.id)}
    disabled={runMutation.isPending}
    title="Run workflow"
  >
    <Play className="size-3" />
  </Button>
  <Button
    variant="ghost"
    size="icon-xs"
    onClick={() => handleDelete(wf.id, wf.name)}
    className="text-muted-foreground hover:text-destructive"
  >
    <Trash2 className="size-3" />
  </Button>
</div>
```

Import `Play` from `lucide-react`.

- [ ] **Step 5: Display running workflow progress (already implemented via useWorkflowEvents)**

The existing `useWorkflowEvents` hook already listens to `workflow-event` and updates `progress`. The `WorkflowTab` already shows the active workflow if `progress` is set. So after run, the progress will appear automatically.

- [ ] **Step 6: Test**

Create a simple workflow, save it, click Run. Verify that the active workflow progress appears and the workflow runs (stub results). Eventually, real results will appear as we implement step execution.

---

## Chunk 5: Platform Error Messaging – Improve Error Handling

**Goal:** Show specific error messages when platform registration or sync fails, and provide retry options.

**Files:**
- Modify: `src/components/settings/platform-tab.tsx`
- Modify: `src/components/skills/platform-status-banner.tsx`
- Modify: `src/hooks/use-platform.ts` (maybe)

- [ ] **Step 1: Capture more specific errors in registration mutation**

In `src/hooks/use-platform.ts`, the `usePlatformRegistration` mutation already returns errors. We can inspect the error message to differentiate.

- [ ] **Step 2: In PlatformTab, show detailed error message**

In `PlatformTab`, when `register.isError`, display a more descriptive error based on the error string. For example:

```tsx
{register.isError && (
  <div className="text-destructive text-xs mt-2">
    {register.error?.message.includes('Network') ? 'Network error – check your connection' :
     register.error?.message.includes('401') ? 'Invalid API key – check your platform token' :
     `Registration failed: ${register.error.message}`}
  </div>
)}
```

- [ ] **Step 3: Add retry button for registration failure**

Add a "Retry" button that calls `register.mutate()` again.

- [ ] **Step 4: Improve platform-status-banner error handling**

In `src/components/skills/platform-status-banner.tsx`, we already have `onEnable`, `onRetry`, `onRegister` props. We need to pass the actual error message to differentiate.

In `UnifiedSkillList`, where the banner is used, we can pass the error message from `registryError`:

```tsx
<PlatformStatusBanner
  variant={!platformFeaturesEnabled ? 'disabled' : registryError ? 'error' : null}
  onEnable={handleEnablePlatform}
  onRetry={() => syncMutation.mutate()}
  onRegister={() => { setSettingsTab('platform'); setSettingsOpen(true); }}
  errorMessage={registryError?.message}
/>
```

Then in `platform-status-banner.tsx`, check `errorMessage?.includes('Not configured')` to show the registration prompt.

- [ ] **Step 5: Test**

Disable network or use invalid API key, verify the error message is clear and retry works.

---

## Chunk 6: Console Logs – Remove or Condition

**Goal:** Remove all `console.log` statements in production builds to avoid clutter.

**Files:** Many files in `src/` (potentially all `.tsx`, `.ts`).

- [ ] **Step 1: Identify all `console.log` occurrences**

Run a search in the codebase for `console.log`. List files (many). We'll replace them with a conditional wrapper.

- [ ] **Step 2: Create a utility function for debug logging**

Add `src/lib/debug.ts`:

```ts
export const debug = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args)
  }
}
```

- [ ] **Step 3: Replace `console.log` with `debug` calls**

For each occurrence, replace with `debug(...)`. For example:

```ts
console.log('Loading...') → debug('Loading...')
```

- [ ] **Step 4: Remove any `console.log` that is clearly leftover debugging (like inside components that are not meant to log)**

We'll need to be careful to preserve meaningful logs that might be used for debugging in dev, but remove them in prod.

- [ ] **Step 5: Verify production build doesn't contain console.log**

Run `pnpm build` and check the output bundle for `console.log` strings. Use `grep` or manual inspection.

---

## Chunk 7: Achievements Dashboard – Add Achievements Tab in Settings

**Goal:** Display unlocked achievements and progress toward others.

**Files:**
- Create: `src/components/settings/achievements-tab.tsx`
- Modify: `src/components/overlays/settings-overlay.tsx`
- Modify: `src/store/ui.ts` (add tab ID)

- [ ] **Step 1: Create AchievementsTab component**

`src/components/settings/achievements-tab.tsx`:

```tsx
import { useAchievements } from '@/hooks/use-achievements'
import { ACHIEVEMENTS } from '@/lib/achievements'

export function AchievementsTab() {
  const { isUnlocked } = useAchievements()
  const allAchievements = Object.entries(ACHIEVEMENTS).map(([key, value]) => ({
    id: key,
    ...value
  }))

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Achievements</h2>
      <div className="grid grid-cols-1 gap-2">
        {allAchievements.map(ach => (
          <div
            key={ach.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${isUnlocked(ach.id) ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'}`}
          >
            <span className="text-2xl">{ach.emoji}</span>
            <div>
              <p className="font-medium">{ach.title}</p>
              <p className="text-xs text-muted-foreground">{ach.description}</p>
            </div>
            {isUnlocked(ach.id) && <CheckCircle2 className="ml-auto text-green-500" />}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add achievements tab to settings**

In `settings-overlay.tsx`, import `AchievementsTab` and add to tab list:

```tsx
{ id: 'achievements', label: 'Achievements', Icon: Trophy }
```

Import `Trophy` from `lucide-react`.

- [ ] **Step 3: Update SettingsTab type**

Add `'achievements'` to the union in `store/ui.ts`.

- [ ] **Step 4: Test**

Open settings, navigate to Achievements tab, verify that unlocked achievements are shown (you may need to unlock some first, e.g., send a message to unlock "First Words").

---

## Chunk 8: Language Switcher – Add Language Selector

**Goal:** Allow users to change the UI language. The i18n setup exists but no selector in the app.

**Files:**
- Modify: `src/components/settings/preferences-tab.tsx` (add language dropdown) OR create a new LanguageTab.
- Modify: `src/lib/i18n.ts` (add language change function)
- Modify: `src/store/settings.ts` (language is already there, but we need to wire it)

- [ ] **Step 1: Add language selection to PreferencesTab**

In `preferences-tab.tsx`, add a new section:

```tsx
<Section icon={<Globe size={14} />} title="Language">
  <select
    value={settings.language}
    onChange={(e) => {
      const lang = e.target.value
      setLanguage(lang)
      loadLocale(lang as Locale)
    }}
    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
  >
    {Object.entries(locales).map(([code, label]) => (
      <option key={code} value={code}>{label}</option>
    ))}
  </select>
</Section>
```

- [ ] **Step 2: Import necessary items**

We need to import `useSettingsStore` to get/set language, and `loadLocale`, `locales` from `@/lib/i18n`.

- [ ] **Step 3: Wire language change to i18n**

When the select changes, we need to load the new locale and activate it. Add a `useEffect` in `App.tsx` that listens to language changes and loads the locale. Or do it directly in the select handler.

The `loadLocale` function already exists in `i18n.ts`. We'll call it and then update the store.

- [ ] **Step 4: Update the store's language**

In `settings.ts`, the `setLanguage` method already exists. We'll use it.

- [ ] **Step 5: Ensure the app uses the persisted language on startup**

In `App.tsx`, we already have a `ThemeSync` component. We can create a similar `LanguageSync` component that reads from store and loads the locale.

Add in `App`:

```tsx
function LanguageSync() {
  const language = useSettingsStore((s) => s.language)
  useEffect(() => {
    loadLocale(language as Locale)
  }, [language])
  return null
}
```

- [ ] **Step 6: Test**

Change language in settings, verify the UI text updates (need to have translations for at least one other language – French is partially available). Currently, only English messages exist, so it may not show changes, but the mechanism should work.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-03-21-ux-gap-closure.md`. Ready to execute?**

**Execution path:**
- **If harness has subagents (Claude Code, etc.):** Use superpowers:subagent-driven-development.
- **If harness does NOT have subagents:** Execute plan in current session using superpowers:executing-plans.

After each chunk, dispatch the plan-document-reviewer subagent to review the chunk and address any issues before proceeding to the next.
