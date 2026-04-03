# Deep-Linking Implementation Plan v2 — Route-Based Settings + Layout

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full deep-linking with OS URI scheme (`skilldeck://`) and TanStack Router, making all UI state derivable from the URL. Replace Zustand stores for URL-persisted state with router search params. **Settings are fully route-based** — each tab lives at its own path (`/settings/api-keys`, `/settings/profiles`, etc.) with a shared layout.

**Architecture:** Tauri v2 deep-link plugin (with single-instance integration for desktop) intercepts OS custom protocol events. Frontend uses `onOpenUrl`/`getCurrent` from `@tauri-apps/plugin-deep-link` to receive URLs and navigate TanStack Router. File-based routing with Zod search param validation, loaders for data fetching. Settings pages use a **layout route** (`/settings`) with `<Outlet />` and each tab is a **child route** (`/settings/api-keys`, `/settings/profiles`, etc.). The settings overlay (`settings-overlay.tsx`) is **removed** — all its tab components (`ApiKeysTab`, `ProfilesTab`, `ApprovalsTab`, `AppearanceTab`) are **extracted to separate files** in `src/components/settings/` and wired as route components. The `SettingsTab` Zustand type and `settingsOpen`/`settingsTab` fields are replaced by router navigation.

**Tech Stack:** TanStack Router v1, Zod, Tauri v2, `@tauri-apps/plugin-deep-link`, `@tauri-apps/plugin-single-instance` (with `deep-link` feature), existing `PlatformClient` (Rust), existing DB models/repos (Rust), SQLite (existing), specta/ts-rs (existing, bindings auto-generated on Tauri app launch).

**CRITICAL CODEBASE FACTS** (verified against actual source files):

| Fact | Detail |
|------|--------|
| Router conflict | `react-router-dom@^7.13.1` is installed — **must be removed** before adding TanStack Router |
| Bindings | Auto-generated at `src/lib/bindings.ts` on Tauri app launch via `tauri-specta` |
| Rust commands | Modular in `src-tauri/src/commands/*.rs` — registered in `src-tauri/src/commands/mod.rs` and `collect_commands![]` in `lib.rs` |
| PlatformClient | Defined in `src-tauri/src/platform_client.rs` (NOT `platform.rs`) |
| AppState | Access pattern: `State<'_, Arc<AppState>>` — DB via `state.registry.db.connection().await` |
| TypeScript check | `pnpm check` (NOT `pnpm typecheck`) |
| Linting | `pnpm lint` → `biome check .` |
| Formatting | Biome: single quotes, trailing commas `none`, semicolons `asNeeded` |
| Lint strictness | `noUnusedLocals: "error"`, `noUnusedVariables: "error"` — no unused imports/vars allowed |
| i18n | Lingui with `<Trans>` macro required for user-visible strings; runtime config at `src/i18n` |
| tsconfig | `"jsx": "react-jsx"` — no explicit React import needed |
| App entry | `src/main.tsx` wraps `<App />` in `<I18nProvider>` |
| App component | `src/App.tsx` sets up QueryClient, TooltipProvider, ThemeSync, LanguageSync, renders `<AppShell />` |
| AppShell | `src/components/layout/app-shell.tsx` — renders LeftPanel/CenterPanel/RightPanel in resizable panels |
| Settings overlay | `src/components/overlays/settings-overlay.tsx` — modal with inline sidebar nav and tab content panes |
| Settings tabs | Currently ALL inline in `settings-overlay.tsx` (ApiKeysTab, ProfilesTab, ApprovalsTab, AppearanceTab are local components, NOT separate files) |
| Existing settings components | `achievements-tab.tsx`, `lint-config.tsx` (LINT_CONFIG → `LintConfig`), `platform-tab.tsx`, `preferences-tab.tsx`, `referral-tab.tsx`, `skill-sources.tsx` — these ARE separate files in `src/components/settings/` |
| SettingsTab type | `src/store/ui-overlays.ts` — union of `'apikeys' | 'profiles' | 'approvals' | 'appearance' | 'preferences' | 'referral' | 'platform' | 'lint' | 'sources' | 'achievements'` |
| UI overlays store | `settingsOpen`, `setSettingsOpen`, `settingsTab`, `setSettingsTab` in `src/store/ui-overlays.ts` |
| Left panel search | `searchQuery`/`setSearchQuery` in `ui-ephemeral.ts` |
| Date groups | `collapsedDateGroups`/`toggleDateGroup`/`setDateGroupCollapsed` in `ui-layout.ts` |
| Conversation search | `conversationSearchQuery`/`setConversationSearchQuery` in `ui-ephemeral.ts` (used in CenterPanel) |
| Conversation store | `src/store/conversation.ts` — `activeConversationId`, `setActiveConversation`, `scrollToMessageId`, `setScrollToMessageId` |
| Hotkeys | Settings opened via `meta+,` / `ctrl+,` in `app-shell.tsx` and `main.tsx` |
| `commands` import | All files use `import { commands } from '@/lib/bindings'` |
| noUnusedLocals in tsconfig | `false` (TS allows it), but Biome enforces it at `"error"` level |
| Vite config | Uses `@vitejs/plugin-react-swc` with `@lingui/swc-plugin` and `@tailwindcss/vite` |
| Node modules | No TanStack Router packages installed yet |

---

## Chunk 0: Remove react-router-dom (CRITICAL — must run before Chunk 2)

### Task 0: Remove react-router-dom

**Files:**
- Modify: `package.json`

- [ ] **Step 0.1: Remove react-router-dom**

```bash
pnpm remove react-router-dom
```

> This package conflicts with TanStack Router. Verify NO files import from `react-router-dom`:

```bash
rg "react-router-dom" src/ --type ts --type tsx
```

