# Concierge UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 23 UI/UX features inspired by Codex, Goose, and Opencode into the SkillDeck desktop application, transforming the chat interface into a polished, discovery-rich developer tool.

**Architecture:** Three-phase delivery — Phase 1 (Foundation) touches only the React/Zustand frontend with zero Rust changes. Phase 2 (Enhancement) adds lightweight Tauri IPC bridge commands alongside richer frontend work. Phase 3 (Platform) introduces new database tables, background tasks, and core agent loop modifications. Each phase produces working, shippable software.

**Tech Stack:** React 19, TypeScript 6, Zustand 5, TanStack Router + Query, shadcn/ui (Radix Nova), Tailwind CSS 4, Tauri 2 (Rust/Axum/SeaORM/SQLite), Vitest, Playwright, Biome, Lingui

---

## File Structure Map

### New files to create

| File | Responsibility |
|------|---------------|
| `src/components/settings/settings-section.tsx` | Reusable stacked-card section wrapper for all settings tabs |
| `src/lib/keyboard-shortcuts.ts` | Single source of truth for all registered keyboard shortcuts |
| `src/components/settings/shortcuts-tab.tsx` | Read-only keyboard shortcuts reference display |
| `src/routes/_app/settings.shortcuts.tsx` | TanStack Router route for the shortcuts tab |
| `src/lib/suggested-prompts.ts` | Static library of 30-40 prompt templates grouped by category |
| `src/components/conversation/suggested-prompts.tsx` | Dismissible banner with horizontal prompt chip scroll |
| `src/lib/audio.ts` | Audio manager module for UI sound effects |
| `src/hooks/use-app-version.ts` | Hook wrapping Tauri `getVersion()` API |
| `src/hooks/use-edit-message.ts` | Hook for editing a message in-place and re-running the agent |
| `src/hooks/use-workspace-git.ts` | TanStack Query wrapper for `check_git_status` command |
| `src/hooks/use-scheduler.ts` | TanStack Query hooks for scheduled message CRUD |
| `src/components/conversation/scheduled-messages-panel.tsx` | Panel showing upcoming scheduled messages below the queue |
| `src/components/workspace/file-tree-panel.tsx` | Recursive file tree display for the active workspace |
| `src-tauri/src/commands/scheduler.rs` | Tauri commands for schedule/list/delete + background poller |
| `src-tauri/migration/src/m20260404_add_scheduled_messages.rs` | SeaORM migration for `scheduled_messages` table |
| `public/sounds/send.mp3` | UI sound: message sent (<50KB) |
| `public/sounds/receive.mp3` | UI sound: message received (<50KB) |
| `public/sounds/approve.mp3` | UI sound: tool approved (<50KB) |

### Existing files to modify

| File | Features | What changes |
|------|----------|-------------|
| `src/store/settings.ts` | F01,F02,F04,F06,F08,F12,F21 | Add 9 new state fields + setters (single batch edit) |
| `src/store/ui-ephemeral.ts` | F03,F18 | Add `suggestedPromptsDismissed`, `gitInitDismissed` keyed records |
| `src/components/conversation/message-input.tsx` | F01,F02,F03,F11,F17,F21 | Add 6 action bar buttons + suggested prompts above textarea |
| `src/components/conversation/message-bubble.tsx` | F14,F15,F16 | Add hover action bar, edit dialog, inline textarea transform |
| `src/components/layout/left-panel.tsx` | F04,F08,F19 | Add sort toggle, editor button, workspace switcher dropdown |
| `src/components/layout/right-panel.tsx` | F22,F23 | Add Files tab + Terminal button to header |
| `src/components/settings/appearance-tab.tsx` | F06,F21 | Add font size selector + audio settings section |
| `src/components/settings/preferences-tab.tsx` | F08,F12,F13 | Add editor preference, compaction settings, app version display |
| `src/components/settings/profiles-tab.tsx` | F07 | Add collapsible personality/system prompt editor per profile |
| `src/components/conversation/conversation-item.tsx` | F10 | Add streaming indicator (BouncingDots) |
| `src/components/conversation/message-thread.tsx` | F18 | Add git repo init hint banner |
| `src/components/search/global-search-modal.tsx` | F20 | Add workspace-scoped filter toggle |
| `src/components/layout/app-shell.tsx` | F09 | Refactor useHotkeys to read from keyboard-shortcuts.ts |
| `src/hooks/use-agent-stream.ts` | F12,F21 | Add compaction check on done, play sound on done |
| `src/hooks/use-conversations.ts` | F19 | Add optional `workspaceId` filter parameter |
| `src/hooks/use-messages.ts` | F15 | Add `useEditMessage` hook |
| `src/main.tsx` | F06 | Add useEffect to apply font size CSS class to `<html>` |
| `src/routes/_app/settings.tsx` | F09 | Add "Shortcuts" link to settings sidebar nav |
| `src-tauri/src/commands/workspace.rs` | F18,F22,F23 | Add `check_git_status`, `list_workspace_files`, `open_terminal` |
| `src-tauri/src/commands/messages.rs` | F02,F12 | Add `thinking` param, add `compact_conversation` command |
| `src-tauri/src/commands/mod.rs` | F11 | Register scheduler commands module |
| `src-tauri/src/commands/search.rs` | F20 | Accept optional `workspace_id` filter |
| `src-tauri/skilldeck-core/src/providers/claude.rs` | F02 | Handle thinking budget parameter |

---

## Chunk 1: Phase 1 — Foundation (Pure Frontend, Zero Rust)

Phase 1 delivers 9 features that modify only React/Zustand files. No Rust compilation needed. This establishes the UI patterns (SettingsSection, action bar buttons, ephemeral store dismissal) that later phases reuse.

---

### Task 1: Consolidate Settings Store with All New Fields

> This is a single upfront task that adds every new field the entire plan needs. Doing it once avoids merge conflicts across parallel PRs.

**Files:**
- Modify: `src/store/settings.ts`
- Test: `src/__tests__/store/settings-store.test.ts`

- [ ] **Step 1: Write failing tests for all new settings fields**

```tsx
// src/__tests__/store/settings-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '@/store/settings'

describe('settings store — new concierge-ui fields', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      inputModelId: null,
      thinkingEnabled: false,
      conversationSort: 'updated',
      uiFontSize: 'md',
      preferredEditor: 'system',
      audioEnabled: false,
      audioVolume: 0.5,
      autoCompactionEnabled: false,
      compactionTokenThreshold: 80000,
    })
  })

  it('initializes inputModelId as null', () => {
    expect(useSettingsStore.getState().inputModelId).toBeNull()
  })

  it('setInputModelId updates the model override', () => {
    useSettingsStore.getState().setInputModelId('claude-3-opus')
    expect(useSettingsStore.getState().inputModelId).toBe('claude-3-opus')
  })

  it('initializes thinkingEnabled as false', () => {
    expect(useSettingsStore.getState().thinkingEnabled).toBe(false)
  })

  it('setThinkingEnabled toggles the flag', () => {
    useSettingsStore.getState().setThinkingEnabled(true)
    expect(useSettingsStore.getState().thinkingEnabled).toBe(true)
  })

  it('initializes conversationSort as "updated"', () => {
    expect(useSettingsStore.getState().conversationSort).toBe('updated')
  })

  it('setConversationSort accepts "created"', () => {
    useSettingsStore.getState().setConversationSort('created')
    expect(useSettingsStore.getState().conversationSort).toBe('created')
  })

  it('initializes uiFontSize as "md"', () => {
    expect(useSettingsStore.getState().uiFontSize).toBe('md')
  })

  it('setUiFontSize cycles through sizes', () => {
    useSettingsStore.getState().setUiFontSize('lg')
    expect(useSettingsStore.getState().uiFontSize).toBe('lg')
  })

  it('initializes preferredEditor as "system"', () => {
    expect(useSettingsStore.getState().preferredEditor).toBe('system')
  })

  it('setPreferredEditor accepts known editors', () => {
    useSettingsStore.getState().setPreferredEditor('vscode')
    expect(useSettingsStore.getState().preferredEditor).toBe('vscode')
  })

  it('initializes audioEnabled as false and audioVolume as 0.5', () => {
    const s = useSettingsStore.getState()
    expect(s.audioEnabled).toBe(false)
    expect(s.audioVolume).toBe(0.5)
  })

  it('setAudioEnabled and setAudioVolume update independently', () => {
    useSettingsStore.getState().setAudioEnabled(true)
    useSettingsStore.getState().setAudioVolume(0.8)
    const s = useSettingsStore.getState()
    expect(s.audioEnabled).toBe(true)
    expect(s.audioVolume).toBe(0.8)
  })

  it('initializes autoCompactionEnabled as false with threshold 80000', () => {
    const s = useSettingsStore.getState()
    expect(s.autoCompactionEnabled).toBe(false)
    expect(s.compactionTokenThreshold).toBe(80000)
  })

  it('setAutoCompactionEnabled and setCompactionTokenThreshold update', () => {
    useSettingsStore.getState().setAutoCompactionEnabled(true)
    useSettingsStore.getState().setCompactionTokenThreshold(50000)
    const s = useSettingsStore.getState()
    expect(s.autoCompactionEnabled).toBe(true)
    expect(s.compactionTokenThreshold).toBe(50000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run src/__tests__/store/settings-store.test.ts`
Expected: FAIL — `inputModelId` is not defined on the store

- [ ] **Step 3: Add all new fields and setters to the settings store**

Open `src/store/settings.ts`. Find the state interface (likely called `SettingsState` or similar) and the store creation. Add these fields and actions. Follow the existing pattern for how other fields and setters are defined.

```ts
// Add to the state interface:
inputModelId: string | null
thinkingEnabled: boolean
conversationSort: 'updated' | 'created'
uiFontSize: 'sm' | 'md' | 'lg'
preferredEditor: 'vscode' | 'cursor' | 'system'
audioEnabled: boolean
audioVolume: number
autoCompactionEnabled: boolean
compactionTokenThreshold: number

// Add to the actions/setters (match existing pattern):
setInputModelId: (id: string | null) => void
setThinkingEnabled: (v: boolean) => void
setConversationSort: (sort: 'updated' | 'created') => void
setUiFontSize: (size: 'sm' | 'md' | 'lg') => void
setPreferredEditor: (editor: 'vscode' | 'cursor' | 'system') => void
setAudioEnabled: (v: boolean) => void
setAudioVolume: (v: number) => void
setAutoCompactionEnabled: (v: boolean) => void
setCompactionTokenThreshold: (n: number) => void

// Add default values to initial state:
inputModelId: null,
thinkingEnabled: false,
conversationSort: 'updated',
uiFontSize: 'md',
preferredEditor: 'system',
audioEnabled: false,
audioVolume: 0.5,
autoCompactionEnabled: false,
compactionTokenThreshold: 80000,

// Add setter implementations (match existing pattern):
setInputModelId: (id) => set({ inputModelId: id }),
setThinkingEnabled: (v) => set({ thinkingEnabled: v }),
setConversationSort: (sort) => set({ conversationSort: sort }),
setUiFontSize: (size) => set({ uiFontSize: size }),
setPreferredEditor: (editor) => set({ preferredEditor: editor }),
setAudioEnabled: (v) => set({ audioEnabled: v }),
setAudioVolume: (v) => set({ audioVolume: Math.min(1, Math.max(0, v)) }),
setAutoCompactionEnabled: (v) => set({ autoCompactionEnabled: v }),
setCompactionTokenThreshold: (n) => set({ compactionTokenThreshold: n }),
```

> **Note:** Read the existing file first to match the exact code style. Some stores use a `create()` with separate `get()`/`set()` slices, others use a single object. Match what is already there.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/__tests__/store/settings-store.test.ts`
Expected: All 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/settings.ts src/__tests__/store/settings-store.test.ts
git commit -m "feat(settings): add 9 new state fields for concierge-ui plan"
```