If any hits remain, remove those imports before proceeding. The existing app does NOT use react-router-dom for routing (it's just a dependency), so this should be clean.

---

## Chunk 1: Dependencies & Tauri Configuration

### Task 1: Install frontend dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add dependencies to package.json**

```json
"dependencies": {
  "@tanstack/react-router": "^1.95.0",
  "@tauri-apps/plugin-deep-link": "^2",
  "zod": "^3.24.0"
},
"devDependencies": {
  "@tanstack/router-devtools": "^1.95.0",
  "@tanstack/router-vite-plugin": "^1.95.0"
}
```

- [ ] **Step 2: Run installation**

```bash
pnpm install
```

### Task 2: Install and configure Tauri deep-link plugins

> **CRITICAL:** Per Tauri docs, on desktop the single-instance plugin **must** have the `deep-link` feature enabled, **must** be registered as the **first** plugin, and deep-link config goes under `plugins.deep-link`.

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 3: Add Tauri plugins to Cargo.toml**

```toml
[target."cfg(any(target_os = \"macos\", windows, target_os = \"linux\"))".dependencies]
tauri-plugin-single-instance = { version = "2", features = ["deep-link"] }

[dependencies]
tauri-plugin-deep-link = "2"
```

- [ ] **Step 4: Register plugins in lib.rs — single-instance FIRST**

> The current plugin chain in `lib.rs` starts with `tauri_plugin_fs::init()`. Insert single-instance **before** that, and deep-link after.

```rust
// src-tauri/src/lib.rs — add at top:
use tauri_plugin_deep_link::DeepLinkExt;

// Inside .setup(), add before the existing async block:
#[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
{
    app.deep_link().register_all()?;
}

// Insert BEFORE .plugin(tauri_plugin_fs::init()):
#[cfg(desktop)]
{
    tauri_builder = tauri_builder.plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
        println!("new instance opened with {argv:?}, deep-link event already handled");
    }));
}

// Insert AFTER single-instance, BEFORE fs:
tauri_builder = tauri_builder.plugin(tauri_plugin_deep_link::init());
```

- [ ] **Step 5: Configure URI scheme in tauri.conf.json**

> Add `plugins` key to existing config (currently has no `plugins` section):

```json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["skilldeck"]
      },
      "mobile": [
        {
          "scheme": ["skilldeck"],
          "appLink": false
        }
      ]
    }
  }
}
```

- [ ] **Step 6: Add deep-link permission to capabilities**

> Add `"deep-link:default"` to the existing `permissions` array in `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "deep-link:default",
    // ...existing permissions unchanged
  ]
}
```

- [ ] **Step 7: Run cargo check**

```bash
cd src-tauri && cargo check
```

---

## Chunk 2: Vite & Router Setup

### Task 3: Configure Vite with TanStack Router plugin

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 8: Update vite.config.ts**

> Add `TanStackRouterVite()` as the **first** plugin (before `tailwindcss()`). Preserve all existing config.

```typescript
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

// In plugins array:
plugins: [TanStackRouterVite(), tailwindcss(), react({ plugins: [['@lingui/swc-plugin', {}]] }), lingui()]
```

- [ ] **Step 9: Create router instance**

**Files:**
- Create: `src/router.ts`

```typescript
export const router = createRouter({ routeTree })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

> Note: The import paths are auto-resolved. Full code:

```typescript
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

- [ ] **Step 10: Update main.tsx to use RouterProvider and deep-link listeners**

**Files:**
- Modify: `src/main.tsx`

> The current `main.tsx` renders `<I18nProvider><App /></I18nProvider>`. Replace with `RouterProvider`. Keep `I18nProvider` wrapping.

```tsx
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { router } from './router'

function handleDeepLinkUrls(urls: string[]) {
  for (const url of urls) {
    try {
      const parsed = new URL(url)
      const pathWithSearch = parsed.pathname + parsed.search
      if (pathWithSearch && pathWithSearch !== '/') {
        router.navigate({ to: pathWithSearch })
        return
      }
    } catch {
      // malformed URL, skip
    }
  }
}

getCurrent().then((urls) => {
  if (urls && urls.length > 0) handleDeepLinkUrls(urls)
})

onOpenUrl((urls) => {
  handleDeepLinkUrls(urls)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nProvider>
  </React.StrictMode>
)
```

> **CRITICAL:** `<App />` is no longer rendered here. Its providers (QueryClient, TooltipProvider, ThemeSync, LanguageSync, GlobalEventListeners, splash screen) are moved to the root route `__root.tsx`. The `settingsOpen`/`settingsTab` event listeners in `App.tsx` are removed (replaced by router navigation).

- [ ] **Step 11: Generate initial route tree**

```bash
pnpm exec vite --force
```

> This generates `src/routeTree.gen.ts`.

---

## Chunk 3: Route Files Creation

### Task 4: Create root route

**Files:**
- Create: `src/routes/__root.tsx`

- [ ] **Step 12: Define root route with Zod search schema**

> This root route wraps the entire app in providers (QueryClient, TooltipProvider, ThemeSync, LanguageSync) and renders `<Outlet />` inside AppShell. The `AppShell` currently renders `<SettingsOverlay />` conditionally — that is **removed**.

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMcpEvents } from '@/hooks/use-mcp-events'
import { useSkillEvents } from '@/hooks/use-skill-events'
import { useSubagentEvents } from '@/hooks/use-subagent-events'
import { useAttachFilesListener } from '@/hooks/use-attach-files-listener'
import { useNudgeListener, usePlatformRegistration } from '@/hooks/use-platform'
import { loadLocale, type locales } from '@/lib/i18n'
import { useSettingsStore } from '@/store/settings'
import { useUILayoutStore } from '@/store/ui-layout'
import { useUIPersistentStore } from '@/store/ui-state'
import { OnboardingWizard } from '@/components/overlays/onboarding-wizard'
import { SplashScreen } from '@/components/overlays/splash-screen'
import { GlobalSearchModal } from '@/components/search/global-search-modal'
import { AppShell } from '@/components/layout/app-shell'
import { commands } from '@/lib/bindings'
import { z } from 'zod'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

export const rootSearchSchema = z.object({
  leftSearch: z.string().optional(),
  profileId: z.string().optional(),
  expandedFolders: z.string().optional(),
  expandedDateGroups: z.string().optional(),
  onboard: z.enum(['true']).optional()
})

export type RootSearch = z.infer<typeof rootSearchSchema>

export const Route = createRootRoute({
  validateSearch: rootSearchSchema,
  component: RootComponent,
  notFoundComponent: NotFound
})

function ThemeSync() {
  const theme = useSettingsStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme
    root.classList.toggle('dark', resolved === 'dark')
  }, [theme])
  return null
}

function LanguageSync() {
  const language = useSettingsStore((s) => s.language)
  useEffect(() => {
    loadLocale(language as keyof typeof locales)
  }, [language])
  return null
}

function GlobalEventListeners() {
  useMcpEvents()
  useSubagentEvents()
  useSkillEvents()
  useAttachFilesListener()
  return null
}

function AppContent() {
  const onboardingComplete = useUIPersistentStore((s) => s.onboardingComplete)
  const globalSearchOpen = useState(false)

  useEffect(() => {
    const handleOpenGlobalSearch = () => {
      window.dispatchEvent(new CustomEvent('skilldeck:open-global-search'))
    }
    window.addEventListener('skilldeck:open-global-search', handleOpenGlobalSearch)
    return () => window.removeEventListener('skilldeck:open-global-search', handleOpenGlobalSearch)
  }, [])

  return (
    <>
      <GlobalEventListeners />
      <AppShell />
      {!onboardingComplete && <OnboardingWizard />}
    </>
  )
}

function RootProviders({ children }: { children: React.ReactNode }) {
  const setSettingsOpen = useUIOverlaysStore_getter('setSettingsOpen') // handled via router now
  const setRightTab = useUILayoutStore((s) => s.setRightTab)

  const [showSplash, setShowSplash] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  // Load syntax theme CSS on mount
  useEffect(() => {
    commands.getSyntaxCss().then((res) => {
      if (res.status === 'error') {
        console.error('Failed to load syntax theme CSS:', res.error)
        return
      }
      const css = res.data
      const style = document.getElementById('syntax-theme')
      if (style) {
        style.textContent = css
      } else {
        const s = document.createElement('style')
        s.id = 'syntax-theme'
        s.textContent = css
        document.head.appendChild(s)
      }
    }).catch((err) => {
      console.error('Failed to load syntax theme CSS:', err)
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 2500)
    return () => clearTimeout(timer)
  }, [])

  const handleTransitionEnd = () => {
    if (fadeOut) setShowSplash(false)
  }

  // Global listener: open settings with a specific tab → navigate to route
  useEffect(() => {
    const handleOpenSettings = (e: CustomEvent<{ tab: string }>) => {
      // Navigate to the settings route for the given tab
      router.navigate({ to: `/settings/${e.detail.tab}` })
    }
    window.addEventListener('skilldeck:open-settings', handleOpenSettings as EventListener)
    return () => window.removeEventListener('skilldeck:open-settings', handleOpenSettings as EventListener)
  }, [])

  // Global listener: set right panel tab
  useEffect(() => {
    const handleSetRightTab = (e: CustomEvent<{ tab: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics' }>) => {
      setRightTab(e.detail.tab)
    }
    window.addEventListener('skilldeck:set-right-tab', handleSetRightTab as EventListener)
    return () => window.removeEventListener('skilldeck:set-right-tab', handleSetRightTab as EventListener)
  }, [setRightTab])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeSync />
        <LanguageSync />
        {children}
        {showSplash && (
          <div
            className={`fixed inset-0 z-50 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
            onTransitionEnd={handleTransitionEnd}
          >
            <SplashScreen />
          </div>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  )
}

// Remove the useUIOverlaysStore_getter helper above — it was a mistake.
// Instead, just use the store directly or remove the settings-related listeners.

function RootComponent() {
  return (
    <RootProviders>
      <Outlet />
    </RootProviders>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
    </div>
  )
}
```

> **NOTE:** The above has a bug — `useUIOverlaysStore_getter` doesn't exist. Remove the `setSettingsOpen` line and the helper. The corrected version simply removes settings overlay references. The `skilldeck:open-settings` custom event listener navigates to the settings route instead of opening the overlay.

> **CORRECTED RootComponent:**

```tsx
function RootComponent() {
  const setRightTab = useUILayoutStore((s) => s.setRightTab)

  useEffect(() => {
    const handleSetRightTab = (e: CustomEvent<{ tab: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics' }>) => {
      setRightTab(e.detail.tab)
    }
    window.addEventListener('skilldeck:set-right-tab', handleSetRightTab as EventListener)
    return () => window.removeEventListener('skilldeck:set-right-tab', handleSetRightTab as EventListener)
  }, [setRightTab])

  return (
    <RootProviders>
      <Outlet />
    </RootProviders>
  )
}
```

> And `RootProviders` — remove the `setSettingsOpen` line entirely.

### Task 5: Create index route

**Files:**
- Create: `src/routes/index.tsx`

- [ ] **Step 13: Create index route (home)**

> The AppShell renders the 3-panel layout. This route simply renders nothing extra — the panels are always visible. The index route exists so TanStack Router has a `/` match.

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: function Index() {
    return null
  }
})
```

### Task 6: Create conversation route

**Files:**
- Create: `src/routes/conversations.$conversationId.tsx`

- [ ] **Step 14: Define conversation route with loader and search schema**

> Uses the actual store methods from `src/store/conversation.ts`: `setActiveConversation`, `setScrollToMessageId`. Uses `commands` from `@/lib/bindings` (auto-generated).

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { useConversationStore } from '@/store/conversation'

export const conversationSearchSchema = z.object({
  messageId: z.string().optional(),
  branchId: z.string().optional(),
  conversationSearch: z.string().optional(),
  autoScroll: z.string().transform(v => v !== 'false').optional()
})

export const Route = createFileRoute('/conversations/$conversationId')({
  validateSearch: conversationSearchSchema,
  component: ConversationLayout
})

function ConversationLayout() {
  const { conversationId } = Route.useParams()
  const { messageId } = Route.useSearch()
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation)
  const setScrollToMessageId = useConversationStore((s) => s.setScrollToMessageId)

  useEffect(() => {
    setActiveConversation(conversationId)
    if (messageId) {
      setScrollToMessageId(messageId)
    }
  }, [conversationId, messageId, setActiveConversation, setScrollToMessageId])

  return null
}
```

> **NOTE:** No loader here — the `useMessagesWithStream` hook in `CenterPanel` already fetches messages via React Query. Adding a loader would create a duplicate fetch path. The conversation route is purely for URL synchronization.

### Task 7: Create settings layout route + child tab routes

**Files:**
- Create: `src/routes/settings.tsx` (layout)
- Create: `src/routes/settings.index.tsx` (redirect to api-keys)
- Create: `src/routes/settings.api-keys.tsx`
- Create: `src/routes/settings.profiles.tsx`
- Create: `src/routes/settings.approvals.tsx`
- Create: `src/routes/settings.appearance.tsx`
- Create: `src/routes/settings.preferences.tsx`
- Create: `src/routes/settings.platform.tsx`
- Create: `src/routes/settings.referral.tsx`
- Create: `src/routes/settings.lint.tsx`
- Create: `src/routes/settings.sources.tsx`
- Create: `src/routes/settings.achievements.tsx`
- Modify: `src/components/overlays/settings-overlay.tsx` — **REMOVE entirely**
- Extract from `settings-overlay.tsx`: Create `src/components/settings/api-keys-tab.tsx`
- Extract from `settings-overlay.tsx`: Create `src/components/settings/approvals-tab.tsx`
- Extract from `settings-overlay.tsx`: Create `src/components/settings/appearance-tab.tsx`
- Modify: `src/components/layout/app-shell.tsx` — remove SettingsOverlay render and hotkey
- Modify: `src/store/ui-overlays.ts` — remove `settingsOpen`, `setSettingsOpen`, `settingsTab`, `setSettingsTab`
- Modify: `src/App.tsx` — remove settings-related event listeners

- [ ] **Step 15: Extract inline tab components from settings-overlay.tsx**

> **CRITICAL:** The current `settings-overlay.tsx` has `ApiKeysTab`, `ProfilesTab`, `ApprovalsTab`, `AppearanceTab` as **local functions**, not separate files. These MUST be extracted.

**Create `src/components/settings/api-keys-tab.tsx`:**
> Copy the `ApiKeysTab` function, `useAvailableModels` hook, and `PROVIDERS` constant from `settings-overlay.tsx` (lines 22657–22791). Export `ApiKeysTab` as a named export. Add all required imports (commands, useMutation, useQuery, etc.). Keep Biome-compliant formatting (single quotes, no trailing commas, semicolons `asNeeded`).

**Create `src/components/settings/approvals-tab.tsx`:**
> Copy `ApprovalsTab` and `APPROVAL_FIELDS` (lines 23058–23148). Export `ApprovalsTab`.

**Create `src/components/settings/appearance-tab.tsx`:**
> Copy `AppearanceTab` (lines 23155–23186). Export `AppearanceTab`.

- [ ] **Step 16: Create settings layout route**

```tsx
// src/routes/settings.tsx
import { createFileRoute, Link, Outlet, useRouter } from '@tanstack/react-router'
import {
  AlertTriangle, Globe, Key, Layers, ShieldCheck, Star, Sun,
  Folder, Share2, Trophy, Bell, ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SETTINGS_TABS = [
  { id: 'api-keys', label: 'API Keys', Icon: Key },
  { id: 'profiles', label: 'Profiles', Icon: Layers },
  { id: 'approvals', label: 'Tool Approvals', Icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', Icon: Sun },
  { id: 'preferences', label: 'Preferences', Icon: Bell },
  { id: 'platform', label: 'Platform', Icon: Globe },
  { id: 'referral', label: 'Refer & Earn', Icon: Share2 },
  { id: 'lint', label: 'Lint Rules', Icon: AlertTriangle },
  { id: 'sources', label: 'Skill Sources', Icon: Folder },
  { id: 'achievements', label: 'Achievements', Icon: Trophy }
] as const

export const Route = createFileRoute('/settings')({
  component: SettingsLayout
})

function SettingsLayout() {
  const router = useRouter()
  const pathname = router.state.location.pathname
  const activeTab = pathname.split('/').pop() ?? 'api-keys'

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[520px] rounded-xl border border-border bg-background shadow-2xl flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-44 shrink-0 border-r border-border bg-muted/30 p-2 flex flex-col gap-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Settings
          </p>
          {SETTINGS_TABS.map(({ id, label, Icon }) => (
            <Link
              key={id}
              to={`/settings/${id}`}
              className={cn(
                'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left transition-colors',
                activeTab === id
                  ? 'bg-primary/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}

          <div className="mt-auto">
            <button
              type="button"
              onClick={() => router.history.back()}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          </div>
        </nav>

        {/* Content pane */}
        <div className="flex-1 overflow-y-auto p-6 text-left">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 17: Create settings child routes**

> **CRITICAL:** TanStack Router file-based routing uses `.` for path segments.

```tsx
// src/routes/settings.api-keys.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ApiKeysTab } from '@/components/settings/api-keys-tab'

export const Route = createFileRoute('/settings/api-keys')({
  component: ApiKeysTab
})
```

```tsx
// src/routes/settings.profiles.tsx
import { createFileRoute } from '@tanstack/react-router'
import { SettingsOverlay } from '@/components/overlays/settings-overlay'
// NO — ProfilesTab is still inline. Extract it first (see Step 15), then:

import { createFileRoute } from '@tanstack/react-router'

function ExtractedProfilesTab() {
  // Copy from settings-overlay.tsx ProfilesTab function
  // ... full component code ...
}

export const Route = createFileRoute('/settings/profiles')({
  component: ExtractedProfilesTab
})
```

> **Actually, ProfilesTab is still in settings-overlay.tsx.** Two options:
> 1. Extract it to `src/components/settings/profiles-tab.tsx` (preferred — clean separation)
> 2. Create a thin wrapper route component that re-exports it

> **Go with option 1:** Extract `ProfilesTab` from `settings-overlay.tsx` to `src/components/settings/profiles-tab.tsx`.

**Repeat pattern for ALL tabs:**

| Route file | Component | Source |
|---|---|---|
| `settings.api-keys.tsx` | `ApiKeysTab` | Extracted to `api-keys-tab.tsx` |
| `settings.profiles.tsx` | `ProfilesTab` | Extracted to `profiles-tab.tsx` |
| `settings.approvals.tsx` | `ApprovalsTab` | Extracted to `approvals-tab.tsx` |
| `settings.appearance.tsx` | `AppearanceTab` | Extracted to `appearance-tab.tsx` |
| `settings.preferences.tsx` | `PreferencesTab` | Existing `preferences-tab.tsx` |
| `settings.platform.tsx` | `PlatformTab` | Existing `platform-tab.tsx` |
| `settings.referral.tsx` | `ReferralTab` | Existing `referral-tab.tsx` |
| `settings.lint.tsx` | `LintConfig` | Existing `lint-config.tsx` |
| `settings.sources.tsx` | `SkillSources` | Existing `skill-sources.tsx` |
| `settings.achievements.tsx` | `AchievementsTab` | Existing `achievements-tab.tsx` |

**Pattern for existing components (already separate files):**

```tsx
// src/routes/settings.preferences.tsx
import { createFileRoute } from '@tanstack/react-router'
import { PreferencesTab } from '@/components/settings/preferences-tab'

export const Route = createFileRoute('/settings/preferences')({
  component: PreferencesTab
})
```

- [ ] **Step 18: Create settings index redirect**

```tsx
// src/routes/settings.index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/api-keys' })
  }
})
```

- [ ] **Step 19: Remove settings-overlay.tsx**

> Delete `src/components/overlays/settings-overlay.tsx` entirely. All its content has been extracted.

- [ ] **Step 20: Update app-shell.tsx**

> Remove:
> - `import { SettingsOverlay } from '@/components/overlays/settings-overlay'`
> - `const settingsOpen = useUIOverlaysStore((s) => s.settingsOpen)`
> - `const setSettingsOpen = useUIOverlaysStore((s) => s.setSettingsOpen)`
> - The `meta+,` hotkey — replace with router navigation:
> ```tsx
> import { useRouter } from '@tanstack/react-router'
> // inside AppShell:
> const router = useRouter()
> useHotkeys('meta+,, ctrl+,', (e) => {
>   e.preventDefault()
>   router.navigate({ to: '/settings/api-keys' })
> })
> ```
> - `{settingsOpen && <SettingsOverlay />}` — remove this line
> - Remove the keyboard event listener for `meta+,` that calls `setSettingsOpen(true)`

- [ ] **Step 21: Update left-panel.tsx**

> Currently, the settings button calls `setSettingsOpen(true)`. Replace with router navigation:
> ```tsx
> import { useRouter } from '@tanstack/react-router'
>
> // Inside LeftPanel:
> const router = useRouter()
>
> // Settings button:
> <Button variant="ghost" size="icon-sm" aria-label="Settings"
>   onClick={() => router.navigate({ to: '/settings/api-keys' })}
> >
>   <Settings className="size-4" />
> </Button>
>
> // Profile creation shortcut button:
> <Button variant="ghost" size="icon-xs"
>   onClick={() => router.navigate({ to: '/settings/profiles' })}
>   title="Create new profile"
>   className="h-7 w-7"
> >
>   <Plus className="size-3" />
> </Button>
> ```
> Remove: `import { useUIOverlaysStore } from '@/store/ui-overlays'` (if no longer used).

- [ ] **Step 22: Update ui-overlays store**

> Remove `settingsOpen`, `setSettingsOpen`, `settingsTab`, `setSettingsTab` from `src/store/ui-overlays.ts`. Keep `commandPaletteOpen`, `setCommandPaletteOpen`, `globalSearchOpen`, `setGlobalSearchOpen`. The `SettingsTab` type can be removed or kept for backward compatibility — remove it.

> **Before:**
```typescript
export type SettingsTab = 'apikeys' | 'profiles' | 'approvals' | 'appearance' | 'preferences' | 'referral' | 'platform' | 'lint' | 'sources' | 'achievements'

interface UIOverlaysState {
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  globalSearchOpen: boolean
  setGlobalSearchOpen: (open: boolean) => void
  settingsTab: SettingsTab
  setSettingsTab: (tab: SettingsTab) => void
}
```

> **After:**
```typescript
interface UIOverlaysState {
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  globalSearchOpen: boolean
  setGlobalSearchOpen: (open: boolean) => void
}

export const useUIOverlaysStore = create<UIOverlaysState>((set) => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  globalSearchOpen: false,
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open })
}))
```

- [ ] **Step 23: Update App.tsx**

> Remove:
> - `import { useUIOverlaysStore } from '@/store/ui-overlays'`
> - `const setSettingsOpen = useUIOverlaysStore((s) => s.setSettingsOpen)`
> - `const setSettingsTab = useUIOverlaysStore((s) => s.setSettingsTab)`
> - The `skilldeck:open-settings` event listener (this is now in `__root.tsx`)
> - The `SettingsOverlay` import is already gone (file deleted)

> Remove the `import type { SettingsTab } from '@/store/ui-overlays'` line.

- [ ] **Step 24: Update all remaining references to removed settings store fields**

```bash
rg "settingsOpen|setSettingsOpen|settingsTab|setSettingsTab" src/ --type ts --type tsx
```

> Every hit must be updated or removed. Common locations:
> - Any component listening for `skilldeck:open-settings` custom event and calling `setSettingsOpen(true)` — change to `router.navigate({ to: '/settings/api-keys' })`
> - Any component referencing `useUIOverlaysStore((s) => s.settingsOpen)` — remove

### Task 8: Create shared route for platform hydration

**Files:**
- Create: `src/routes/shared.$shareToken.tsx`

- [ ] **Step 25: Implement shared route**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { commands } from '@/lib/bindings'

export const Route = createFileRoute('/shared/$shareToken')({
  loader: async ({ params }) => {
    const fetchRes = await commands.getSharedConversation(params.shareToken)
    if (fetchRes.status === 'error') throw new Error(fetchRes.error)

    const hydrateRes = await commands.hydrateSharedConversation(fetchRes.data)
    if (hydrateRes.status === 'error') throw new Error(hydrateRes.error)

    throw redirect({
      to: '/conversations/$conversationId',
      params: { conversationId: hydrateRes.data.local_id }
    })
  },
  component: () => <div className="p-4">Loading shared conversation...</div>
})
```