---

### Task 2: Create Shared SettingsSection Component

> Reusable wrapper used by F05, F06, F07, F12, F21. Build it first so every settings tab consumes the same component.

**Files:**
- Create: `src/components/settings/settings-section.tsx`
- Test: `src/__tests__/components/settings-section.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/settings-section.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsSection } from '@/components/settings/settings-section'

describe('SettingsSection', () => {
  it('renders the title', () => {
    render(<SettingsSection title="Font Size">content</SettingsSection>)
    expect(screen.getByText('Font Size')).toBeInTheDocument()
  })

  it('renders the description when provided', () => {
    render(<SettingsSection title="Font Size" description="Adjust text size">content</SettingsSection>)
    expect(screen.getByText('Adjust text size')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<SettingsSection title="Test">Hello world</SettingsSection>)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('applies the stacked-card class structure', () => {
    const { container } = render(<SettingsSection title="Test">content</SettingsSection>)
    const section = container.firstElementChild as HTMLElement
    expect(section.className).toContain('px-5')
    expect(section.className).toContain('py-4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run src/__tests__/components/settings-section.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create the SettingsSection component**

```tsx
// src/components/settings/settings-section.tsx
import type { ReactNode } from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="px-5 py-4">
      <div className="mb-1">
        <h3 className="text-sm font-medium leading-none">{title}</h3>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --run src/__tests__/components/settings-section.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/settings-section.tsx src/__tests__/components/settings-section.test.tsx
git commit -m "feat(settings): add SettingsSection stacked-card wrapper component"
```

---

### Task 3: Apply Stacked-Card Settings UI (F05)

> Wraps each settings tab in the Codex-style single-border-radius card with internal dividers.

**Files:**
- Modify: `src/routes/_app/settings.tsx`
- Modify: `src/components/settings/appearance-tab.tsx`
- Modify: `src/components/settings/preferences-tab.tsx`
- Modify: `src/components/settings/api-keys-tab.tsx`
- Modify: `src/components/settings/approvals-tab.tsx`
- Modify: `src/components/settings/lint-config.tsx`

- [ ] **Step 1: Wrap the settings outlet in a stacked-card container**

Open `src/routes/_app/settings.tsx`. Find where `<Outlet />` is rendered and wrap it:

```tsx
<div className="mx-auto w-full max-w-2xl">
  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
    <Outlet />
  </div>
</div>
```

- [ ] **Step 2: Replace Card wrappers in appearance-tab.tsx with SettingsSection**

Open `src/components/settings/appearance-tab.tsx`. Find each `<Card>` or `<div className="rounded-lg border...">` wrapping a settings group. Replace with `<SettingsSection title="..." description="...">`. Keep the inner controls unchanged.

Example transformation:

```tsx
// Before:
<Card>
  <CardHeader>
    <CardTitle>Theme</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>

// After:
<SettingsSection title="Theme" description="Choose your preferred color scheme">
  ...
</SettingsSection>
```

- [ ] **Step 3: Apply same transformation to preferences-tab.tsx**

Same pattern as Step 2. Each logical grouping becomes a `<SettingsSection>`.

- [ ] **Step 4: Apply same transformation to api-keys-tab.tsx, approvals-tab.tsx, lint-config.tsx**

Same pattern. Import `SettingsSection` from `@/components/settings/settings-section` at the top of each file.

- [ ] **Step 5: Visual check — run the app and open each settings tab**

Run: `pnpm tauri:dev`
Navigate to Settings > each tab. Verify:
- Single rounded border with internal horizontal dividers (no individual card borders)
- Sections have consistent padding (px-5 py-4)
- Existing functionality (theme toggle, API key entry, etc.) still works

- [ ] **Step 6: Run Biome check**

Run: `pnpm lint`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add src/routes/_app/settings.tsx src/components/settings/
git commit -m "feat(ui): apply stacked-card settings layout with SettingsSection"
```

---

### Task 4: Font Size Selector in Appearance Settings (F06)

**Files:**
- Modify: `src/components/settings/appearance-tab.tsx`
- Modify: `src/main.tsx`
- Test: `src/__tests__/store/font-size.test.ts`

- [ ] **Step 1: Write failing test for font size CSS application**

```ts
// src/__tests__/store/font-size.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '@/store/settings'

describe('font size integration', () => {
  beforeEach(() => {
    useSettingsStore.setState({ uiFontSize: 'md' })
    document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg')
  })

  it('maps "sm" to text-sm class', () => {
    useSettingsStore.setState({ uiFontSize: 'sm' })
    // The mapping is verified by the component, this tests the store contract
    expect(useSettingsStore.getState().uiFontSize).toBe('sm')
  })

  it('maps "md" to text-base class', () => {
    expect(useSettingsStore.getState().uiFontSize).toBe('md')
  })

  it('maps "lg" to text-lg class', () => {
    useSettingsStore.setState({ uiFontSize: 'lg' })
    expect(useSettingsStore.getState().uiFontSize).toBe('lg')
  })
})
```

- [ ] **Step 2: Run test to verify it passes (store fields already added in Task 1)**

Run: `pnpm test -- --run src/__tests__/store/font-size.test.ts`
Expected: PASS

- [ ] **Step 3: Add font size CSS class application to main.tsx**

Open `src/main.tsx`. Add a `useEffect` that subscribes to the settings store and applies the Tailwind class:

```tsx
import { useSettingsStore } from '@/store/settings'

// Inside the App component or a top-level effect:
useEffect(() => {
  const sizeMap = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' } as const
  const apply = () => {
    const size = useSettingsStore.getState().uiFontSize
    document.documentElement.classList.remove('text-sm', 'text-base', 'text-lg')
    document.documentElement.classList.add(sizeMap[size])
  }
  apply()
  const unsub = useSettingsStore.subscribe(apply)
  return unsub
}, [])
```

- [ ] **Step 4: Add three-way button group to appearance-tab.tsx**

Inside the appearance tab, add a new section after the theme section:

```tsx
import { SettingsSection } from '@/components/settings/settings-section'
import { useSettingsStore } from '@/store/settings'

// Inside the component, add:
<SettingsSection title="Font Size" description="Adjust the base text size across the app">
  <div className="flex gap-1">
    {(['sm', 'md', 'lg'] as const).map((size) => (
      <button
        key={size}
        onClick={() => useSettingsStore.getState().setUiFontSize(size)}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          useSettingsStore((s) => s.uiFontSize) === size
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
        )}
      >
        {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
      </button>
    ))}
  </div>
  <p className="mt-2 text-xs text-muted-foreground">
    Preview: This is how your text will look at the selected size.
  </p>
</SettingsSection>
```

- [ ] **Step 5: Visual check — toggle between sizes**

Run: `pnpm tauri:dev`
Open Settings > Appearance. Click Small / Medium / Large. Verify the entire app text changes size.

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx src/components/settings/appearance-tab.tsx src/__tests__/store/font-size.test.ts
git commit -m "feat(appearance): add font size selector with live CSS class switching"
```

---

### Task 5: Sort Conversations Toggle (F04)

**Files:**
- Modify: `src/components/layout/left-panel.tsx`
- Test: `src/__tests__/store/sort-conversations.test.ts`

- [ ] **Step 1: Write failing test for sort preference**

```ts
// src/__tests__/store/sort-conversations.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '@/store/settings'