> **NOTE:** `commands.getSharedConversation` and `commands.hydrateSharedConversation` don't exist yet — they're created in Chunk 4. The binding names will be auto-generated from the Rust command names (snake_case → camelCase).

---

## Chunk 4: Rust Backend — Shared Conversation Support

### Task 9: Add shared conversation DTOs to PlatformClient

**Files:**
- Modify: `src-tauri/src/platform_client.rs`

- [ ] **Step 26: Add DTOs after existing DTOs (after `SyncSkillsResponse`)**

```rust
// ── Shared Conversation DTOs ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct SharedConversationMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
    pub branch_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct SharedConversationPayload {
    pub id: String,
    pub title: String,
    pub messages: Vec<SharedConversationMessage>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ShareResponse {
    pub share_token: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct SyncStatusResponse {
    pub is_synced: bool,
    pub last_synced_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct SyncConversationResponse {
    pub share_token: String,
}

#[derive(Debug, Serialize, Type)]
pub struct SyncConversationRequest {
    pub title: String,
    pub messages: Vec<SharedConversationMessage>,
}

#[derive(Debug, Serialize, Type)]
pub struct HydrateResponse {
    pub local_id: String,
}
```

### Task 10: Add methods to PlatformClient

**Files:**
- Modify: `src-tauri/src/platform_client.rs`

- [ ] **Step 27: Add `get_shared_conversation` method**

> Add after the existing auth-free endpoints (e.g., after `validate_referral_code`). Follow the existing retry pattern.

```rust
/// Fetch a publicly shared conversation by token. No auth required.
pub async fn get_shared_conversation(
    &self,
    share_token: &str,
    cancel: Option<CancellationToken>,
) -> Result<SharedConversationPayload, PlatformError> {
    self.check_enabled()?;
    let url = format!("{}/api/shared/{}", self.base_url, share_token);
    let fut = || async {
        let resp = self.http.get(&url).send().await?;
        Self::check_response(resp).await
    };
    self.retry(fut, cancel).await
}
```

- [ ] **Step 28: Add `check_sync_status`**

```rust
pub async fn check_sync_status(
    &self,
    conversation_id: &str,
    cancel: Option<CancellationToken>,
) -> Result<SyncStatusResponse, PlatformError> {
    self.check_enabled()?;
    let auth = self.auth_header()?;
    let url = format!("{}/api/conversations/{}/sync-status", self.base_url, conversation_id);
    let fut = || async {
        let resp = self.http.get(&url).header("Authorization", &auth).send().await?;
        Self::check_response(resp).await
    };
    self.retry(fut, cancel).await
}
```

- [ ] **Step 29: Add `share_conversation`**