describe('conversation sort', () => {
  beforeEach(() => {
    useSettingsStore.setState({ conversationSort: 'updated' })
  })

  it('defaults to "updated"', () => {
    expect(useSettingsStore.getState().conversationSort).toBe('updated')
  })

  it('switches to "created"', () => {
    useSettingsStore.getState().setConversationSort('created')
    expect(useSettingsStore.getState().conversationSort).toBe('created')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test -- --run src/__tests__/store/sort-conversations.test.ts`
Expected: PASS (fields added in Task 1)

- [ ] **Step 3: Add sort toggle button to left-panel.tsx**

Open `src/components/layout/left-panel.tsx`. Find the header area where the search bar lives. Add a small toggle button group or `Select` dropdown next to it:

```tsx
import { useSettingsStore } from '@/store/settings'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Inside the header, after the search bar:
<div className="flex items-center gap-1">
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7"
    onClick={() => {
      const current = useSettingsStore.getState().conversationSort
      useSettingsStore.getState().setConversationSort(
        current === 'updated' ? 'created' : 'updated',
      )
    }}
  >
    <ArrowUpDown className="h-3.5 w-3.5" />
  </Button>
  <span className="text-[10px] text-muted-foreground uppercase">
    {useSettingsStore((s) => s.conversationSort)}
  </span>
</div>
```

- [ ] **Step 4: Update conversation list sorting to use the setting**

In the same file (or in `use-conversations.ts` if sorting is done there), find where conversations are sorted by `updated_at`. Replace with:

```ts
const sortKey = useSettingsStore((s) => s.conversationSort)
const sorted = [...conversations].sort((a, b) => {
  const dateA = new Date(a[sortKey === 'updated' ? 'updated_at' : 'created_at']).getTime()
  const dateB = new Date(b[sortKey === 'updated' ? 'updated_at' : 'created_at']).getTime()
  return dateB - dateA
})
```

> **Note:** The exact field names (`updated_at`, `created_at`) and sorting location depend on the existing code. Read the file first and adapt.

- [ ] **Step 5: Visual check**

Run: `pnpm tauri:dev`
Open the left panel. Click the sort toggle. Verify conversations reorder between "most recently updated" and "most recently created". Date group headers (Today, This week…) should update accordingly.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/left-panel.tsx src/__tests__/store/sort-conversations.test.ts
git commit -m "feat(conversations): add sort toggle between updated and created order"
```

---

### Task 6: Quick Model Switch in Input (F01)

**Files:**
- Modify: `src/components/conversation/message-input.tsx`

- [ ] **Step 1: Read the existing message-input.tsx to understand the action bar pattern**

Run: Read `src/components/conversation/message-input.tsx` fully. Identify:
- Where the send button lives
- How the action bar is structured
- How `useProfiles` is used (or if it is)
- How `sendMessage` is called (what params it takes)

- [ ] **Step 2: Add model picker button to the action bar**

Insert a `DropdownMenu` button left of the send button:

```tsx
import { Cpu, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useSettingsStore } from '@/store/settings'
import { useProfiles } from '@/hooks/use-profiles'

// Inside the component, in the action bar (before the send button):
const profiles = useProfiles()
const inputModelId = useSettingsStore((s) => s.inputModelId)

// Derive distinct model options from profiles
const modelOptions = useMemo(() => {
  const seen = new Set<string>()
  return profiles.filter((p) => {
    const key = `${p.provider}:${p.model_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map((p) => ({ id: p.model_id, provider: p.provider, label: p.model_id }))
}, [profiles])

const activeModelLabel = inputModelId ?? profiles.find((p) => p.is_active)?.model_id ?? 'Default'

// JSX:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <Cpu className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-64">
    {modelOptions.map((m) => (
      <DropdownMenuItem
        key={m.id}
        onClick={() => useSettingsStore.getState().setInputModelId(m.id)}
        className={cn(m.id === inputModelId && 'bg-accent')}
      >
        <span className="truncate">{m.id}</span>
        <span className="ml-auto text-xs text-muted-foreground">{m.provider}</span>
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

- [ ] **Step 3: Pass inputModelId to sendMessage**

Find where `sendMessage` / `sendMutation` is called. Add the model override:

```ts
// When sending:
const modelToSend = useSettingsStore.getState().inputModelId
  ?? profiles.find((p) => p.is_active)?.model_id
```

Pass `modelToSend` as the model parameter in the send payload.

- [ ] **Step 4: Reset inputModelId after sending (optional UX)**

After a successful send, consider clearing the override:

```ts
useSettingsStore.getState().setInputModelId(null)
```

- [ ] **Step 5: Visual check**

Run: `pnpm tauri:dev`
Open a conversation. Click the Cpu icon. Verify the dropdown lists available models. Select one. Verify it sends with that model. Verify it resets after send.

- [ ] **Step 6: Commit**

```bash
git add src/components/conversation/message-input.tsx
git commit -m "feat(input): add quick model switch picker in message action bar"
```

---

### Task 7: Auto-Approve Toggle in Chat Input (F17)

**Files:**
- Modify: `src/components/conversation/message-input.tsx`

- [ ] **Step 1: Read the tool-approvals store to understand its shape**

Run: Read `src/store/tool-approvals.ts`. Identify the state fields and setter names.

- [ ] **Step 2: Add Shield button with dropdown to the action bar**

```tsx
import { Shield, ShieldCheck } from 'lucide-react'
import { useToolApprovalsStore } from '@/store/tool-approvals'

// Inside the component:
const approvals = useToolApprovalsStore()
const hasAnyApproval = approvals.reads || approvals.writes || approvals.shell || approvals.http

// JSX in the action bar:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', hasAnyApproval && 'text-green-500')}
    >
      {hasAnyApproval ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-48">
    {(['reads', 'writes', 'shell', 'http'] as const).map((cat) => (
      <DropdownMenuItem
        key={cat}
        onClick={() => {
          useToolApprovalsStore.getState()[`set${cat.charAt(0).toUpperCase() + cat.slice(1)}`](!approvals[cat])
        }}
      >
        <span className={approvals[cat] ? 'text-green-500' : ''}>{cat}</span>
        <span className="ml-auto">{approvals[cat] ? 'ON' : 'OFF'}</span>
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

> **Note:** The exact setter name pattern (`setReads`, `setWrites`, etc.) depends on what exists in the store. Read the file and match the actual names.

- [ ] **Step 3: Visual check**

Run: `pnpm tauri:dev`
Open Settings > Approvals and note current state. Open a conversation. Click the Shield button. Toggle some categories. Return to Settings > Approvals and verify they persisted.

- [ ] **Step 4: Commit**

```bash
git add src/components/conversation/message-input.tsx
git commit -m "feat(input): add auto-approve quick-toggle dropdown in message bar"
```

---

### Task 8: Keyboard Shortcuts Single Source of Truth + Reference Tab (F09)

**Files:**
- Create: `src/lib/keyboard-shortcuts.ts`
- Create: `src/components/settings/shortcuts-tab.tsx`
- Create: `src/routes/_app/settings.shortcuts.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/routes/_app/settings.tsx`

- [ ] **Step 1: Read app-shell.tsx to catalog all registered shortcuts**

Run: Read `src/components/layout/app-shell.tsx`. Find every `useHotkeys(...)` call. Extract the key combo, description, and callback purpose. List them all.

- [ ] **Step 2: Create the keyboard-shortcuts.ts single source of truth**

```ts
// src/lib/keyboard-shortcuts.ts
import type { KeyboardShortcut } from '@/lib/types'

export interface KeyboardShortcut {
  keys: string
  description: string
  category: 'navigation' | 'conversation' | 'editing' | 'app'
}

export const keyboardShortcuts: KeyboardShortcut[] = [
  // Populate with the actual shortcuts found in app-shell.tsx. Example:
  { keys: 'Cmd+K', description: 'Open command palette', category: 'navigation' },
  { keys: 'Cmd+N', description: 'New conversation', category: 'navigation' },
  { keys: 'Cmd+/', description: 'Toggle left panel', category: 'app' },
  { keys: 'Cmd+Shift+S', description: 'Toggle right panel', category: 'app' },
  // ... add ALL shortcuts found in Step 1
]
```

> **Critical:** This array must be exhaustive. Every shortcut registered via `useHotkeys` in app-shell.tsx must have a corresponding entry here.

- [ ] **Step 3: Refactor app-shell.tsx to import from keyboard-shortcuts.ts**

Replace inline key strings with references to `keyboardShortcuts`. Example:

```tsx
// Before:
useHotkeys('cmd+k', () => setOpen(true))

// After:
import { keyboardShortcuts } from '@/lib/keyboard-shortcuts'
const paletteShortcut = keyboardShortcuts.find(s => s.description === 'Open command palette')
useHotkeys(paletteShortcut!.keys, () => setOpen(true))
```

This ensures the registration code stays in sync with the reference list.

- [ ] **Step 4: Create the shortcuts-tab.tsx component**

```tsx
// src/components/settings/shortcuts-tab.tsx
import { keyboardShortcuts } from '@/lib/keyboard-shortcuts'
import { Kbd } from '@/components/ui/kbd'

const categoryLabels: Record<string, string> = {
  navigation: 'Navigation',
  conversation: 'Conversation',
  editing: 'Editing',
  app: 'Application',
}

export function ShortcutsTab() {
  const grouped = keyboardShortcuts.reduce<Record<string, typeof keyboardShortcuts>>((acc, s) => {
    ;(acc[s.category] ??= []).push(s)
    return acc
  }, {})

  return (
    <div className="divide-y divide-border">
      {Object.entries(grouped).map(([cat, shortcuts]) => (
        <section key={cat} className="px-5 py-4">
          <h3 className="mb-3 text-sm font-medium">{categoryLabels[cat] ?? cat}</h3>
          <div className="space-y-2">
            {shortcuts.map((s) => (
              <div key={s.keys} className="flex items-center justify-between">
                <span className="text-sm">{s.description}</span>
                <div className="flex gap-1">
                  {s.keys.split('+').map((k) => (
                    <Kbd key={k}>{k.replace('Cmd', '\u2318').replace('Shift', '\u21E7').replace('Alt', '\u2325')}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create the route file**

```tsx
// src/routes/_app/settings.shortcuts.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ShortcutsTab } from '@/components/settings/shortcuts-tab'

export const Route = createFileRoute('/_app/settings/shortcuts')({
  component: ShortcutsTab,
})
```

- [ ] **Step 6: Add "Shortcuts" link to settings sidebar**

Open `src/routes/_app/settings.tsx`. Find the sidebar navigation links list. Add:

```tsx
<Link to="/settings/shortcuts" ...>Shortcuts</Link>
```

Match the existing link pattern exactly (className, active state, icon).

- [ ] **Step 7: Regenerate route tree (if TanStack Router requires it)**

Run: `pnpm tauri:dev` or check if route tree auto-generates. If not:

```bash
# Some TanStack Router setups need manual generation
pnpm exec @tanstack/router-cli generate
```

- [ ] **Step 8: Visual check**

Run: `pnpm tauri:dev`
Open Settings. Verify "Shortcuts" appears in the sidebar. Click it. Verify all shortcuts are listed with correct key combos. Verify existing shortcuts still work.

- [ ] **Step 9: Commit**

```bash
git add src/lib/keyboard-shortcuts.ts src/components/settings/shortcuts-tab.tsx src/routes/_app/settings.shortcuts.tsx src/components/layout/app-shell.tsx src/routes/_app/settings.tsx
git commit -m "feat(settings): add keyboard shortcuts reference tab with single source of truth"
```

---

### Task 9: Streaming Indicator on Conversation List Item (F10)

**Files:**
- Modify: `src/components/conversation/conversation-item.tsx`

- [ ] **Step 1: Read conversation-item.tsx to find the timestamp rendering**

Run: Read `src/components/conversation/conversation-item.tsx`. Find where the timestamp is displayed and where the component structure allows inserting a conditional indicator.

- [ ] **Step 2: Add streaming indicator**

```tsx
import { BouncingDots } from '@/components/ui/bouncing-dots'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'

// Inside the component:
const agentRunning = useUIEphemeralStore((s) => s.agentRunning)
const isStreaming = agentRunning[conversation.id] ?? false

// In the JSX, replace or conditionally render the timestamp:
{isStreaming ? (
  <BouncingDots className="h-3 w-3 text-primary" />
) : (
  // existing timestamp JSX here
  <span className="text-xs text-muted-foreground">{formattedTime}</span>
)}
```

> **Note:** `BouncingDots` already exists at `src/components/ui/bouncing-dots.tsx`. Check its props to see if it accepts className. If not, wrap it in a span with the className.

- [ ] **Step 3: Visual check**

Run: `pnpm tauri:dev`
Open a conversation and send a message. While the agent is streaming, verify the conversation item in the left panel shows the bouncing dots indicator instead of the timestamp. When streaming completes, verify the timestamp returns.

- [ ] **Step 4: Commit**

```bash
git add src/components/conversation/conversation-item.tsx
git commit -m "feat(conversations): show streaming indicator on active conversation item"
```

---

### Task 10: App Version in Settings (F13)

**Files:**
- Create: `src/hooks/use-app-version.ts`
- Modify: `src/components/settings/preferences-tab.tsx`

- [ ] **Step 1: Create the useAppVersion hook**

```ts
// src/hooks/use-app-version.ts
import { useState, useEffect } from 'react'
import { getVersion } from '@tauri-apps/api/app'

export function useAppVersion() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {
      // Fallback for web preview / dev mode without Tauri
      setVersion('0.1.0-dev')
    })
  }, [])

  return version
}
```

- [ ] **Step 2: Add version display to preferences tab**

Open `src/components/settings/preferences-tab.tsx`. At the bottom of the tab, add:

```tsx
import { useAppVersion } from '@/hooks/use-app-version'

// Inside the component, at the bottom:
const version = useAppVersion()

// JSX at the end:
<p className="pt-6 text-center text-xs text-muted-foreground">
  SkillDeck v{version}
</p>
```

- [ ] **Step 3: Visual check**

Run: `pnpm tauri:dev`
Open Settings > Preferences. Scroll to the bottom. Verify "SkillDeck v0.1.0" (or whatever version is in `tauri.conf.json`) is displayed.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-app-version.ts src/components/settings/preferences-tab.tsx
git commit -m "feat(settings): display app version in preferences tab"
```

---

### Task 11: Open in Editor from Left Panel (F08)

**Files:**
- Modify: `src/components/layout/left-panel.tsx`
- Modify: `src/components/settings/preferences-tab.tsx`

- [ ] **Step 1: Read skill-detail-panel.tsx to find how revealItemInDir is used**

Run: Read `src/components/skills/skill-detail-panel.tsx`. Search for `revealItemInDir` or `openUrl` to see the exact import path and usage pattern.

- [ ] **Step 2: Add "Open in Editor" button to left panel header**

```tsx
import { Code2 } from 'lucide-react'
import { openUrl } from '@tauri-apps/api/shell'
import { useWorkspaceStore } from '@/store/workspace'
import { useSettingsStore } from '@/store/settings'

// Inside the component:
const activeWorkspace = useWorkspaceStore((s) => s.workspaces.find(w => w.id === s.activeWorkspaceId))
const preferredEditor = useSettingsStore((s) => s.preferredEditor)

const handleOpenInEditor = async () => {
  if (!activeWorkspace) return
  const path = activeWorkspace.path
  const editorSchemes: Record<string, string> = {
    vscode: `vscode://file/${path}`,
    cursor: `cursor://file/${path}`,
  }
  const url = editorSchemes[preferredEditor]
  if (url) {
    await openUrl(url)
  } else {
    // Fallback: use revealItemInDir or shell open
    await openUrl(`file://${path}`)
  }
}

// JSX in the header area:
<Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleOpenInEditor}>
  <Code2 className="h-3.5 w-3.5" />
</Button>
```

- [ ] **Step 3: Add editor preference to preferences tab**

In `src/components/settings/preferences-tab.tsx`:

```tsx
import { SettingsSection } from '@/components/settings/settings-section'
import { useSettingsStore } from '@/store/settings'

<SettingsSection title="Preferred Editor" description="Choose which editor to open workspace folders in">
  <Select
    value={useSettingsStore((s) => s.preferredEditor)}
    onValueChange={(v) => useSettingsStore.getState().setPreferredEditor(v as 'vscode' | 'cursor' | 'system')}
  >
    <SelectTrigger className="w-48">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="vscode">VS Code</SelectItem>
      <SelectItem value="cursor">Cursor</SelectItem>
      <SelectItem value="system">System Default</SelectItem>
    </SelectContent>
  </Select>
</SettingsSection>
```

- [ ] **Step 4: Visual check**

Run: `pnpm tauri:dev`
Open a workspace. Click the Code2 icon in the left panel. Verify VS Code/Cursor opens (or system file browser for "system" option). Change the editor in preferences and verify the new editor opens.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/left-panel.tsx src/components/settings/preferences-tab.tsx
git commit -m "feat(workspace): add open in editor button and preferred editor setting"
```

---

### Task 12: Audio Effects in Settings (F21)

**Files:**
- Create: `src/lib/audio.ts`
- Modify: `src/components/settings/appearance-tab.tsx`
- Modify: `src/hooks/use-agent-stream.ts`
- Modify: `src/components/conversation/message-input.tsx`

- [ ] **Step 1: Create audio files in public/sounds/**

Create or obtain 3 short sound files (< 50KB each):
- `public/sounds/send.mp3` — subtle click/tap
- `public/sounds/receive.mp3` — soft notification
- `public/sounds/approve.mp3` — confirmation tone

These can be synthesized with any free tool or placeholder files for now.

- [ ] **Step 2: Create the audio manager module**

```ts
// src/lib/audio.ts
import { useSettingsStore } from '@/store/settings'

const sounds = {
  messageSent: new Audio('/sounds/send.mp3'),
  messageReceived: new Audio('/sounds/receive.mp3'),
  toolApproved: new Audio('/sounds/approve.mp3'),
} as const

export type SoundName = keyof typeof sounds

export function playSound(name: SoundName) {
  const { audioEnabled, audioVolume } = useSettingsStore.getState()
  if (!audioEnabled) return

  const sound = sounds[name]
  sound.volume = audioVolume
  sound.currentTime = 0
  sound.play().catch(() => {
    // Silently fail — browsers block autoplay before user interaction
  })
}

export function setSoundVolume(volume: number) {
  for (const sound of Object.values(sounds)) {
    sound.volume = volume
  }
}
```

- [ ] **Step 3: Add audio settings to appearance tab**

```tsx
// In src/components/settings/appearance-tab.tsx, add a new section:
import { useSettingsStore } from '@/store/settings'
import { Switch } from '@/components/ui/switch'

<SettingsSection title="Sound Effects" description="Play sounds for chat actions">
  <div className="flex items-center justify-between">
    <label htmlFor="audio-toggle" className="text-sm">Enable sounds</label>
    <Switch
      id="audio-toggle"
      checked={useSettingsStore((s) => s.audioEnabled)}
      onCheckedChange={(v) => useSettingsStore.getState().setAudioEnabled(v)}
    />
  </div>
  {useSettingsStore((s) => s.audioEnabled) && (
    <div className="mt-3">
      <label className="text-sm text-muted-foreground">Volume</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={useSettingsStore((s) => s.audioVolume)}
        onChange={(e) => useSettingsStore.getState().setAudioVolume(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </div>
  )}
</SettingsSection>
```

- [ ] **Step 4: Hook playSound into agent stream done event**

Open `src/hooks/use-agent-stream.ts`. Find the `'done'` case handler:

```ts
import { playSound } from '@/lib/audio'

// In the 'done' case:
playSound('messageReceived')
```

- [ ] **Step 5: Hook playSound into message send**

Open `src/components/conversation/message-input.tsx`. Find where the send mutation succeeds:

```ts
import { playSound } from '@/lib/audio'

// After successful send:
playSound('messageSent')
```

- [ ] **Step 6: Visual + audio check**

Run: `pnpm tauri:dev`
Open Settings > Appearance. Enable sounds. Adjust volume slider. Send a message — hear the send sound. When the response completes — hear the receive sound. Disable sounds — verify silence.

- [ ] **Step 7: Commit**

```bash
git add src/lib/audio.ts src/components/settings/appearance-tab.tsx src/hooks/use-agent-stream.ts src/components/conversation/message-input.tsx public/sounds/
git commit -m "feat(audio): add sound effects system with settings toggle and volume control"
```

---

### Task 13: Extend UI Ephemeral Store for Phase 2 Needs (F03, F18)

> Doing this now avoids touching the same file twice.

**Files:**
- Modify: `src/store/ui-ephemeral.ts`

- [ ] **Step 1: Read the current ui-ephemeral.ts to understand the pattern**

Run: Read `src/store/ui-ephemeral.ts`. Note how `agentRunning` is structured as `Record<string, boolean>`.

- [ ] **Step 2: Add new keyed-dismissal fields**

Following the same pattern as `agentRunning`:

```ts
// Add to state:
suggestedPromptsDismissed: {} as Record<string, boolean>,
gitInitDismissed: {} as Record<string, boolean>,
editingMessageId: null as string | null,

// Add to actions:
setSuggestedPromptsDismissed: (id: string, dismissed: boolean) =>
  set((s) => ({ suggestedPromptsDismissed: { ...s.suggestedPromptsDismissed, [id]: dismissed } })),
setGitInitDismissed: (path: string, dismissed: boolean) =>
  set((s) => ({ gitInitDismissed: { ...s.gitInitDismissed, [path]: dismissed } })),
setEditingMessageId: (id: string | null) =>
  set({ editingMessageId: id }),
```

- [ ] **Step 3: Commit**

```bash
git add src/store/ui-ephemeral.ts
git commit -m "feat(store): add ephemeral state fields for prompts dismissal, git hint, and message editing"
```

---

## Chunk 2: Phase 2 — Enhancement (Frontend + Bridge)

Phase 2 adds features requiring new Tauri IPC commands alongside richer frontend interactions. Each feature here touches both the Rust and TypeScript layers.

---

### Task 14: Suggested Prompts Library (F03)

**Files:**
- Create: `src/lib/suggested-prompts.ts`
- Create: `src/components/conversation/suggested-prompts.tsx`
- Modify: `src/components/conversation/message-input.tsx`

- [ ] **Step 1: Create the prompts data file**

```ts
// src/lib/suggested-prompts.ts
export interface SuggestedPrompt {
  id: string
  label: string
  prompt: string
  category: 'coding' | 'writing' | 'analysis' | 'debugging' | 'planning' | 'brainstorming'
}

export const suggestedPrompts: SuggestedPrompt[] = [
  // Coding
  { id: 'c1', label: 'Review my code', prompt: 'Review the following code for bugs, performance issues, and style improvements:', category: 'coding' },
  { id: 'c2', label: 'Write unit tests', prompt: 'Write comprehensive unit tests for the following function/module:', category: 'coding' },
  { id: 'c3', label: 'Refactor this', prompt: 'Refactor the following code to be cleaner, more maintainable, and follow best practices:', category: 'coding' },
  { id: 'c4', label: 'Add error handling', prompt: 'Add proper error handling and validation to the following code:', category: 'coding' },
  { id: 'c5', label: 'Explain this code', prompt: 'Explain what this code does step by step, as if I am a junior developer:', category: 'coding' },
  { id: 'c6', label: 'Write a function', prompt: 'Write a function that', category: 'coding' },
  // Writing
  { id: 'w1', label: 'Write documentation', prompt: 'Write clear, concise documentation for the following code/module:', category: 'writing' },
  { id: 'w2', label: 'Draft a README', prompt: 'Draft a comprehensive README for this project including installation, usage, and contribution guidelines:', category: 'writing' },
  { id: 'w3', label: 'Write a commit message', prompt: 'Write a conventional commit message for the following changes:', category: 'writing' },
  { id: 'w4', label: 'Summarize this', prompt: 'Summarize the following in 2-3 clear sentences:', category: 'writing' },
  // Analysis
  { id: 'a1', label: 'Compare approaches', prompt: 'Compare the following two approaches, discussing trade-offs in performance, maintainability, and complexity:', category: 'analysis' },
  { id: 'a2', label: 'Identify risks', prompt: 'Identify potential risks and edge cases in the following:', category: 'analysis' },
  { id: 'a3', label: 'Architecture review', prompt: 'Review the architecture of this project and suggest improvements:', category: 'analysis' },
  // Debugging
  { id: 'd1', label: 'Fix this error', prompt: 'I am getting the following error. Help me understand why and how to fix it:', category: 'debugging' },
  { id: 'd2', label: 'Debug this test', prompt: 'The following test is failing. Help me debug why:', category: 'debugging' },
  { id: 'd3', label: 'Performance issue', prompt: 'The following code is running slowly. Help me identify the bottleneck and suggest optimizations:', category: 'debugging' },
  // Planning
  { id: 'p1', label: 'Plan a feature', prompt: 'Help me plan the implementation of a new feature:', category: 'planning' },
  { id: 'p2', label: 'Break down a task', prompt: 'Break down the following task into smaller, actionable steps:', category: 'planning' },
  { id: 'p3', label: 'Create a migration plan', prompt: 'Create a migration plan for upgrading from the current version to the target version:', category: 'planning' },
  // Brainstorming
  { id: 'b1', label: 'Brainstorm ideas', prompt: 'Brainstorm ideas for:', category: 'brainstorming' },
  { id: 'b2', label: 'Name this', prompt: 'Suggest names for:', category: 'brainstorming' },
]
```

- [ ] **Step 2: Create the suggested-prompts component**

```tsx
// src/components/conversation/suggested-prompts.tsx
import { useState, useMemo } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { suggestedPrompts } from '@/lib/suggested-prompts'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { cn } from '@/lib/utils'

const categoryLabels: Record<string, string> = {
  coding: 'Coding',
  writing: 'Writing',
  analysis: 'Analysis',
  debugging: 'Debugging',
  planning: 'Planning',
  brainstorming: 'Brainstorming',
}

interface SuggestedPromptsProps {
  conversationId: string | null
  hasMessages: boolean
  onSelect: (prompt: string) => void
}

export function SuggestedPrompts({ conversationId, hasMessages, onSelect }: SuggestedPromptsProps) {
  const [exploreOpen, setExploreOpen] = useState(false)
  const dismissed = useUIEphemeralStore((s) => s.suggestedPromptsDismissed)

  if (!conversationId || hasMessages || dismissed[conversationId]) return null

  const handleDismiss = () => {
    useUIEphemeralStore.getState().setSuggestedPromptsDismissed(conversationId, true)
  }

  const quickPrompts = suggestedPrompts.slice(0, 6)

  return (
    <div className="relative rounded-lg border bg-muted/30 px-3 py-2">
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        <span>Try a prompt</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quickPrompts.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.prompt)}
            className="rounded-full border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setExploreOpen(true)}
          className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Explore more...
        </button>
      </div>
      <Dialog open={exploreOpen} onOpenChange={setExploreOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested Prompts</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-4">
            {Object.entries(categoryLabels).map(([cat, label]) => (
              <div key={cat}>
                <h4 className="mb-2 text-sm font-medium">{label}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedPrompts.filter(p => p.category === cat).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { onSelect(p.prompt); setExploreOpen(false) }}
                      className="rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Wire into message-input.tsx**

Open `src/components/conversation/message-input.tsx`. Above the textarea, conditionally render:

```tsx
import { SuggestedPrompts } from '@/components/conversation/suggested-prompts'
import { useMessages } from '@/hooks/use-messages'

// Inside the component:
const conversationId = useConversationId()
const messages = useMessages(conversationId)

// JSX, above the textarea container:
<SuggestedPrompts
  conversationId={conversationId}
  hasMessages={messages.length > 0}
  onSelect={(prompt) => {
    // Set the textarea value. How depends on the existing draft state pattern.
    // Check if there's a `setDraft` or `textareaRef.current.value = prompt` pattern.
    setTextareaValue(prompt)
    textareaRef.current?.focus()
  }}
/>
```

> **Note:** Read the existing message-input.tsx to understand how draft text is managed. Match that pattern.

- [ ] **Step 4: Visual check**

Run: `pnpm tauri:dev`
Open a new empty conversation. Verify the "Try a prompt" banner appears with 6 chips. Click a chip — verify it fills the textarea. Click "Explore more" — verify the dialog opens with all categories. Click the X — verify it dismisses and stays dismissed for that conversation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/suggested-prompts.ts src/components/conversation/suggested-prompts.tsx src/components/conversation/message-input.tsx
git commit -m "feat(prompts): add suggested prompts library with dismissible banner and explore dialog"
```

---

### Task 15: Personality / Profile System Prompt Editor (F07)

**Files:**
- Modify: `src/components/settings/profiles-tab.tsx`

- [ ] **Step 1: Read profiles-tab.tsx to understand the existing profile management UI**

Run: Read `src/components/settings/profiles-tab.tsx`. Understand:
- How profiles are listed
- How profile editing works currently
- What `useUpdateProfile` / `useProfiles` APIs are available

- [ ] **Step 2: Add collapsible personality section per profile**

For each profile card in the list, add a collapsible section below it:

```tsx
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

// Inside the profile card mapping, after the existing fields:
const [expandedProfile, setExpandedProfile] = useState<string | null>(null)
const [editDraft, setEditDraft] = useState('')

// JSX per profile:
{expandedProfile === profile.id && (
  <div className="mt-3 border-t pt-3">
    <label className="text-sm font-medium">Personality / System Prompt</label>
    <Textarea
      className="mt-1.5 min-h-[100px]"
      placeholder="You are a helpful assistant with a concise, direct style..."
      value={editDraft}
      onChange={(e) => setEditDraft(e.target.value)}
      maxLength={4000}
    />
    <div className="mt-1 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        {editDraft.length} / 4000
      </span>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpandedProfile(null)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            updateProfile({ id: profile.id, system_prompt: editDraft })
            setExpandedProfile(null)
          }}
        >
          Save
        </Button>
      </div>
    </div>
  </div>
)}

// Add a button to expand:
<Button
  variant="ghost"
  size="sm"
  className="mt-2 text-xs"
  onClick={() => {
    setEditDraft(profile.system_prompt ?? '')
    setExpandedProfile(profile.id)
  }}
>
  Edit Personality
</Button>
```

- [ ] **Step 3: Visual check**

Run: `pnpm tauri:dev`
Open Settings > Profiles. Click "Edit Personality" on a profile. Verify the textarea expands. Type a system prompt. Click Save. Open a conversation using that profile and verify the system prompt is applied.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/profiles-tab.tsx
git commit -m "feat(profiles): add inline personality/system prompt editor per profile"
```

---

### Task 16: Hover Copy/Edit Actions on Messages (F14)

**Files:**
- Modify: `src/components/conversation/message-bubble.tsx`

- [ ] **Step 1: Read message-bubble.tsx to understand the current structure**

Run: Read `src/components/conversation/message-bubble.tsx`. Identify:
- The outer wrapper element
- Where the timestamp is rendered
- Whether there's already a hover pattern

- [ ] **Step 2: Add hover action bar**

```tsx
import { Copy, Pencil, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Add 'group' class to the outer wrapper:
<div className="group relative ...">

// Add the hover action bar inside, positioned absolute top-right:
<div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6"
    onClick={() => navigator.clipboard.writeText(message.content)}
  >
    <Copy className="h-3 w-3" />
  </Button>
  {message.role === 'user' && (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => setEditDialogOpen(true)}
    >
      <Pencil className="h-3 w-3" />
    </Button>
  )}
  {retryAvailable && (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={onRetry}
    >
      <RotateCcw className="h-3 w-3" />
    </Button>
  )}
</div>

// Move the timestamp inside the hover area or make it group-hover visible:
<span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity">
  {formattedTimestamp}
</span>
```

> **Note:** Adapt the exact class names and positioning to match the existing message-bubble layout. Read the file first and integrate with the existing structure.

- [ ] **Step 3: Visual check**

Run: `pnpm tauri:dev`
Hover over any message. Verify the Copy, Edit (user only), and Retry buttons appear. Click Copy — verify clipboard contains the message text. Click Edit — verify the edit dialog opens (implemented in Task 17).

- [ ] **Step 4: Commit**

```bash
git add src/components/conversation/message-bubble.tsx
git commit -m "feat(messages): add hover action bar with copy, edit, and retry buttons"
```

---

### Task 17: Edit Message — Branch Choice (F15)

**Files:**
- Modify: `src/components/conversation/message-bubble.tsx`
- Modify: `src/hooks/use-messages.ts`

- [ ] **Step 1: Read the existing branch creation flow**

Run: Read `src/hooks/use-branches.ts` and `src/components/conversation/create-branch-modal.tsx`. Understand how branches are created from a message index.

- [ ] **Step 2: Add useEditMessage hook**

```ts
// In src/hooks/use-messages.ts, add:
import { invoke } from '@tauri-apps/api/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useEditMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ messageId, newContent }: { messageId: string; newContent: string }) => {
      return invoke('edit_message', { messageId, newContent })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    },
  })
}
```

> **Note:** The Tauri command `edit_message` may already exist. Check `src-tauri/src/commands/messages.rs` first. If not, it needs to be added — but that's a Rust change which we handle in Phase 2 bridge.

- [ ] **Step 3: Add edit choice AlertDialog to message-bubble**

In `src/components/conversation/message-bubble.tsx`, when the Edit button (from Task 16) is clicked:

```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useCreateBranch } from '@/hooks/use-branches'
import { useState } from 'react'

// State:
const [editDialogOpen, setEditDialogOpen] = useState(false)
const [editMode, setEditMode] = useState<'inline' | 'branch' | null>(null)
const [isEditing, setIsEditing] = useState(false)
const [editContent, setEditContent] = useState('')
const createBranch = useCreateBranch()
const editMessage = useEditMessage()

// Handler for edit button click:
const handleEditClick = () => {
  setEditDialogOpen(true)
}

// When user picks "Edit in place":
setEditDialogOpen(false)
setEditMode('inline')
setIsEditing(true)
setEditContent(message.content)

// When user picks "Edit on new branch":
setEditDialogOpen(false)
createBranch.mutate({ conversationId, branchPointMessageIndex: messageIndex })

// JSX for the dialog:
<AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Edit Message</AlertDialogTitle>
      <AlertDialogDescription>
        Edit in place to replace this message, or edit on a new branch to preserve the original conversation.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => { setEditMode('branch'); setEditDialogOpen(false) }}>
        New Branch
      </AlertDialogAction>
      <AlertDialogAction onClick={() => { setEditMode('inline'); setEditDialogOpen(false) }}>
        Edit in Place
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/conversation/message-bubble.tsx src/hooks/use-messages.ts
git commit -m "feat(messages): add edit message dialog with in-place or branch choice"
```

---

### Task 18: Edit Message — Transforms into Input (F16)

**Files:**
- Modify: `src/components/conversation/message-bubble.tsx`

- [ ] **Step 1: Read QueueEditForm.tsx to understand the inline edit pattern**

Run: Read `src/components/conversation/queue/queue-edit-form.tsx`. Note the textarea + save/cancel button pattern.

- [ ] **Step 2: Add inline textarea edit mode to message-bubble**

Inside `message-bubble.tsx`, after the dialog from Task 17, add the inline edit UI:

```tsx
// Inside the message content area, conditionally:
{isEditing ? (
  <div className="space-y-2">
    <Textarea
      ref={editTextareaRef}
      value={editContent}
      onChange={(e) => setEditContent(e.target.value)}
      className="min-h-[80px]"
      autoFocus
    />
    <div className="flex gap-2">
      <Button size="sm" onClick={handleSaveAndResend}>
        Save & Resend
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
        Cancel
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Press Escape to cancel, Ctrl+Enter to save
    </p>
  </div>
) : (
  // existing message content rendering
)}

// Keyboard handlers:
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape') setIsEditing(false)
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveAndResend()
}

const handleSaveAndResend = () => {
  editMessage.mutate(
    { messageId: message.id, newContent: editContent },
    {
      onSuccess: () => {
        setIsEditing(false)
        // Trigger agent re-run from this point
        // This depends on the existing agent re-run mechanism
      },
    },
  )
}
```

- [ ] **Step 3: Visual check**

Run: `pnpm tauri:dev`
Hover over a user message. Click Edit. Choose "Edit in place". Verify the message transforms into a textarea. Edit the text. Press Ctrl+Enter — verify it saves and the agent re-runs. Press Escape — verify it cancels.

- [ ] **Step 4: Commit**

```bash
git add src/components/conversation/message-bubble.tsx
git commit -m "feat(messages): add inline edit mode that transforms message bubble into textarea"
```

---

### Task 19: Git Repo Init Hint (F18)

**Files:**
- Modify: `src-tauri/src/commands/workspace.rs`
- Create: `src/hooks/use-workspace-git.ts`
- Modify: `src/components/conversation/message-thread.tsx`

- [ ] **Step 1: Add check_git_status Tauri command**

Open `src-tauri/src/commands/workspace.rs`. Add a new command:

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct GitStatus {
    pub is_git_repo: bool,
    pub has_uncommitted: bool,
}

#[tauri::command]
pub async fn check_git_status(workspace_path: String) -> Result<GitStatus, String> {
    let is_git_repo = std::process::Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(&workspace_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let has_uncommitted = if is_git_repo {
        std::process::Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&workspace_path)
            .output()
            .map(|o| !o.stdout.is_empty())
            .unwrap_or(false)
    } else {
        false
    };

    Ok(GitStatus { is_git_repo, has_uncommitted })
}
```

Register the command in `src-tauri/src/lib.rs` (or wherever commands are registered).

- [ ] **Step 2: Compile and verify the Rust changes**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Clean build with no errors

- [ ] **Step 3: Create the useWorkspaceGitStatus hook**

```ts
// src/hooks/use-workspace-git.ts
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

interface GitStatus {
  is_git_repo: boolean
  has_uncommitted: boolean
}

export function useWorkspaceGitStatus(workspacePath: string | undefined) {
  return useQuery({
    queryKey: ['git-status', workspacePath],
    queryFn: () => invoke<GitStatus>('check_git_status', { workspacePath }),
    enabled: !!workspacePath,
    staleTime: 60_000, // Check once per minute
  })
}
```

- [ ] **Step 4: Add git init hint banner to message-thread or center panel**

Open `src/components/conversation/message-thread.tsx` (or wherever workspace context banners go). Add:

```tsx
import { useWorkspaceGitStatus } from '@/hooks/use-workspace-git'
import { useWorkspaceStore } from '@/store/workspace'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { Button } from '@/components/ui/button'

// Inside the component:
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
const activeWorkspace = useWorkspaceStore((s) =>
  s.workspaces.find(w => w.id === activeWorkspaceId)
)
const { data: gitStatus } = useWorkspaceGitStatus(activeWorkspace?.path)
const gitDismissed = useUIEphemeralStore((s) => s.gitInitDismissed)

const showGitHint = activeWorkspace?.path
  && gitStatus
  && !gitStatus.is_git_repo
  && !gitDismissed[activeWorkspace.path]

// JSX (near the top of the conversation area):
{showGitHint && (
  <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
    <span className="text-sm">
      This folder is not a git repository. Initialize one?
    </span>
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          useUIEphemeralStore.getState().setGitInitDismissed(activeWorkspace!.path, true)
        }}
      >
        Dismiss
      </Button>
      <Button size="sm" onClick={() => handleGitInit(activeWorkspace!.path)}>
        Initialize
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Visual check**

Run: `pnpm tauri:dev`
Open a workspace that is NOT a git repo. Verify the yellow banner appears. Click "Initialize" — verify `git init` runs. Click "Dismiss" — verify it hides and stays hidden for that workspace. Open a workspace that IS a git repo — verify no banner.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/workspace.rs src/hooks/use-workspace-git.ts src/components/conversation/message-thread.tsx
git commit -m "feat(workspace): add git repo init hint banner with dismissible state"
```

---

### Task 20: Workspace Switcher in Left Bar (F19)

**Files:**
- Modify: `src/components/layout/left-panel.tsx`
- Modify: `src/hooks/use-conversations.ts`
- Modify: `src/store/workspace.ts` (verify only)

- [ ] **Step 1: Read the current left-panel workspace handling**

Run: Read `src/components/layout/left-panel.tsx`. Find how workspace info is currently displayed. Run: Read `src/store/workspace.ts`. Verify `activeWorkspaceId` is persisted.

- [ ] **Step 2: Add workspace switcher dropdown at the top of left panel**

```tsx
import { ChevronDown, FolderOpen } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useWorkspaceStore } from '@/store/workspace'
import { Button } from '@/components/ui/button'

// Inside the component:
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
const workspaces = useWorkspaceStore((s) => s.workspaces)
const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)
const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId)

// JSX at the very top of the left panel, before conversation list:
<div className="px-3 pb-2">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="w-full justify-between px-2">
        <div className="flex items-center gap-2 truncate">
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">
            {activeWorkspace?.name ?? 'No workspace'}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-64">
      {workspaces.map((ws) => (
        <DropdownMenuItem
          key={ws.id}
          onClick={() => setActiveWorkspaceId(ws.id)}
          className={cn(ws.id === activeWorkspaceId && 'bg-accent')}
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          <span className="truncate">{ws.name}</span>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleOpenFolder}>
        Open folder...
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

- [ ] **Step 3: Scope conversations to active workspace**

Open `src/hooks/use-conversations.ts`. If it accepts a `workspaceId` parameter, pass `activeWorkspaceId`. If not, add it:

```ts
// Modify the hook to accept and forward workspaceId:
export function useConversations(workspaceId?: string) {
  return useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: () => invoke('list_conversations', { workspaceId: workspaceId ?? null }),
    // ...
  })
}
```

- [ ] **Step 4: Visual check**

Run: `pnpm tauri:dev`
Verify workspace switcher appears at top of left panel. Click it — verify all open workspaces are listed. Select a different workspace — verify conversation list updates to show only that workspace's conversations. Click "Open folder..." — verify folder picker opens.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/left-panel.tsx src/hooks/use-conversations.ts
git commit -m "feat(workspace): add workspace switcher dropdown to left panel with conversation scoping"
```

---

### Task 21: Global Search Scoped to Workspace (F20)

**Files:**
- Modify: `src/components/search/global-search-modal.tsx`
- Modify: `src-tauri/src/commands/search.rs`

- [ ] **Step 1: Read the current search modal**

Run: Read `src/components/search/global-search-modal.tsx`. Understand:
- What parameters the search command accepts
- How results are rendered
- Where the filter UI is

- [ ] **Step 2: Add workspace filter to the search command**

Open `src-tauri/src/commands/search.rs`. Add an optional `workspace_id` parameter to the search function:

```rust
#[tauri::command]
pub async fn search_messages(
    query: String,
    workspace_id: Option<String>,
    // ... existing params
) -> Result<Vec<SearchResult>, String> {
    // If workspace_id is Some, add a WHERE clause filtering by conversation's workspace_id
    // This depends on the existing query structure — read and adapt
}
```

- [ ] **Step 3: Add workspace toggle to the search modal UI**

```tsx
// In src/components/search/global-search-modal.tsx:
import { useWorkspaceStore } from '@/store/workspace'
import { Badge } from '@/components/ui/badge'

// Inside the component:
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
const [scopedToWorkspace, setScopedToWorkspace] = useState(true)

// When searching, pass:
const searchParams = {
  query,
  workspace_id: scopedToWorkspace ? activeWorkspaceId : null,
}

// In the UI, add a toggle:
{activeWorkspaceId && (
  <button
    onClick={() => setScopedToWorkspace(!scopedToWorkspace)}
    className="flex items-center gap-1.5"
  >
    <Badge variant={scopedToWorkspace ? 'default' : 'outline'}>
      {scopedToWorkspace ? 'Workspace' : 'All'}
    </Badge>
  </button>
)}
```

- [ ] **Step 4: Visual check**

Run: `pnpm tauri:dev`
Open search (Cmd+K). With a workspace active, verify the "Workspace" badge appears. Click it to toggle between workspace-scoped and global search. Verify results match the scope.

- [ ] **Step 5: Commit**

```bash
git add src/components/search/global-search-modal.tsx src-tauri/src/commands/search.rs
git commit -m "feat(search): add workspace-scoped search filter toggle"
```

---

### Task 22: File Tree on Right Panel (F22)

**Files:**
- Modify: `src-tauri/src/commands/workspace.rs`
- Create: `src/components/workspace/file-tree-panel.tsx`
- Modify: `src/components/layout/right-panel.tsx`

- [ ] **Step 1: Add list_workspace_files Tauri command**

Open `src-tauri/src/commands/workspace.rs`. Add:

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileEntry>,
}

#[tauri::command]
pub async fn list_workspace_files(
    workspace_path: String,
    max_depth: u8,
) -> Result<Vec<FileEntry>, String> {
    let mut root_entries: Vec<FileEntry> = Vec::new();
    list_files_recursive(&workspace_path, max_depth, &mut root_entries)
        .map_err(|e| e.to_string())?;
    Ok(root_entries)
}

use std::fs;
use std::path::Path;

fn list_files_recursive(
    dir: &str,
    max_depth: u8,
    entries: &mut Vec<FileEntry>,
) -> std::io::Result<()> {
    if max_depth == 0 { return Ok(()) }

    let entries_iter = fs::read_dir(dir)?;
    let mut dirs: Vec<FileEntry> = Vec::new();
    let mut files: Vec<FileEntry> = Vec::new();

    for entry in entries_iter {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and common ignore directories
        if name.starts_with('.') { continue; }
        if ["node_modules", "target", "dist", ".git", "__pycache__"].contains(&name.as_str()) {
            continue;
        }

        let is_dir = path.is_dir();

        let mut children = Vec::new();
        if is_dir && max_depth > 1 {
            list_files_recursive(&path.to_string_lossy(), max_depth - 1, &mut children)?;
        }

        let file_entry = FileEntry {
            name: name.clone(),
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
        };

        if is_dir { dirs.push(file_entry) } else { files.push(file_entry) }
    }

    dirs.sort_by(|a, b| a.name.cmp(&b.name));
    files.sort_by(|a, b| a.name.cmp(&b.name));
    entries.extend(dirs);
    entries.extend(files);
    Ok(())
}
```

- [ ] **Step 2: Compile Rust changes**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Clean build

- [ ] **Step 3: Create the file-tree-panel component**

```tsx
// src/components/workspace/file-tree-panel.tsx
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '@/store/workspace'
import { useSettingsStore } from '@/store/settings'
import { openUrl } from '@tauri-apps/api/shell'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import { useState, useCallback } from 'react'

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  children: FileEntry[]
}

function FileTreeItem({ entry, depth = 0 }: { entry: FileEntry; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)

  const handleClick = async () => {
    if (entry.is_dir) {
      setExpanded(!expanded)
    } else {
      const preferredEditor = useSettingsStore.getState().preferredEditor
      const schemes: Record<string, string> = {
        vscode: 'vscode://file/',
        cursor: 'cursor://file/',
      }
      const url = schemes[preferredEditor]
        ? `${schemes[preferredEditor]}${entry.path}`
        : `file://${entry.path}`
      await openUrl(url).catch(() => {})
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-accent"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {entry.is_dir ? (
          expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
        ) : (
          <span className="w-3" />
        )}
        {entry.is_dir ? (
          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {entry.is_dir && expanded && entry.children.map((child) => (
        <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function FileTreePanel() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find(w => w.id === activeWorkspaceId)
  )

  const { data: files, isLoading } = useQuery({
    queryKey: ['workspace-files', activeWorkspace?.path],
    queryFn: () => invoke<FileEntry[]>('list_workspace_files', {
      workspacePath: activeWorkspace!.path,
      maxDepth: 4,
    }),
    enabled: !!activeWorkspace?.path,
  })

  if (!activeWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        No workspace open
      </div>
    )
  }

  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Loading...</div>

  return (
    <div className="h-full overflow-auto p-2">
      {files?.map((entry) => (
        <FileTreeItem key={entry.path} entry={entry} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Add Files tab to right panel**

Open `src/components/layout/right-panel.tsx`. Find the tab bar. Add a new tab:

```tsx
import { FolderTree } from 'lucide-react'
import { FileTreePanel } from '@/components/workspace/file-tree-panel'

// Add to the tab definitions (match existing pattern):
{ value: 'files', label: 'Files', icon: FolderTree }

// In the tab content rendering:
{activeTab === 'files' && <FileTreePanel />}
```

- [ ] **Step 5: Visual check**

Run: `pnpm tauri:dev`
Open a workspace. Open the right panel. Click the "Files" tab. Verify the file tree renders with folders and files. Click a folder to expand/collapse. Click a file — verify it opens in the preferred editor.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/workspace.rs src/components/workspace/file-tree-panel.tsx src/components/layout/right-panel.tsx
git commit -m "feat(workspace): add file tree panel tab to right panel"
```

---

### Task 23: Open Workspace Terminal (F23)

**Files:**
- Modify: `src-tauri/src/commands/workspace.rs`
- Modify: `src/components/layout/right-panel.tsx`

- [ ] **Step 1: Add open_terminal Tauri command**

Open `src-tauri/src/commands/workspace.rs`. Add:

```rust
#[tauri::command]
pub async fn open_terminal(path: String) -> Result<(), String> {
    let os = std::env::consts::OS;

    let (cmd, args) = match os {
        "macos" => ("open".to_string(), vec!["-a".to_string(), "Terminal".to_string(), path.clone()]),
        "windows" => {
            // Try Windows Terminal first, fall back to cmd
            ("wt".to_string(), vec!["-d".to_string(), path.clone()])
        }
        _ => {
            // Linux: use x-terminal-emulator or $TERM
            let term = std::env::var("TERM").unwrap_or_else(|_| "x-terminal-emulator".to_string());
            (term, vec![path.clone()])
        }
    };

    std::process::Command::new(&cmd)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;

    Ok(())
}
```

Register the command in `src-tauri/src/lib.rs`.

- [ ] **Step 2: Compile Rust changes**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Clean build

- [ ] **Step 3: Add Terminal button to right panel header**

Open `src/components/layout/right-panel.tsx`. Find the header area. Add:

```tsx
import { Terminal } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '@/store/workspace'

// Inside the component:
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
const activeWorkspace = useWorkspaceStore((s) => s.workspaces.find(w => w.id === activeWorkspaceId))

// JSX in the header row:
<Button
  variant="ghost"
  size="icon"
  className="h-7 w-7"
  onClick={() => {
    if (activeWorkspace) {
      invoke('open_terminal', { path: activeWorkspace.path })
    }
  }}
  disabled={!activeWorkspace}
>
  <Terminal className="h-3.5 w-3.5" />
</Button>
```

- [ ] **Step 4: Visual check**

Run: `pnpm tauri:dev`
Open a workspace. Click the Terminal icon in the right panel header. Verify a terminal window opens at the workspace path. Test on macOS, Windows, and Linux.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/workspace.rs src/components/layout/right-panel.tsx
git commit -m "feat(workspace): add open terminal button to right panel header"
```

---

## Chunk 3: Phase 3 — Platform (Backend-Heavy Features)

Phase 3 introduces the most complex features: new database tables, background tasks, and agent loop modifications. These require careful design and thorough testing.

---

### Task 24: Thinking Mode Toggle (F02)

**Files:**
- Modify: `src/components/conversation/message-input.tsx`
- Modify: `src-tauri/src/commands/messages.rs`
- Modify: `src-tauri/skilldeck-core/src/providers/claude.rs`

- [ ] **Step 1: Add BrainCircuit button to message input action bar**

```tsx
import { BrainCircuit } from 'lucide-react'

// Inside the component:
const thinkingEnabled = useSettingsStore((s) => s.thinkingEnabled)

// JSX in the action bar:
<Button
  variant="ghost"
  size="icon"
  className={cn('h-8 w-8', thinkingEnabled && 'text-primary')}
  onClick={() => useSettingsStore.getState().setThinkingEnabled(!thinkingEnabled)}
>
  <BrainCircuit className="h-4 w-4" />
</Button>
```

- [ ] **Step 2: Pass thinking parameter to sendMessage**

In the send payload:

```ts
const thinking = useSettingsStore.getState().thinkingEnabled
// Include in the invoke call:
invoke('send_message', { conversationId, content, thinking, ... })
```

- [ ] **Step 3: Accept thinking param in Rust messages command**

Open `src-tauri/src/commands/messages.rs`. In the `send_message` payload struct:

```rust
#[derive(Deserialize)]
pub struct SendMessagePayload {
    // ... existing fields
    pub thinking: Option<bool>,
}
```

Forward `thinking` to the agent run options.

- [ ] **Step 4: Handle thinking in Claude provider**

Open `src-tauri/skilldeck-core/src/providers/claude.rs`. When constructing the API request, if thinking is enabled:

```rust
if run_options.thinking.unwrap_or(false) {
    // Add extended thinking budget parameter
    // This depends on the Anthropic API version being used
    // Adjust to match the actual Claude API integration pattern
}
```

> **Note:** The exact implementation depends on how the Claude provider is structured. Read the file and adapt. The Anthropic "extended thinking" feature requires specific API parameters — check the Anthropic docs for the current API version.

- [ ] **Step 5: Compile and test**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Run: `pnpm tauri:dev`
Open a conversation. Toggle thinking mode. Send a message. Verify the Claude request includes the thinking parameter.

- [ ] **Step 6: Commit**

```bash
git add src/components/conversation/message-input.tsx src-tauri/src/commands/messages.rs src-tauri/skilldeck-core/src/providers/claude.rs
git commit -m "feat(input): add thinking mode toggle with Claude extended thinking support"
```

---

### Task 25: Scheduler — Database Migration (F11-DB)

**Files:**
- Create: `src-tauri/migration/src/m20260404_add_scheduled_messages.rs`
- Modify: `src-tauri/migration/src/lib.rs`

- [ ] **Step 1: Read existing migration files to understand the pattern**

Run: Read `src-tauri/migration/src/lib.rs` and `src-tauri/migration/src/m20260319_000004_add_message_fts.rs`. Note:
- How migrations are registered
- The SeaORM entity pattern
- The naming convention

- [ ] **Step 2: Create the scheduled_messages migration**

```rust
// src-tauri/migration/src/m20260404_add_scheduled_messages.rs
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ScheduledMessages::Table)
                    .if_not_exists()
                    .col(uuid(ScheduledMessages::Id).primary_key())
                    .col(uuid(ScheduledMessages::ConversationId).not_null())
                    .col(text(ScheduledMessages::Content).not_null())
                    .col(text_null(ScheduledMessages::CronExpression))
                    .col(date_time(ScheduledMessages::ScheduledAt).not_null())
                    .col(string_len(ScheduledMessages::Recurrence, 20).default("none"))
                    .col(string_len(ScheduledMessages::Status, 20).default("pending"))
                    .col(date_time(ScheduledMessages::CreatedAt).default(Expr::current_timestamp()))
                    .col(date_time(ScheduledMessages::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .from(ScheduledMessages::Table, ScheduledMessages::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ScheduledMessages::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum ScheduledMessages {
    Table,
    Id,
    ConversationId,
    Content,
    CronExpression,
    ScheduledAt,
    Recurrence,
    Status,
    CreatedAt,
    UpdatedAt,
}

// Reference existing table for FK:
#[derive(DeriveIden)]
enum Conversations {
    Table,
    Id,
}
```

> **Note:** The exact table name for conversations may differ. Check the existing migration files and adapt.

- [ ] **Step 3: Register the migration**

Open `src-tauri/migration/src/lib.rs`. Add the new migration to the array:

```rust
m.add_migrations([
    // ... existing migrations
    Box::new(m20260404_add_scheduled_messages::Migration),
])
```

- [ ] **Step 4: Run migration**

Run: `cargo run --manifest-path src-tauri/migration/Cargo.toml`
Expected: Migration runs successfully, `scheduled_messages` table created

- [ ] **Step 5: Commit**

```bash
git add src-tauri/migration/src/
git commit -m "feat(scheduler): add scheduled_messages table migration"
```

---

### Task 26: Scheduler — Tauri Commands (F11-Backend)

**Files:**
- Create: `src-tauri/src/commands/scheduler.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create the SeaORM entity for scheduled_messages**

```rust
// Add to src-tauri/skilldeck-models/src/scheduled_messages.rs (or create if not existing)
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "scheduled_messages")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub content: String,
    pub cron_expression: Option<String>,
    pub scheduled_at: DateTimeWithTimeZone,
    pub recurrence: String,
    pub status: String,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

// ... derive Entity, Column, PrimaryKey, Relation as per existing model pattern
```

- [ ] **Step 2: Create the scheduler commands module**

```rust
// src-tauri/src/commands/scheduler.rs
use sea_orm::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{Utc, TimeZone};

#[derive(Serialize, Deserialize)]
pub struct ScheduleMessagePayload {
    pub conversation_id: Uuid,
    pub content: String,
    pub scheduled_at: String, // ISO 8601 datetime
    pub recurrence: Option<String>, // "none", "daily", "weekly"
}

#[derive(Serialize)]
pub struct ScheduledMessage {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub content: String,
    pub scheduled_at: String,
    pub recurrence: String,
    pub status: String,
}

#[tauri::command]
pub async fn schedule_message(
    db: tauri::State<'_, DatabaseConnection>,
    payload: ScheduleMessagePayload,
) -> Result<ScheduledMessage, String> {
    let id = Uuid::new_v4();
    let scheduled_at = chrono::DateTime::parse_from_rfc3339(&payload.scheduled_at)
        .map_err(|e| format!("Invalid datetime: {}", e))?
        .with_timezone(&Utc);

    // Insert into database
    let model = scheduled_messages::ActiveModel {
        id: Set(id),
        conversation_id: Set(payload.conversation_id),
        content: Set(payload.content),
        scheduled_at: Set(scheduled_at),
        recurrence: Set(payload.recurrence.unwrap_or_else(|| "none".to_string())),
        status: Set("pending".to_string()),
        created_at: Set(Utc::now()),
        updated_at: Set(Utc::now()),
    };

    scheduled_messages::Entity::insert(model)
        .exec(&*db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ScheduledMessage {
        id,
        conversation_id: payload.conversation_id,
        content: payload.content,
        scheduled_at: payload.scheduled_at,
        recurrence: payload.recurrence.unwrap_or_else(|| "none".to_string()),
        status: "pending".to_string(),
    })
}

#[tauri::command]
pub async fn list_scheduled_messages(
    db: tauri::State<'_, DatabaseConnection>,
    conversation_id: Uuid,
) -> Result<Vec<ScheduledMessage>, String> {
    let messages = scheduled_messages::Entity::find()
        .filter(scheduled_messages::Column::ConversationId.eq(conversation_id))
        .filter(scheduled_messages::Column::Status.eq("pending"))
        .order_by_asc(scheduled_messages::Column::ScheduledAt)
        .all(&*db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(messages.into_iter().map(|m| ScheduledMessage {
        id: m.id,
        conversation_id: m.conversation_id,
        content: m.content,
        scheduled_at: m.scheduled_at.to_rfc3339(),
        recurrence: m.recurrence,
        status: m.status,
    }).collect())
}

#[tauri::command]
pub async fn delete_scheduled_message(
    db: tauri::State<'_, DatabaseConnection>,
    id: Uuid,
) -> Result<(), String> {
    scheduled_messages::Entity::delete_by_id(id)
        .exec(&*db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 3: Register scheduler commands in mod.rs**

Open `src-tauri/src/commands/mod.rs`. Add:

```rust
pub mod scheduler;
```

Open `src-tauri/src/lib.rs` (or wherever `invoke_handler` is defined). Add:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::scheduler::schedule_message,
    commands::scheduler::list_scheduled_messages,
    commands::scheduler::delete_scheduled_message,
])
```

- [ ] **Step 4: Add background poller (optional, can be deferred)**

In `src-tauri/src/lib.rs` or a new `src-tauri/src/scheduler_poller.rs`, add a tokio background task that:

```rust
async fn scheduler_poller(db: DatabaseConnection, app_handle: tauri::AppHandle) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
    loop {
        interval.tick().await;

        let now = Utc::now();
        let due_messages = scheduled_messages::Entity::find()
            .filter(scheduled_messages::Column::Status.eq("pending"))
            .filter(scheduled_messages::Column::ScheduledAt.lte(now))
            .all(&db)
            .await;

        for msg in due_messages.unwrap_or_default() {
            // Mark as firing
            let update = scheduled_messages::ActiveModel {
                id: Set(msg.id),
                status: Set("fired".to_string()),
                updated_at: Set(Utc::now()),
                ..Default::default()
            };
            scheduled_messages::Entity::update(update).exec(&db).await.ok();

            // Trigger message send via app event
            app_handle.emit("scheduler-fire", msg).ok();
        }
    }
}
```

Spawn this in the Tauri setup:

```rust
tauri::async_runtime::spawn(scheduler_poller(db.clone(), app_handle.clone()));
```

- [ ] **Step 5: Compile**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/scheduler.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(scheduler): add schedule, list, delete commands with background poller"
```

---

### Task 27: Scheduler — Frontend Hooks and UI (F11-Frontend)

**Files:**
- Create: `src/hooks/use-scheduler.ts`
- Create: `src/components/conversation/scheduled-messages-panel.tsx`
- Modify: `src/components/conversation/message-input.tsx`

- [ ] **Step 1: Create TanStack Query hooks**

```ts
// src/hooks/use-scheduler.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

interface ScheduledMessage {
  id: string
  conversation_id: string
  content: string
  scheduled_at: string
  recurrence: string
  status: string
}

interface ScheduleMessagePayload {
  conversation_id: string
  content: string
  scheduled_at: string
  recurrence?: string
}

export function useScheduledMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['scheduled-messages', conversationId],
    queryFn: () => invoke<ScheduledMessage[]>('list_scheduled_messages', { conversationId }),
    enabled: !!conversationId,
    refetchInterval: 30_000, // Refresh every 30s
  })
}

export function useScheduleMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ScheduleMessagePayload) =>
      invoke<ScheduledMessage>('schedule_message', { payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] })
    },
  })
}

export function useDeleteScheduledMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invoke('delete_scheduled_message', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] })
    },
  })
}
```

- [ ] **Step 2: Create the scheduled messages panel**

```tsx
// src/components/conversation/scheduled-messages-panel.tsx
import { Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useScheduledMessages, useDeleteScheduledMessage } from '@/hooks/use-scheduler'
import { format } from 'date-fns'

interface ScheduledMessagesPanelProps {
  conversationId: string
}

export function ScheduledMessagesPanel({ conversationId }: ScheduledMessagesPanelProps) {
  const { data: messages } = useScheduledMessages(conversationId)
  const deleteMessage = useDeleteScheduledMessage()

  if (!messages || messages.length === 0) return null

  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Scheduled ({messages.length})</span>
      </div>
      <div className="space-y-1.5">
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start justify-between gap-2 rounded bg-muted/50 px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-xs">{msg.content}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(msg.scheduled_at), 'MMM d, h:mm a')}
                {msg.recurrence !== 'none' && ` (${msg.recurrence})`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => deleteMessage.mutate(msg.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add Clock button to message input**

```tsx
import { Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState } from 'react'
import { useScheduleMessage } from '@/hooks/use-scheduler'
import { useScheduledMessages } from '@/hooks/use-scheduler'

// Inside the component:
const [scheduleOpen, setScheduleOpen] = useState(false)
const [scheduleDate, setScheduleDate] = useState('')
const [scheduleRecurrence, setScheduleRecurrence] = useState('none')
const scheduleMessage = useScheduleMessage()

// JSX in the action bar:
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8"
  onClick={() => setScheduleOpen(true)}
>
  <Clock className="h-4 w-4" />
</Button>

// Schedule dialog:
<Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Schedule Message</DialogTitle>
    </DialogHeader>
    <div className="space-y-3">
      <div>
        <label className="text-sm">Date & Time</label>
        <input
          type="datetime-local"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="text-sm">Recurrence</label>
        <select
          value={scheduleRecurrence}
          onChange={(e) => setScheduleRecurrence(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
        >
          <option value="none">One-time</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
      <Button
        onClick={() => {
          const payload = {
            conversation_id: conversationId,
            content: textareaValue,
            scheduled_at: new Date(scheduleDate).toISOString(),
            recurrence: scheduleRecurrence !== 'none' ? scheduleRecurrence : undefined,
          }
          scheduleMessage.mutate(payload)
          setScheduleOpen(false)
        }}
        disabled={!scheduleDate || !textareaValue}
      >
        Schedule
      </Button>
    </div>
  </DialogContent>
</Dialog>

// Also render the panel below the queue (or wherever the queue list is):
<ScheduledMessagesPanel conversationId={conversationId} />
```

- [ ] **Step 4: Visual check**

Run: `pnpm tauri:dev`
Open a conversation. Type a message. Click the Clock icon. Select a future date/time. Click "Schedule". Verify the scheduled message appears in the panel below. Verify it disappears after the scheduled time fires.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-scheduler.ts src/components/conversation/scheduled-messages-panel.tsx src/components/conversation/message-input.tsx
git commit -m "feat(scheduler): add scheduled message UI with datetime picker and recurrence"
```

---

### Task 28: Auto Compaction — Backend Command (F12-Backend)

**Files:**
- Modify: `src-tauri/src/commands/messages.rs`

- [ ] **Step 1: Add compact_conversation Tauri command**

Open `src-tauri/src/commands/messages.rs`. Add:

```rust
#[tauri::command]
pub async fn compact_conversation(
    db: tauri::State<'_, DatabaseConnection>,
    conversation_id: Uuid,
    agent_handle: tauri::State<'_, AgentHandle>,
) -> Result<String, String> {
    // 1. Fetch all messages for the conversation, ordered by created_at
    let messages = messages::Entity::find()
        .filter(messages::Column::ConversationId.eq(conversation_id))
        .order_by_asc(messages::Column::CreatedAt)
        .all(&*db)
        .await
        .map_err(|e| e.to_string())?;

    if messages.len() < 10 {
        return Err("Conversation too short to compact".to_string())
    }

    // 2. Build a summary prompt from older messages (first 70%)
    let split_point = (messages.len() as f64 * 0.7) as usize;
    let old_messages = &messages[..split_point];

    let summary_content: String = old_messages
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let summary_prompt = format!(
        "Summarize the following conversation concisely, preserving key decisions, code changes, and important context:\n\n{}",
        summary_content
    );

    // 3. Use the agent to generate a summary
    let summary = agent_handle
        .run_simple(&summary_prompt)
        .await
        .map_err(|e| e.to_string())?;

    // 4. Delete old messages and insert summary as a system message
    for old_msg in old_messages {
        messages::Entity::delete_by_id(old_msg.id)
            .exec(&*db)
            .await
            .ok();
    }

    // 5. Insert summary as first message
    let summary_model = messages::ActiveModel {
        id: Set(Uuid::new_v4()),
        conversation_id: Set(conversation_id),
        role: Set("system".to_string()),
        content: Set(format!("[Compacted summary]\n{}", summary)),
        created_at: Set(Utc::now()),
        ..Default::default()
    };
    messages::Entity::insert(summary_model)
        .exec(&*db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(summary)
}
```

> **Note:** This is a simplified version. The actual implementation needs to:
> - Match the existing agent invocation pattern (read how the agent is called in `src-tauri/skilldeck-core/src/agent/loop.rs`)
> - Handle edge cases (empty conversations, agent errors)
> - Optionally archive old messages instead of deleting them

- [ ] **Step 2: Register the command**

Add `commands::messages::compact_conversation` to the `invoke_handler` in `src-tauri/src/lib.rs`.

- [ ] **Step 3: Compile**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/messages.rs src-tauri/src/lib.rs
git commit -m "feat(compaction): add compact_conversation Tauri command with agent summarization"
```

---

### Task 29: Auto Compaction — Frontend Integration (F12-Frontend)

**Files:**
- Modify: `src/hooks/use-agent-stream.ts`
- Modify: `src/components/settings/preferences-tab.tsx`

- [ ] **Step 1: Add compaction check to agent stream done handler**

Open `src/hooks/use-agent-stream.ts`. In the `'done'` event handler:

```ts
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '@/store/settings'
import { toast } from 'sonner' // or however toasts are done

// After existing invalidation logic:
const { autoCompactionEnabled, compactionTokenThreshold } = useSettingsStore.getState()
if (autoCompactionEnabled && messages.length > 0) {
  // Rough token estimation: ~4 chars per token for English text
  const estimatedTokens = messages.reduce((sum, m) => sum + m.content.length / 4, 0)
  if (estimatedTokens > compactionTokenThreshold) {
    invoke('compact_conversation', { conversationId })
      .then(() => {
        toast.info('Conversation auto-compacted to save context space')
        queryClient.invalidateQueries({ queryKey: ['messages'] })
      })
      .catch(() => {
        // Silently fail — compaction is a nice-to-have
      })
  }
}
```

- [ ] **Step 2: Add compaction settings to preferences tab**

```tsx
// In src/components/settings/preferences-tab.tsx:
import { SettingsSection } from '@/components/settings/settings-section'
import { useSettingsStore } from '@/store/settings'
import { Switch } from '@/components/ui/switch'

<SettingsSection title="Context Management" description="Automatically compress long conversations to save context window space">
  <div className="flex items-center justify-between">
    <label htmlFor="compaction-toggle" className="text-sm">Auto-compaction</label>
    <Switch
      id="compaction-toggle"
      checked={useSettingsStore((s) => s.autoCompactionEnabled)}
      onCheckedChange={(v) => useSettingsStore.getState().setAutoCompactionEnabled(v)}
    />
  </div>
  {useSettingsStore((s) => s.autoCompactionEnabled) && (
    <div className="mt-3">
      <label className="text-sm text-muted-foreground">
        Threshold: {useSettingsStore((s) => s.compactionTokenThreshold).toLocaleString()} tokens
      </label>
      <input
        type="range"
        min="20000"
        max="200000"
        step="10000"
        value={useSettingsStore((s) => s.compactionTokenThreshold)}
        onChange={(e) => useSettingsStore.getState().setCompactionTokenThreshold(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </div>
  )}
</SettingsSection>
```

- [ ] **Step 3: Visual check**

Run: `pnpm tauri:dev`
Open Settings > Preferences. Verify the "Context Management" section appears with a toggle and slider. Enable it. Have a long conversation (>80k tokens estimated). When the agent finishes, verify the compaction fires and a toast appears.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-agent-stream.ts src/components/settings/preferences-tab.tsx
git commit -m "feat(compaction): add auto-compaction frontend with settings toggle and threshold"
```

---

## Chunk 4: Cross-Cutting Concerns and Finalization

---

### Task 30: i18n Message Extraction

- [ ] **Step 1: Extract all new user-facing strings**

Run: `pnpm i18n:extract`
This scans all `src/` files for `t()` and `Trans` calls and updates `src/locales/en/messages.js`.

- [ ] **Step 2: Verify no untranslated strings in new components**

Grep all new and modified components for hardcoded English strings that should be wrapped in `t()`:

```bash
rg --type tsx --type ts '"[A-Z][a-z]' src/components/settings/settings-section.tsx src/components/conversation/suggested-prompts.tsx src/hooks/use-scheduler.ts
```

Wrap any found strings with `t()`. Reference the existing i18n pattern in `src/lib/i18n.ts`.

- [ ] **Step 3: Compile messages**

Run: `pnpm i18n:compile`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/locales/en/messages.js
git commit -m "chore(i18n): extract and compile messages for concierge-ui features"
```

---

### Task 31: Final Biome + CSpell Check

- [ ] **Step 1: Run Biome lint and format**

Run: `pnpm lint`
Expected: No errors

If errors exist, fix them:

Run: `pnpm lint:fix`

- [ ] **Step 2: Run CSpell**

Run: `pnpm exec cspell src/components/settings/settings-section.tsx src/components/settings/shortcuts-tab.tsx src/components/conversation/suggested-prompts.tsx src/lib/audio.ts src/lib/suggested-prompts.ts src/lib/keyboard-shortcuts.ts src/hooks/use-scheduler.ts src/hooks/use-app-version.ts src/hooks/use-workspace-git.ts src/hooks/use-edit-message.ts src/components/workspace/file-tree-panel.tsx src/components/conversation/scheduled-messages-panel.tsx`

If any words are flagged as misspellings, add them to `cspell.json`:

```json
{
  "words": [
    "existing_words...",
    "compaction",
    "schedulee"
  ]
}
```

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint and spelling for concierge-ui features"
```

---

### Task 32: Run Full Test Suite

- [ ] **Step 1: Run Vitest**

Run: `pnpm test -- --run`
Expected: All tests pass, including the new settings store tests and component tests

- [ ] **Step 2: Run TypeScript type check**

Run: `pnpm check` or `pnpm exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Fix any failures and commit**

```bash
git add -A
git commit -m "fix: resolve test and type errors from concierge-ui implementation"
```

---

## Acceptance Criteria

### Phase 1 Gate
- [ ] All 9 features (F01, F04-F06, F08-F10, F13, F17, F21) functional
- [ ] Settings store consolidated with all 9 new fields, no data loss for existing users
- [ ] SettingsSection used consistently across all settings tabs
- [ ] Keyboard shortcuts reference matches all registered hotkeys
- [ ] Biome + CSpell pass clean
- [ ] `pnpm test -- --run` passes
- [ ] `pnpm tauri:dev` runs without errors

### Phase 2 Gate
- [ ] All 11 features (F03, F07, F14-F16, F18-F20, F22-F23) functional
- [ ] New Tauri commands (check_git_status, list_workspace_files, open_terminal) registered and callable
- [ ] Workspace switcher scopes conversation list correctly
- [ ] Message editing flow (hover > branch choice > inline transform) works end-to-end
- [ ] File tree renders for nested directories
- [ ] All Rust integration tests pass
- [ ] Keyboard navigation works for all new interactive elements

### Phase 3 Gate
- [ ] Thinking mode passes parameters to Claude provider
- [ ] Scheduler stores, lists, fires, and deletes messages correctly
- [ ] Auto-compaction triggers at threshold and preserves conversation coherence
- [ ] scheduled_messages migration runs cleanly
- [ ] Background poller does not cause UI jank
- [ ] All new Rust modules have >80% test coverage
- [ ] Stress test: 100+ scheduled messages process correctly