```rust
pub async fn share_conversation(
    &self,
    conversation_id: &str,
    cancel: Option<CancellationToken>,
) -> Result<ShareResponse, PlatformError> {
    self.check_enabled()?;
    let auth = self.auth_header()?;
    let url = format!("{}/api/conversations/{}/share", self.base_url, conversation_id);
    let fut = || async {
        let resp = self.http.post(&url).header("Authorization", &auth).send().await?;
        Self::check_response(resp).await
    };
    self.retry(fut, cancel).await
}
```

- [ ] **Step 30: Add `sync_conversation_to_platform`**

```rust
pub async fn sync_conversation_to_platform(
    &self,
    conversation_id: &str,
    payload: SyncConversationRequest,
    cancel: Option<CancellationToken>,
) -> Result<SyncConversationResponse, PlatformError> {
    self.check_enabled()?;
    let auth = self.auth_header()?;
    let url = format!("{}/api/conversations/{}/sync", self.base_url, conversation_id);
    let fut = || async {
        let resp = self.http.put(&url).header("Authorization", &auth).json(&payload).send().await?;
        Self::check_response(resp).await
    };
    self.retry(fut, cancel).await
}
```

- [ ] **Step 31: Run cargo check**

```bash
cd src-tauri && cargo check
```

### Task 11: Add Tauri commands

**Files:**
- Modify: `src-tauri/src/commands/platform.rs` (commands that use PlatformClient)
- Modify: `src-tauri/src/commands/conversations.rs` (hydrate command that uses DB)
- Modify: `src-tauri/src/commands/mod.rs` (no change needed — modules already declared)
- Modify: `src-tauri/src/lib.rs` (add commands to `collect_commands![]`)

- [ ] **Step 32: Add platform commands in `commands/platform.rs`**

> The existing platform commands follow the pattern:
> - `pub async fn ensure_platform_registration(state: State<'_, Arc<AppState>>, ...)`
> - Use `state.platform_client.read().await` to get the client

```rust
#[specta]
#[tauri::command]
pub async fn get_shared_conversation(
    state: State<'_, Arc<AppState>>,
    share_token: String,
) -> Result<SharedConversationPayload, String> {
    let client = state.platform_client.read().await;
    client.get_shared_conversation(&share_token, None).await.map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn check_sync_status(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<SyncStatusResponse, String> {
    let client = state.platform_client.read().await;
    client.check_sync_status(&conversation_id, None).await.map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn share_conversation(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
) -> Result<ShareResponse, String> {
    let client = state.platform_client.read().await;
    client.share_conversation(&conversation_id, None).await.map_err(|e| e.to_string())
}

#[specta]
#[tauri::command]
pub async fn sync_conversation_to_platform(
    state: State<'_, Arc<AppState>>,
    conversation_id: String,
    payload: SyncConversationRequest,
) -> Result<SyncConversationResponse, String> {
    let client = state.platform_client.read().await;
    client.sync_conversation_to_platform(&conversation_id, payload, None).await.map_err(|e| e.to_string())
}
```

> **CRITICAL:** Import the DTOs at the top of `commands/platform.rs`:
> ```rust
> use crate::platform_client::{SharedConversationPayload, ShareResponse, SyncStatusResponse, SyncConversationResponse, SyncConversationRequest};
> ```

- [ ] **Step 33: Add `hydrate_shared_conversation` in `commands/conversations.rs`**

> **CRITICAL:** This command writes to the DB using existing models/repos. The existing conversation creation pattern uses `sea_orm` with `ActiveModelTrait`. Read the existing `create_conversation` command in `commands/conversations.rs` to match the exact pattern.

```rust
#[specta]
#[tauri::command]
pub async fn hydrate_shared_conversation(
    state: State<'_, Arc<AppState>>,
    payload: SharedConversationPayload,
) -> Result<HydrateResponse, String> {
    let db = state.registry.db.connection().await.map_err(|e| e.to_string())?;

    // Create conversation using the same pattern as create_conversation
    // ADAPT to match actual existing model fields
    let conv_id = Uuid::parse_str(&payload.id).unwrap_or_else(|_| Uuid::new_v4());
    let now = chrono::Utc::now().fixed_offset();

    // Use the existing conversations model (read src-tauri/skilldeck-models/src/conversations.rs for exact fields)
    // let conversation = conversations::ActiveModel { ... };
    // conversation.insert(db).await.map_err(|e| e.to_string())?;

    // Insert messages using existing messages model
    // for msg in &payload.messages { ... }

    Ok(HydrateResponse { local_id: payload.id })
}
```

> **NOTE:** This is a skeleton. The implementor MUST read `src-tauri/skilldeck-models/src/conversations.rs` and `src-tauri/skilldeck-models/src/messages.rs` for the exact model fields, and `src-tauri/src/commands/conversations.rs` for the exact creation pattern.

- [ ] **Step 34: Register new commands in `lib.rs`**

> Add to the `collect_commands![]` macro in `src-tauri/src/lib.rs`:
> ```rust
> // shared conversation commands
> get_shared_conversation,
> check_sync_status,
> share_conversation,
> sync_conversation_to_platform,
> hydrate_shared_conversation,
> ```

> Also add the imports at the top:
> ```rust
> use commands::platform::{
>     // ...existing imports...
>     get_shared_conversation, check_sync_status, share_conversation, sync_conversation_to_platform,
> };
> // hydrate_shared_conversation comes from conversations module — already imported
> ```

- [ ] **Step 35: Run cargo check and regenerate bindings**

```bash
cd src-tauri && cargo check
# Bindings are auto-generated on `tauri dev` launch, but for CI:
pnpm tauri dev
# Then verify:
rg "getSharedConversation|checkSyncStatus|shareConversation|syncConversationToPlatform|hydrateSharedConversation" src/lib/bindings.ts
```

---

## Chunk 5: URL State Hooks & Zustand Removal

### Task 12: Create URL-derived hooks

**Files:**
- Create: `src/hooks/use-left-panel-search.ts`
- Create: `src/hooks/use-expanded-folders.ts`
- Create: `src/hooks/use-expanded-date-groups.ts`
- Create: `src/hooks/use-profile-filter.ts`

- [ ] **Step 36: Implement useLeftPanelSearch**

```typescript
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback } from 'react'

export function useLeftPanelSearch() {
  const navigate = useNavigate()
  const { leftSearch } = Route.useSearch()

  const setLeftSearch = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({ ...prev, leftSearch: value || undefined })
      })
    },
    [navigate]
  )

  return { leftSearch: leftSearch ?? '', setLeftSearch }
}
```

- [ ] **Step 37: Implement useExpandedFolders**

```typescript
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback, useMemo } from 'react'

export function useExpandedFolders() {
  const navigate = useNavigate()
  const { expandedFolders } = Route.useSearch()

  const folderIds = useMemo(() => {
    return expandedFolders ? expandedFolders.split(',').filter(Boolean) : []
  }, [expandedFolders])

  const toggleFolder = useCallback(
    (folderId: string) => {
      navigate({
        search: (prev) => {
          const current = prev.expandedFolders ? prev.expandedFolders.split(',') : []
          const next = current.includes(folderId) ? current.filter((id) => id !== folderId) : [...current, folderId]
          return { ...prev, expandedFolders: next.length ? next.join(',') : undefined }
        }
      })
    },
    [navigate]
  )

  return { expandedFolders: folderIds, toggleFolder }
}
```

- [ ] **Step 38: Implement useExpandedDateGroups**

```typescript
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback, useMemo } from 'react'

export function useExpandedDateGroups() {
  const navigate = useNavigate()
  const { expandedDateGroups } = Route.useSearch()

  const groupKeys = useMemo(() => {
    return expandedDateGroups ? expandedDateGroups.split(',').filter(Boolean) : []
  }, [expandedDateGroups])

  const toggleDateGroup = useCallback(
    (key: string) => {
      navigate({
        search: (prev) => {
          const current = prev.expandedDateGroups ? prev.expandedDateGroups.split(',') : []
          const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
          return { ...prev, expandedDateGroups: next.length ? next.join(',') : undefined }
        }
      })
    },
    [navigate]
  )

  return { expandedDateGroups: groupKeys, toggleDateGroup }
}
```

- [ ] **Step 39: Implement useProfileFilter**

```typescript
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback } from 'react'

export function useProfileFilter() {
  const navigate = useNavigate()
  const { profileId } = Route.useSearch()

  const setProfileId = useCallback(
    (id: string | null) => {
      navigate({
        search: (prev) => ({ ...prev, profileId: id || undefined })
      })
    },
    [navigate]
  )

  return { profileId: profileId ?? null, setProfileId }
}
```

### Task 13: Remove Zustand state that is now URL-derived

**Files:**
- Modify: `src/store/ui-ephemeral.ts` — remove `searchQuery`, `setSearchQuery`
- Modify: `src/store/ui-layout.ts` — remove `collapsedDateGroups`, `toggleDateGroup`, `setDateGroupCollapsed`

- [ ] **Step 40: Remove searchQuery from ui-ephemeral store**

> Remove these from the interface and the store implementation:
> - `searchQuery: string`
> - `setSearchQuery: (query: string) => void`
> Keep: `conversationSearchQuery`/`setConversationSearchQuery` (used in CenterPanel — not URL-derived).

- [ ] **Step 41: Remove collapsedDateGroups from ui-layout store**

> Remove from interface and store:
> - `collapsedDateGroups: Record<string, boolean>`
> - `toggleDateGroup: (key: string) => void`
> - `setDateGroupCollapsed: (key: string, collapsed: boolean) => void`
> Also remove from `partialize` if present.

- [ ] **Step 42: Update LeftPanel to use new URL hooks**

> In `src/components/layout/left-panel.tsx`:
>
> **Remove:**
> ```typescript
> const searchQuery = useUIEphemeralStore((s) => s.searchQuery)
> const setSearchQuery = useUIEphemeralStore((s) => s.setSearchQuery)
> const collapsedDateGroups = useUILayoutStore((s) => s.collapsedDateGroups)
> const _toggleDateGroup = useUILayoutStore((s) => s.toggleDateGroup)
> const setDateGroupCollapsed = useUILayoutStore((s) => s.setDateGroupCollapsed)
> const [filterProfileId, setFilterProfileId] = useState<string | null>(null)
> ```
>
> **Add:**
> ```typescript
> import { useLeftPanelSearch } from '@/hooks/use-left-panel-search'
> import { useExpandedFolders } from '@/hooks/use-expanded-folders'
> import { useExpandedDateGroups } from '@/hooks/use-expanded-date-groups'
> import { useProfileFilter } from '@/hooks/use-profile-filter'
>
> const { leftSearch, setLeftSearch } = useLeftPanelSearch()
> const { expandedFolders, toggleFolder } = useExpandedFolders()
> const { expandedDateGroups, toggleDateGroup } = useExpandedDateGroups()
> const { profileId, setProfileId } = useProfileFilter()
> ```
>
> Update all references:
> - `searchQuery` → `leftSearch`
> - `setSearchQuery` → `setLeftSearch`
> - `filterProfileId` → `profileId`
> - `setFilterProfileId` → `setProfileId`
> - `collapsedDateGroups[key]` → `expandedDateGroups.includes(key)`
> - `setDateGroupCollapsed(key, collapsed)` → `toggleDateGroup(key)`

- [ ] **Step 43: Find and update ALL other components referencing removed Zustand fields**

```bash
rg "setSearchQuery|collapsedDateGroups|toggleDateGroup|setDateGroupCollapsed|searchQuery" src/ --type ts --type tsx
```

> Update every hit. Common locations to check:
> - Any component reading `useUIEphemeralStore((s) => s.searchQuery)` → use `useLeftPanelSearch` hook
> - Any component reading `useUILayoutStore((s) => s.collapsedDateGroups)` → use `useExpandedDateGroups` hook

---

## Chunk 6: Share Button & Conversation Search via URL

### Task 14: Update share button to use Tauri commands

- [ ] **Step 44: Find the share button component**

```bash
rg "share|clipboard|copy.*link" src/components/ --type tsx -l
```

- [ ] **Step 45: Update share handler**

> Replace any existing share logic with Tauri commands:
> ```typescript
> import { commands } from '@/lib/bindings'
>
> const handleShare = async (conversationId: string) => {
>   try {
>     const syncRes = await commands.checkSyncStatus(conversationId)
>     if (syncRes.status === 'error') { toast.error('Failed to check sync status'); return }
>     if (!syncRes.data.is_synced) {
>       // Show upload confirmation — then sync
>       // ...
>     }
>     const shareRes = await commands.shareConversation(conversationId)
>     if (shareRes.status === 'error') { toast.error('Failed to share'); return }
>     const shareUrl = `skilldeck://shared/${shareRes.data.share_token}`
>     await navigator.clipboard.writeText(shareUrl)
>     toast.success('Shareable link copied!')
>   } catch (err) {
>     toast.error('Failed to share conversation')
>   }
> }
> ```

### Task 15: Bind conversation search to URL params

- [ ] **Step 46: Update CenterPanel**

> In `src/components/layout/center-panel.tsx`, the `conversationSearchQuery` from `ui-ephemeral` store can optionally be URL-derived via the conversation route's search params. However, since CenterPanel is always rendered (not just when a conversation route matches), and the search is a transient UI state, keeping it in Zustand is acceptable. If you want it URL-derived, use `Route.useSearch()` from `conversations.$conversationId` route.

> **Decision:** Keep `conversationSearchQuery` in Zustand — it's ephemeral per-conversation state, not bookmarkable.

---

## Chunk 7: Devtools, Testing & Cleanup

### Task 16: Add route devtools

- [ ] **Step 47: Add TanStack Router Devtools in __root.tsx**

```tsx
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

function RootComponent() {
  // ...existing code...
  return (
    <RootProviders>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </RootProviders>
  )
}
```

### Task 17: Type-check and verify

- [ ] **Step 48: Run TypeScript type-check**

```bash
pnpm check
```

- [ ] **Step 49: Run unit tests**

```bash
pnpm test
```

- [ ] **Step 50: Run lint**

```bash
pnpm lint
```

- [ ] **Step 51: Verify no remaining references to removed Zustand fields**

```bash
rg "setSearchQuery|collapsedDateGroups|toggleDateGroup|setDateGroupCollapsed|settingsOpen|setSettingsOpen|settingsTab|setSettingsTab" src/ --type ts --type tsx
```

> Expect: zero results.

- [ ] **Step 52: Verify no JavaScript platform API client exists**

```bash
rg "platform-api|platformApi|fetch.*platform" src/ --type ts --type tsx
```

> Expect: zero results.

- [ ] **Step 53: Verify react-router-dom is fully removed**

```bash
rg "react-router-dom" src/ --type ts --type tsx
```

> Expect: zero results.

---

## Task Dependency Graph

```
Chunk 0 (remove react-router-dom)
  └── Chunk 1 (deps + Tauri config)
        └── Chunk 2 (Vite + router setup)
              ├── Chunk 3 (routes — can partially parallelize)
              │     ├── Task 4 (root route) ← blocks everything
              │     ├── Task 5 (index route)
              │     ├── Task 6 (conversation route)
              │     └── Task 7 (settings routes) ← depends on Task 4
              ├── Chunk 4 (Rust backend) ← independent of Chunk 3
              │     ├── Task 9 (DTOs)
              │     ├── Task 10 (PlatformClient methods)
              │     └── Task 11 (Tauri commands)
              ├── Chunk 5 (URL hooks) ← depends on Chunk 3 Task 4
              │     ├── Task 12 (hooks) ← depends on root route schema
              │     └── Task 13 (Zustand removal) ← depends on hooks
              └── Chunk 6 (share + search) ← depends on Chunk 4
                    └── Chunk 7 (cleanup) ← depends on ALL above
```

**Parallelization opportunities:**
- Chunk 3 + Chunk 4 can run in parallel (frontend routes vs Rust backend)
- Within Chunk 3, Task 6 (settings) and Task 6 (conversation) can run in parallel after Task 4 (root route)
- Within Chunk 4, Tasks 9 and 10 are sequential; Task 11 can partially parallelize
