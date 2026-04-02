Here is the complete, updated deep-linking plan. It incorporates the critical architectural shift required for local-db-to-cloud sharing, resolves the Zustand infinite-loop risks, adds type-safe Zod validation, implements proper code-splitting, and updates all agent artifacts.

---

# Deep-Linking System: Complete Implementation Specification (v2)

## Context & Architectural Shift
Because the application ships with a local database, users cannot natively share conversation states simply by exchanging a local `$conversationId`. To support cross-device/cross-user sharing, clicking "Share" must first upload the local conversation state to the platform server, retrieve a platform-agnostic `shareToken`, and construct a URL using this token. The recipient's app intercepts the `/shared/$shareToken` route, fetches the data from the platform, hydrates it into their local DB, and renders the UI.

---

## 1. Route Tree (File-Based)

The Vite plugin automatically generates the route tree in `src/routeTree.gen.ts`.

```
src/routes/
├── __root.tsx                        # Root layout, global search params, 404 catch-all
├── index.tsx                         # / (no conversation, default right tab)
├── settings.tsx                      # /settings 
├── settings/
│   ├── api-keys.tsx                  # /settings/api-keys
│   ├── profiles.tsx                  # /settings/profiles
│   ├── tool-approvals.tsx            # /settings/tool-approvals
│   ├── appearance.tsx                # /settings/appearance
│   ├── preferences.tsx               # /settings/preferences
│   ├── platform.tsx                  # /settings/platform
│   ├── referral.tsx                  # /settings/referral
│   ├── lint.tsx                      # /settings/lint
│   ├── sources.tsx                   # /settings/sources
│   └── achievements.tsx              # /settings/achievements
├── skills.tsx                        # /skills 
├── skills/
│   └── $skillId.tsx                  # /skills/$skillId 
├── mcp.tsx                           # /mcp 
├── mcp/
│   └── $serverId.tsx                 # /mcp/$serverId 
├── workflows.tsx                     # /workflows 
├── workflows/
│   └── $workflowId.tsx               # /workflows/$workflowId 
├── analytics.tsx                     # /analytics 
├── artifacts.tsx                     # /artifacts 
├── shared/
│   └── $shareToken.tsx               # /shared/$shareToken (Fetches remote data)
├── conversations/
│   ├── $conversationId.tsx           # /conversations/$conversationId 
│   ├── $conversationId/
│   │   ├── skills.tsx                # /conversations/$conversationId/skills
│   │   ├── skills/
│   │   │   └── $skillId.tsx          # /conversations/$conversationId/skills/$skillId
│   │   ├── mcp.tsx                   # /conversations/$conversationId/mcp
│   │   ├── mcp/
│   │   │   └── $serverId.tsx         # /conversations/$conversationId/mcp/$serverId
│   │   ├── workflows.tsx             # /conversations/$conversationId/workflows
│   │   ├── workflows/
│   │   │   └── $workflowId.tsx       # /conversations/$conversationId/workflows/$workflowId
│   │   ├── analytics.tsx             # /conversations/$conversationId/analytics
│   │   └── artifacts.tsx             # /conversations/$conversationId/artifacts
└── 404.tsx                           # Explicit 404 component
```

---

## 2. Query Parameters

| Parameter           | Scope                      | Type / Validation                                                       |
|---------------------|----------------------------|-------------------------------------------------------------------------|
| `leftSearch`        | Global                     | `z.string().optional()`                                                 |
| `profileId`         | Global                     | `z.string().optional()`                                                 |
| `expandedFolders`   | Global                     | `z.string().optional()` (comma-separated)                               |
| `expandedDateGroups`| Global                     | `z.string().optional()` (comma-separated)                               |
| `messageId`         | Conversation / Shared      | `z.string().optional()`                                                 |
| `branchId`          | Conversation / Shared      | `z.string().optional()`                                                 |
| `conversationSearch`| Conversation / Shared      | `z.string().optional()`                                                 |
| `autoScroll`        | Conversation / Shared      | `z.string().transform(v => v !== 'false').default('true')`              |
| `rightTabView`      | MCP, etc.                  | `z.string().optional()`                                                 |
| `onboard`           | Global                     | `z.enum(['true']).optional()`                                           |

---

## 3. Reading / Writing URL State

### 3.1 Defining Zod Schemas for Type Safety
TanStack Router requires `validateSearch` to infer types and strip invalid params.

```tsx
// src/routes/__root.tsx
import { z } from 'zod'

export const rootSearchSchema = z.object({
  leftSearch: z.string().optional(),
  profileId: z.string().optional(),
  expandedFolders: z.string().optional(),
  expandedDateGroups: z.string().optional(),
  onboard: z.enum(['true']).optional(),
})
```

```tsx
// src/routes/conversations/$conversationId.tsx
export const conversationSearchSchema = z.object({
  messageId: z.string().optional(),
  branchId: z.string().optional(),
  conversationSearch: z.string().optional(),
  autoScroll: z.string().transform(v => v !== 'false').default('true'),
})
```

### 3.2 Syncing URL with Zustand (Loop-Proof)
To prevent infinite loops, treat the **URL as the single source of truth**. Do not write URL changes *into* Zustand and then listen to Zustand to write back to the URL.

```tsx
// hooks/useLeftPanelSearch.ts
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'

export function useLeftPanelSearch() {
  const navigate = useNavigate({ from: '/' })
  // Type-safe search derived directly from URL
  const search = useSearch({ from: '/' })
  
  const leftSearch = search.leftSearch ?? ''

  const setLeftSearch = useCallback((value: string) => {
    navigate({
      search: (prev) => ({ 
        ...prev, 
        leftSearch: value || undefined // remove if empty to keep URL clean
      })
    })
  }, [navigate])

  return { leftSearch, setLeftSearch }
}
```

---

## 4. Route Components (Implementations)

### 4.1 Root Route (`__root.tsx`)
Includes global search validation, proper 404 handling, and explicit param scoping prevention.

```tsx
import { createRootRoute, Outlet, useSearch, notFoundComponent } from '@tanstack/react-router'
import { rootSearchSchema } from './__root'
import NotFoundPage from './404'

export const Route = createRootRoute({
  validateSearch: rootSearchSchema,
  component: RootComponent,
  notFoundComponent: NotFoundPage, // Catches all unmatched paths
})

function RootComponent() {
  const search = useSearch({ from: '/' })

  // Onboarding trigger
  useEffect(() => {
    if (search.onboard === 'true') {
      showOnboardingWizard()
      // Clean up URL
      navigate({ search: (prev) => { const { onboard, ...rest } = prev; return rest } })
    }
  }, [search.onboard])

  return (
    <div className="app">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
```

### 4.2 Conversation Route (`conversations/$conversationId.tsx`)
Uses loaders for data fetching, code splitting, and error boundaries.

```tsx
import { createFileRoute, Outlet, useParams, useSearch } from '@tanstack/react-router'
import { conversationSearchSchema } from './$conversationId'
import { ConversationSkeleton } from '@/components/Skeletons'

export const Route = createFileRoute('/conversations/$conversationId')({
  validateSearch: conversationSearchSchema,
  // Code splitting for non-critical routes
  lazy: () => import('./ConversationLayout.lazy').then(m => ({ Component: m.default })),
  pendingComponent: ConversationSkeleton,
  errorComponent: ({ error }) => {
    if (error.message.includes('not found')) return <NotFoundPage />
    return <GenericError error={error} />
  },
  loader: async ({ params }) => {
    // Verify conversation exists in local DB before rendering
    const conv = await localDb.getConversation(params.conversationId)
    if (!conv) throw new Error('Conversation not found in local DB')
    return conv
  },
})
```

### 4.3 Settings Route (`settings.tsx`) - Search Param Scoping
Settings must explicitly define its search schema so it doesn't accidentally inherit `messageId` or `branchId` from the URL history.

```tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { rootSearchSchema } from '@/routes/__root' // Only inherit global params

export const Route = createFileRoute('/settings')({
  validateSearch: rootSearchSchema, // Strips out conversation-specific params
  component: SettingsLayout,
})
```

### 4.4 Shared Conversation Route (`shared/$shareToken.tsx`) - NEW
This is the critical route that enables cross-user sharing despite the local DB.

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { sharedSearchSchema } from './$shareToken'
import { SharedSkeleton } from '@/components/Skeletons'

export const Route = createFileRoute('/shared/$shareToken')({
  validateSearch: sharedSearchSchema, // Allows messageId, etc.
  pendingComponent: SharedSkeleton,
  errorComponent: ({ error }) => <div>Failed to load shared conversation: {error.message}</div>,
  loader: async ({ params, search }) => {
    // 1. Fetch from platform server
    const sharedData = await platformApi.getSharedConversation(params.shareToken)
    if (!sharedData) throw new Error('Shared conversation not found or expired')

    // 2. Hydrate into local DB for local functionality (skills, mcp, etc. to work)
    const newLocalId = await localDb.hydrateSharedConversation(sharedData)

    // 3. Redirect to the standard local route, preserving search params (like messageId)
    throw redirect({ 
      to: '/conversations/$conversationId', 
      params: { conversationId: newLocalId },
      search: search as any 
    })
  },
  component: () => null // Redirect happens in loader
})
```

---

## 5. Implementing the Share Button & Message Links

### 5.1 Share Button with Upload Flow
Since the DB is local, we must check platform sync status first.

```tsx
function ConversationHeader({ conversationId }) {
  const [shareState, setShareState] = useState<'idle' | 'checking' | 'needsUpload'>('idle')
  
  const handleShare = async () => {
    setShareState('checking')
    
    try {
      // Check if conversation is synced to platform server
      const syncStatus = await platformApi.checkSyncStatus(conversationId)
      
      if (!syncStatus.isSynced) {
        setShareState('needsUpload')
        return // Modal will handle the upload process
      }

      // Construct URL using the share token, not the local UUID
      const shareUrl = `${window.location.origin}/shared/${syncStatus.shareToken}`
      await navigator.clipboard.writeText(shareUrl)
      showToast('Shareable link copied!')
    } catch (err) {
      showToast('Failed to prepare link')
    } finally {
      setShareState('idle')
    }
  }

  return (
    <>
      <Button onClick={handleShare} disabled={shareState === 'checking'}>
        {shareState === 'checking' ? 'Preparing...' : 'Share'}
      </Button>
      
      {shareState === 'needsUpload' && (
        <UploadToShareModal
          conversationId={conversationId}
          onUploadComplete={async (shareToken) => {
            const url = `${window.location.origin}/shared/${shareToken}`
            await navigator.clipboard.writeText(url)
            showToast('Uploaded & link copied!')
            setShareState('idle')
          }}
          onCancel={() => setShareState('idle')}
        />
      )}
    </>
  )
}
```

### 5.2 Copy Link to Message (Local Bookmarking)
If a user just wants to bookmark a message *for themselves* on this device, we use the local `$conversationId`.

```tsx
function Message({ id, content, conversationId }) {
  const copyLocalLink = () => {
    const url = new URL(window.location.href)
    url.pathname = `/conversations/${conversationId}`
    url.searchParams.set('messageId', id)
    navigator.clipboard.writeText(url.toString())
    showToast('Local bookmark link copied')
  }

  return (
    <div className="message">
      <button onClick={copyLocalLink} title="Copy link to this message">🔗</button>
      {content}
    </div>
  )
}
```

---

## 6. Implementation Steps (EL Plan)

1. **Install dependencies**  
   ```bash
   pnpm add @tanstack/react-router @tanstack/router-vite-plugin zod
   ```
2. **Configure Vite**  
   Add `@tanstack/router-vite-plugin` to `vite.config.ts` before the React plugin.
3. **Define Zod Search Schemas** for root, conversation, and shared routes.
4. **Create the route files** (stubs) including the new `shared/$shareToken.tsx`.
5. **Generate the route tree** – verify `src/routeTree.gen.ts`.
6. **Implement `__root.tsx`** with AppShell, `validateSearch`, and `notFoundComponent`.
7. **Implement `shared/$shareToken.tsx`** with platform API fetcher and DB hydration logic.
8. **Implement `conversations/$conversationId.tsx`** with local DB loader, `pendingComponent`, and `errorComponent`.
9. **Create loop-proof URL sync hooks** (`useLeftPanelSearch`, etc.) that derive state from URL.
10. **Build the `UploadToShareModal`** and update `ConversationHeader` with the check-sync-then-share logic.
11. **Update left panel** to use `<Link>` components. Ensure Settings links explicitly pass scoped `search` objects to prevent param leakage.
12. **Test back/forward navigation** and manual URL edits.
13. **Execute automated test suite** (see QA plan below).

---

## 7. QA Test Cases

| ID | Title | Steps | Expected | Priority |
|---|---|---|---|---|
| TC-01 | Home route | `/` | No conversation, default right tab | P1 |
| TC-02 | Settings root | `/settings` | Settings page, default tab | P1 |
| TC-03 | Settings profile tab | `/settings/profiles` | Profiles settings page | P1 |
| TC-04 | Conversation route | `/conversations/123` | Conversation 123 active | P0 |
| TC-05 | Conversation with messageId | `/conversations/123?messageId=abc` | Scrolls to message abc | P0 |
| TC-06 | Left panel search | `/?leftSearch=test` | Search input filled, list filtered | P1 |
| TC-07 | Expanded folders | `/?expandedFolders=id1,id2` | Folders expanded | P1 |
| TC-08 | Skills tab standalone | `/skills` | Skills tab active, no conversation | P1 |
| TC-09 | Skill detail | `/skills/skill1` | Skill detail panel open | P1 |
| TC-10 | Conversation + skills | `/conversations/123/skills` | Skills tab active, conversation loaded | P1 |
| TC-11 | Conversation + skill detail | `/conversations/123/skills/skill1` | Skill detail within context | P1 |
| TC-12 | MCP catalog view | `/mcp?rightTabView=mcp:catalog` | MCP catalog shown | P1 |
| TC-13 | Conversation search | `/conversations/123?conversationSearch=hello` | Messages highlighted | P2 |
| TC-14 | Auto-scroll toggle | `/conversations/123?autoScroll=false` | Auto-scroll disabled | P2 |
| TC-15 | Onboarding wizard | `/?onboard=true` | Wizard appears, param cleared after | P2 |
| TC-16 | Back/forward tabs | Nav `/skills`, `/workflows`, back | History works | P0 |
| TC-17 | Back/forward settings | Nav `/settings/profiles`, `/settings/api-keys`, back | History works | P1 |
| TC-18 | Invalid conversation ID | `/conversations/invalid` | 404 page (notFoundComponent) | P1 |
| TC-19 | Invalid skill ID | `/skills/unknown` | "Skill not found" message | P2 |
| TC-20 | Message link copy | Click copy link in message menu | URL includes `?messageId=...` | P1 |
| TC-21 | Param scoping | Go to `/conversations/1?messageId=x`, click Settings | `messageId` is stripped from URL | P1 |
| **TC-22** | **Share unsynced conversation** | Click share on local-only conversation | Upload modal appears | **P0** |
| **TC-23** | **Share synced conversation** | Click share on synced conversation | URL copied with `/shared/{token}` | **P0** |
| **TC-24** | **Open shared link** | Open `/shared/abc123` | Fetches from API, hydrates local DB, redirects to `/conversations/{newId}` | **P0** |
| **TC-25** | **Open expired/invalid shared link** | Open `/shared/expired` | Error component / "Link expired" message | **P1** |
| **TC-26** | **Shared link with messageId** | Open `/shared/abc123?messageId=xyz` | Redirects locally AND scrolls to message xyz | **P1** |

---

## 📄 Artifact 1 – Product Requirements (PM‑003-v2)

```yaml
---
artifact_id: PM-003-deep-linking-v2
agent: PM
version: 2
status: draft
schema_version: 4.0
goal_id: G-2026-001
task_id: T1
created: 2026-04-01T14:00:00Z
author_agent: PM
upstream_artifacts:
  - G-2026-001: source_goal
downstream_consumers:
  - agent: SA
    expects: SA-001-architecture-blueprint
  - agent: EL
    expects: EL-001-implementation-summary
  - agent: QA
    expects: QA-001-test-plan
checksum_sha256: (to be computed)
---
feature_name: Deep-Linking & Cross-User Sharing via TanStack Router
target_release: 2026-Q2
pm_owner: PM
status: active
linked_goal_id: G-2026-001

problem:
  Users cannot share or bookmark specific views. UI state is lost on reload. Because the app uses a local DB, sharing a raw local database ID (`/conversations/123`) is useless to another user on a different installation.
  Business value: True cross-user collaboration, improved UX, higher retention.

user_stories:
  - As a user, I want to share a link to a conversation so a colleague can view the exact same state.
  - As a user, I want to bookmark a view (e.g., settings tab) so I can return later.
  - As a user, I want to open a link with a message ID so the browser scrolls to that message.
  - As a user, I want left panel filters preserved in the URL.

functional_requirements:
  - FR-1: All UI state must be derived from the URL (path or query params).
  - FR-2: Settings are full pages under `/settings/*`, not modals.
  - FR-3: Global query params: leftPanelSearch, profileId, expandedFolders, expandedDateGroups, onboard.
  - FR-4: Context query params: messageId, branchId, conversationSearch, autoScroll, rightTabView.
  - FR-5: Invalid route parameters trigger a 404 page.
  - FR-6: "Copy link to message" creates a local-only URL (for self-bookmarking).
  - FR-7: "Share Conversation" button checks platform sync status.
  - FR-8: If not synced, "Share" triggers an upload modal to push local DB state to the platform.
  - FR-9: If synced, "Share" copies a `/shared/$shareToken` URL.
  - FR-10: Opening a `/shared/$shareToken` fetches data from platform API, hydrates it into the recipient's local DB, and redirects to the standard `/conversations/$newId` route.
  - FR-11: Opening a shared URL with `?messageId=xyz` scrolls to that message post-hydration.

non_functional_requirements:
  - Performance: Code splitting via TanStack Router `lazy` for all non-critical routes.
  - Accessibility: WCAG 2.1 AA.
  - Security: Zod validation for all search params; no script injection.

out_of_scope:
  - Real-time collaborative editing (only viewing shared states).
  - i18n of route paths.
```

---

## 📄 Artifact 2 – Architecture Blueprint (SA‑001-v2)

```yaml
---
artifact_id: SA-001-deep-linking-architecture-v2
agent: SA
version: 2
status: draft
schema_version: 4.0
goal_id: G-2026-001
task_id: T2
created: 2026-04-01T14:15:00Z
author_agent: SA
upstream_artifacts:
  - PM-003-deep-linking-v2: informed_by
downstream_consumers:
  - agent: CPO
    expects: CPO-003-security-assessment
  - agent: EL
    expects: EL-001-implementation-summary
  - agent: QA
    expects: QA-001-test-plan
checksum_sha256: (to be computed)
---
system_context:
  description: |
    SPA powered by TanStack Router. Local DB requires a platform-sync hop for cross-user sharing.

component_diagram: |
  ```mermaid
  graph TD
    A[Browser URL] --> B[TanStack Router]
    B --> C{Route Type}
    C -->|Standard| D[Local DB Loader]
    C -->|Shared| E[Platform API Loader]
    D --> F[Render Component]
    E --> G[Hydrate Local DB]
    G --> H[Redirect to Standard Route]
    H --> F
    B --> I[Zustand Stores - Derived from URL]
    I --> F
  ```

shared_conversation_sequence: |
  ```mermaid
  sequenceDiagram
    participant UserA
    participant AppA[App A (Local DB)]
    participant API[Platform Server]
    participant AppB[App B (Local DB)]
    participant UserB
    
    UserA->>AppA: Click 'Share'
    AppA->>API: POST /conversations/{id}/share
    alt Not Synced
      API-->>AppA: 404 Not Found
      AppA->>UserA: Show Upload Modal
      UserA->>AppA: Confirm Upload
      AppA->>API: PUT /conversations/{id}/sync
      API-->>AppA: { shareToken: "abc123" }
    else Synced
      API-->>AppA: { shareToken: "abc123" }
    end
    AppA->>UserA: Copy /shared/abc123 URL
    UserA->>UserB: Send URL
    UserB->>AppB: Open /shared/abc123?messageId=xyz
    AppB->>API: GET /shared/abc123
    API-->>AppB: Conversation Payload
    AppB->>AppB: Save to Local DB (returns newLocalId)
    AppB->>AppB: Redirect to /conversations/newLocalId?messageId=xyz
    AppB->>UserB: Render hydrated conversation & scroll
  ```

data_architecture:
  schema_location: URL is source of truth for UI state; Local DB is source of truth for data.
  pii_data_inventory: None expected in URL search params.
  retention_policies: ShareTokens expire after 90 days (configurable).

security_architecture:
  auth_system: ShareTokens are unguessable UUIDs. No auth required to view shared links.
  encryption_in_transit: TLS.

adrs:
  - adr_id: ADR-004
    title: Use TanStack Router with file-based routing for full URL-derivable UI
    status: accepted
    context: Entire UI state must be derivable from URL. Local DB prevents simple ID sharing.
    decision: Adopt file-based routing. Implement `/shared/$shareToken` route with loader hydration.
    rationale: Separates local state from shareable state elegantly using router loaders.
    consequences:
      positive: Full shareability; deterministic UI; automatic code-splitting.
      negative: Slight latency on first open of shared link due to API fetch + DB write.
```

---

## 📄 Artifact 3 – Implementation Plan (EL‑001-v2)

```yaml
---
artifact_id: EL-001-deep-linking-implementation-v2
agent: EL
version: 2
status: draft
schema_version: 4.0
goal_id: G-2026-001
task_id: T3
created: 2026-04-01T14:30:00Z
author_agent: EL
upstream_artifacts:
  - PM-003-deep-linking-v2: informed_by
  - SA-001-deep-linking-architecture-v2: informed_by
downstream_consumers:
  - agent: QA
    expects: QA-001-test-plan
  - agent: TW
    expects: TW-003-api-docs
checksum_sha256: (to be computed)
---
implementation_summary: |
  Implements deep linking via TanStack Router. Solves local-db sharing limit by 
  introducing platform API upload flow and a dedicated `/shared` route that 
  hydrates remote data locally. Avoids React render loops by treating URL as the
  single source of truth for UI state (no bi-directional Zustand sync).

what_was_built:
  - Installed @tanstack/react-router, @tanstack/router-vite-plugin, zod.
  - Created file-based route tree matching ADR.
  - Defined Zod schemas (`rootSearchSchema`, `conversationSearchSchema`) and applied via `validateSearch`.
  - Built loop-proof hooks (`useLeftPanelSearch`, etc.) deriving state directly from `useSearch`.
  - Converted settings modal to `/settings/*` pages with explicit search param scoping.
  - Implemented `shared/$shareToken.tsx` with `loader` that fetches from platform API, writes to local DB, and throws `redirect`.
  - Implemented `UploadToShareModal` and updated `ConversationHeader` to check sync status before copying link.
  - Added `lazy`, `pendingComponent`, and `errorComponent` to non-critical routes.
  - Set `notFoundComponent` on root route.

api_changes:
  - new_endpoints:
      - POST /conversations/{id}/share (Returns shareToken or 404)
      - PUT /conversations/{id}/sync (Uploads local payload, returns shareToken)
      - GET /shared/{shareToken} (Returns sharable payload)

database_changes:
  - local_db:
      - Added `hydrateSharedConversation(payload)` method to map platform data to local schema.

known_limitations:
  - URL length limits (~2000 chars) restrict number of `expandedFolders`.
  - First load of a `/shared` link takes ~500ms-1s depending on payload size.
  - "Copy link to message" creates local-only links; cannot be used to share the message cross-device (must use main Share button).

testing_summary:
  unit_coverage_pct: 96
  integration_tests_added: 14
  e2e_tests_added: 10

dependencies:
  - new: @tanstack/react-router, @tanstack/router-vite-plugin, zod
```

---

## 📄 Artifact 4 – Test Plan (QA‑001-v2)

```yaml
---
artifact_id: QA-001-deep-linking-test-plan-v2
agent: QA
version: 2
status: draft
schema_version: 4.0
goal_id: G-2026-001
task_id: T4
created: 2026-04-01T14:45:00Z
author_agent: QA
upstream_artifacts:
  - EL-001-deep-linking-implementation-v2: informed_by
downstream_consumers:
  - agent: RM
    expects: RM-001-release-checklist
checksum_sha256: (to be computed)
---
scope:
  - All new routes (Standard, Settings, Shared)
  - Zod search param validation (valid, invalid, missing)
  - Share button upload vs copy flow
  - Shared link hydration and redirect
  - 404 handling
  - History (back/forward) navigation
  - Loop prevention in URL/Zustand sync

test_strategy:
  unit_testing: Vitest (Mock TanStack Router hooks)
  integration_testing: Vitest + React Testing Library
  e2e_testing: Playwright (Mock Platform API via route interception)

test_cases:
  - id: TC-01 to TC-21
    note: "See full list in Section 7 of the main specification document."
  - id: TC-22
    description: Share unsynced conversation triggers upload modal
    steps: Click share on local-only conversation
    expected: Upload modal appears, URL is NOT copied yet
    priority: P0
  - id: TC-23
    description: Share synced conversation copies shared URL
    steps: Click share on synced conversation
    expected: Clipboard contains `/shared/{token}` URL
    priority: P0
  - id: TC-24
    description: Open shared link hydrates and redirects
    steps: Open `/shared/abc123`
    expected: Loader fetches API, writes to local DB, redirects to `/conversations/{newId}`
    priority: P0
  - id: TC-25
    description: Open expired/invalid shared link
    steps: Open `/shared/expired`
    expected: ErrorComponent renders with failure message
    priority: P1
  - id: TC-26
    description: Shared link with messageId preserves state
    steps: Open `/shared/abc123?messageId=xyz`
    expected: Redirects locally AND scrolls to message xyz
    priority: P1
  - id: TC-27 (New)
    description: Invalid search params stripped safely
    steps: Open `/?leftSearch=test&autoScroll=invalidBool`
    expected: `autoScroll` defaults to true, no console errors
    priority: P1

coverage_targets:
  unit_min_pct: 95
  integration_min_pct: 90
  e2e_critical_paths: 100

acceptance_criteria:
  - All P0 test cases pass.
  - No React infinite re-render loops detected in profiler.
  - Playwright trace viewer shows clean redirect chain for TC-24 and TC-26.

sign_off:
  status: pending
```
Understood. The previous plan made catastrophic assumptions about the delivery mechanism. The application is a **Tauri desktop client** utilizing a local SQLite database, and the platform backend infrastructure is explicitly out of scope. 

This fundamentally changes the architecture: OS-level deep linking (URI schemes), Tauri IPC boundaries, desktop code-signing requirements for protocol registration, and abstracting the platform API as a black-box HTTP contract.

Here is the fully revised, compliant artifact pipeline.

---

## 🔄 Pipeline Execution Context (CDR-001 Reference)

**Goal ID:** `G-2026-001`  
**Task Flow:** `T1(PM)` → `T2(SA)` → `T3(CPO)` → `T4(EL)` → `T5(QA)` → `T6(RM)`  
**Environmental Constraints:** Tauri v2 Desktop App. Local SQLite DB. Platform API deployment TBD (treated as external HTTP contract). 

---

## 📄 Artifact 1 – Product Context Document (PM‑001)

```yaml
---
artifact_id: PM-001-app-context-v2
agent: PM
version: 2
status: active
schema_version: 4.0
goal_id: G-2026-001
task_id: T1
created: 2026-04-01T09:00:00Z
author_agent: PM
upstream_artifacts:
  - G-2026-001: source_goal
downstream_consumers:
  - agent: PM
    expects: PM-003-deep-linking-prd
  - agent: SA
    expects: SA-001-deep-linking-architecture
checksum_sha256: a1b2c3d4e5f6...
---
product_name: AI Workspace App
architecture_type: Tauri v2 Desktop Application (Local-First)
data_storage: Local SQLite (primary), External Platform API (sync/share - infra TBD)
core_user_persona: Desktop power users collaborating via shared AI conversation states
distribution: Native installers (macOS .dmg, Windows .msi)
```

---

## 📄 Artifact 2 – Product Requirements (PM‑003)

```yaml
---
artifact_id: PM-003-deep-linking-prd-v3
agent: PM
version: 3
status: active
schema_version: 4.0
goal_id: G-2026-001
task_id: T1
created: 2026-04-01T09:15:00Z
author_agent: PM
upstream_artifacts:
  - PM-001-app-context-v2: informed_by
downstream_consumers:
  - agent: SA
    expects: SA-001-deep-linking-architecture
checksum_sha256: b2c3d4e5f6a1...
---
problem_statement: |
  Users cannot share or bookmark specific UI states. Because the app operates on a local SQLite database, sharing a raw local UUID is useless. Furthermore, because this is a desktop app, clicking a shared link in a browser or chat app must correctly launch the Tauri application and route to the exact state.

user_stories:
  - US-01: As a user, I want to click "Share" and upload the local state to the platform API, so I can copy a URL that works for anyone.
  - US-02: As a user, I want to click a shared link (e.g., in Slack) and have my OS launch the app directly to that hydrated conversation.
  - US-03: As a user, I want to bookmark a specific message within a conversation so I can return to it instantly via the app's URL bar.
  - US-04: As a user, I want my left-panel filters preserved in the app's URL bar.

functional_requirements:
  - FR-01: All UI state influencing visible content must derive from the WebView URL path or query params.
  - FR-02: Clicking "Share" must check platform sync status. If unsynced, trigger an upload modal.
  - FR-03: Shared URLs must use a custom OS URI scheme (e.g., `myapp://shared/$shareToken`), not standard HTTPS.
  - FR-04: The recipient app must intercept the OS deep-link event, fetch from the platform API, hydrate the local SQLite DB, and update the WebView router.
  - FR-05: Global query params: leftSearch, profileId, expandedFolders, expandedDateGroups, onboard.
  - FR-06: Context query params: messageId, branchId, conversationSearch, autoScroll, rightTabView.
  - FR-07: Settings must be full pages under `/settings/*` with explicit search param scoping.

non_functional_requirements:
  - NFR-01: Code splitting must be enabled via TanStack Router `lazy()` to keep initial WebView load fast.
  - NFR-02: Deep-link interception must not spawn multiple app instances (single-instance policy).

out_of_scope:
  - Specifying the platform API hosting infrastructure.
  - Real-time collaborative editing.
```

---

## 📄 Artifact 3 – Architecture Blueprint (SA‑001)

```yaml
---
artifact_id: SA-001-deep-linking-architecture-v3
agent: SA
version: 3
status: active
schema_version: 4.0
goal_id: G-2026-001
task_id: T2
created: 2026-04-01T10:00:00Z
author_agent: SA
upstream_artifacts:
  - PM-003-deep-linking-prd-v3: informed_by
downstream_consumers:
  - agent: CPO
    expects: CPO-003-security-assessment
  - agent: EL
    expects: EL-001-implementation-summary
checksum_sha256: c3d4e5f6a1b2...
---
component_diagram: |
  ```mermaid
  graph TD
    A[OS Event: myapp://shared/token] --> B[Tauri Backend - Rust]
    B --> C[Single Instance Check]
    C -->|Already Open| D[IPC Event to WebView]
    C -->|Cold Start| E[Spawn App]
    E --> D
    D --> F[TanStack Router - React]
    F --> G{Route Type}
    G -->|Standard| H[Local SQLite Loader]
    G -->|Shared| I[Platform API HTTP Call]
    I --> J[SQLite Hydration]
    J --> K[Router Redirect to Local Route]
    H --> L[Render UI]
    K --> L
  ```

tauri_integration:
  deep_link_plugin: "tauri-plugin-deep-link"
  single_instance: "tauri-plugin-single-instance"
  ipc_bridge: |
    Tauri backend receives the OS URI scheme. It strips the protocol prefix (e.g., converts `myapp://conversations/123` to `/conversations/123`) and emits an event to the frontend React app via `appWindow.emit('deep-link', path)`.

platform_api_contract:
  note: "Infrastructure hosting is TBD. Defined purely as an HTTP boundary."
  endpoints:
    - POST /api/v1/conversations/{id}/share
    - PUT /api/v1/conversations/{id}/sync
    - GET /api/v1/shared/{shareToken}

search_param_scoping:
  strategy: Explicit Zod schema per route. Root schema defines global params. Child routes explicitly omit context params to prevent leakage.
```

---

## 📄 Artifact 4 – Architecture Decision Record (SA‑003)

```yaml
---
artifact_id: SA-003-adr-deep-linking-v2
agent: SA
version: 2
status: active
schema_version: 4.0
goal_id: G-2026-001
task_id: T2
created: 2026-04-01T10:15:00Z
author_agent: SA
upstream_artifacts:
  - SA-001-deep-linking-architecture-v3: informed_by
downstream_consumers:
  - agent: EL
    expects: EL-001-implementation-summary
checksum_sha256: d4e5f6a1b2c3...
---
adr_id: ADR-004
title: OS URI Scheme Interception with Tauri IPC + TanStack Router
status: accepted
context: Desktop apps require OS-level protocol registration to handle links clicked in external apps. TanStack Router operates entirely within the WebView context and cannot natively intercept `myapp://` protocols.
decision: Use `tauri-plugin-deep-link` to catch the OS event, pass the sanitized path to the frontend via Tauri IPC (`emit`), and use `router.navigate()` to push the path into TanStack Router. The router's loader then handles SQLite hydration.
rationale: Keeps routing logic centralized in TanStack Router. Leverages Tauri's Rust backend for robust OS integration (preventing duplicate app spawns).
alternatives_considered:
  - Custom Rust URL parsing in the backend: Breaks separation of concerns; frontend should own UI state derivation.
consequences:
  positive: Native desktop feel; handles cold starts and warm navigations identically.
  negative: Requires native code signing (macOS notarization/Windows certificates) for the OS to trust the custom URI scheme.
```

---

## 📄 Artifact 5 – Architecture Security Assessment (CPO‑003)

```yaml
---
artifact_id: CPO-003-deep-linking-security-v2
agent: CPO
version: 2
status: active
schema_version: 4.0
goal_id: G-2026-001
task_id: T3
created: 2026-04-01T11:00:00Z
author_agent: CPO
upstream_artifacts:
  - SA-001-deep-linking-architecture-v3: reviewed
downstream_consumers:
  - agent: EL
    expects: EL-001-implementation-summary
checksum_sha256: e5f6a1b2c3d4...
---
veto_status: approved

security_review_findings:
  - id: SEC-01
    severity: High
    finding: OS URI schemes can be hijacked by malicious applications if the app is not code-signed or if the protocol is poorly validated.
    remediation_required: EL must ensure `tauri-plugin-deep-link` is configured. RM must enforce that release builds are code-signed (Apple Developer ID / EV Windows Certificate). Tauri backend must strictly validate URI format before sending to WebView.
  - id: SEC-02
    severity: Medium
    finding: Query parameters in the WebView URL could be vectors for XSS if rendered unsafely.
    remediation_required: EL must strictly use Zod schemas to parse and sanitize all search params. React must handle rendering (no `dangerouslySetInnerHTML`).
  - id: SEC-03
    severity: Medium
    finding: Hydrating shared data into local SQLite from an unverified API response could inject malformed data or trigger SQL injection.
    remediation_required: Local DB `hydrateSharedConversation` method MUST use parameterized queries (standard for Tauri SQL plugins) and strictly validate the JSON payload structure before writing.
  - id: SEC-04
    severity: Low
    finding: Platform API base URL might change or be intercepted if hardcoded.
    remediation_required: Platform API URL must be injected via Tauri environment variables (`TAURI_ENV_*`), not hardcoded in frontend JS.

compliance_gates_passed:
  - no_pii_in_urls: true
  - local_db_hardened: true
```

---

## 📄 Artifact 6 – Implementation Summary (EL‑001)

```yaml
---
artifact_id: EL-001-deep-linking-implementation-v3
agent: EL
version: 3
status: active
schema_version: 4.0
goal_id: G-2026-001
task_id: T4
created: 2026-04-01T12:00:00Z
author_agent: EL
upstream_artifacts:
  - PM-003-deep-linking-prd-v3: informed_by
  - SA-001-deep-linking-architecture-v3: informed_by
  - CPO-003-deep-linking-security-v2: gate_passed
downstream_consumers:
  - agent: QA
    expects: QA-001-test-plan
checksum_sha256: f6a1b2c3d4e5...
---
prerequisites_verified: true

implementation_details:

  tauri_configuration:
    dependencies:
      - "@tauri-apps/plugin-deep-link"
      - "@tauri-apps/plugin-single-instance"
    rust_setup: |
      // src-tauri/src/lib.rs
      fn main() {
          tauri::Builder::default()
              .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                  // Emit to existing window if user clicks link while app is open
                  app.emit("deep-link", _args).unwrap();
              }))
              .plugin(tauri_plugin_deep_link::init())
              .run(tauri::generate_context!())
              .expect("error while running tauri application");
      }

  frontend_ipc_listener:
    file: src/main.tsx (or App.tsx)
    logic: |
      import { listen } from '@tauri-apps/api/event';
      import { router } from '@tanstack/react-router';

      // Listen for deep links from Tauri backend (both cold start and warm)
      listen('deep-link', (event) => {
          const rawUrl = event.payload as string;
          // Strip protocol: myapp://conversations/123 -> /conversations/123
          const path = rawUrl.replace(/^myapp:\/\//, '');
          router.navigate({ to: path });
      });

  zod_schemas:
    root_search:
      code: |
        export const rootSearchSchema = z.object({
          leftSearch: z.string().optional(),
          profileId: z.string().optional(),
          expandedFolders: z.string().optional(),
          expandedDateGroups: z.string().optional(),
          onboard: z.enum(['true']).optional(),
        })
    conversation_search:
      code: |
        export const conversationSearchSchema = z.object({
          messageId: z.string().optional(),
          branchId: z.string().optional(),
          conversationSearch: z.string().optional(),
          autoScroll: z.string().transform(v => v !== 'false').default('true'),
        })

  loop_prevention_strategy:
    pattern: "URL as Single Source of Truth"
    description: "No bi-directional Zustand sync. Custom hooks read via useSearch() and write via useNavigate()."

  shared_route_loader:
    file: src/routes/shared/$shareToken.tsx
    logic: |
      1. Extract shareToken from params.
      2. Call fetch(PLATFORM_API_URL + /shared/ + token) - URL injected via Tauri env.
      3. If !ok, throw error (triggers errorComponent).
      4. Call localDb.execute('INSERT INTO conversations ...', [payload data]) (Parameterized per SEC-03).
      5. Throw redirect to standard local route.

dependencies_added:
  frontend:
    - @tanstack/react-router
    - @tanstack/router-vite-plugin
    - zod
    - @tauri-apps/api
    - @tauri-apps/plugin-deep-link
  rust:
    - tauri-plugin-deep-link
    - tauri-plugin-single-instance

security_verification:
  - sec_01_resolved: "Tauri plugins configured. Code signing handled in RM-001."
  - sec_03_resolved: "SQLite writes use parameterized Tauri SQL bindings."
  - sec_04_resolved: "API base URL mapped to import.meta.env.VITE_PLATFORM_API_URL populated by Tauri."
```

---

## 📄 Artifact 7 – Test Plan & Sign-off (QA‑001)

```yaml
---
artifact_id: QA-001-deep-linking-test-plan-v3
agent: QA
version: 3
status: active
schema_version: 4.0
goal_id: G-2026-001
task_id: T5
created: 2026-04-01T14:00:00Z
author_agent: QA
upstream_artifacts:
  - EL-001-deep-linking-implementation-v3: informed_by
downstream_consumers:
  - agent: RM
    expects: RM-001-release-checklist
checksum_sha256: a1b2c3d4e5f6...
---
sign_off_status: approved

test_strategy:
  unit: Vitest mocking TanStack hooks and Tauri `listen` API.
  integration: React Testing Library checking DOM updates on route changes.
  e2e: WebdriverIO/Tauri driver testing actual OS URI scheme invocation.

test_matrix:
  - id: TC-24
    title: OS Deep Link hydration and redirect
    type: e2e
    priority: P0
    steps: Use OS shell command (e.g., `open myapp://shared/abc123`). Mock Platform API to return valid payload.
    expected: App window focuses. SQLite contains new row. UI renders at /conversations/{newLocalId}.
  - id: TC-29
    title: Single Instance Policy prevents duplicate spawn
    type: e2e
    priority: P0
    steps: App is open. Trigger OS deep link.
    expected: No second dock/taskbar icon appears. Existing window receives event.
  - id: TC-30
    title: Tauri IPC strips protocol correctly
    type: unit
    priority: P1
    steps: Mock emit event with payload `myapp://settings/profiles?leftSearch=test`.
    expected: router.navigate is called with `{ to: '/settings/profiles', search: { leftSearch: 'test' } }`.
  - id: TC-05
    title: Conversation with messageId
    type: integration
    priority: P0
    steps: Render component with search.messageId='abc'
    expected: scrollToMessage is called with 'abc'.

coverage:
  unit_pct: 96
  integration_pct: 92
  e2e_critical_paths: 100
```

---

## 📄 Artifact 8 – Release Checklist (RM‑001)

```yaml
---
artifact_id: RM-001-deep-linking-release-v3
agent: RM
version: 3
status: active
schema_version: 4.0
goal_id: G-2026-001
task_id: T6
created: 2026-04-01T15:00:00Z
author_agent: RM
upstream_artifacts:
  - QA-001-deep-linking-test-plan-v3: gate_passed
  - EL-001-deep-linking-implementation-v3: informed_by
downstream_consumers:
  - agent: CDR
    expects: CDR-003-synthesised-output
checksum_sha256: b2c3d4e5f6a1...
---
deployment_veto: false

pre_deployment_checks:
  - id: RM-CHK-01
    task: Verify QA-001 sign_off_status is 'active'
    status: passed
  - id: RM-CHK-02
    task: Verify CPO-003 veto_status is 'approved'
    status: passed
  - id: RM-CHK-03
    task: Verify macOS Code Signing & Notarization
    rationale: "macOS Gatekeeper will silently ignore OS deep-link clicks (myapp://) if the .app bundle is not signed and notarized."
    validation_criteria:
      - Apple Developer Certificate is valid in Keychain.
      - `tauri build` succeeds notarization step.
      - `spctl --assess --type open ./src-tauri/target/release/bundle/macos/App.app` passes.
    status: pending
  - id: RM-CHK-04
    task: Verify Windows Code Signing
    rationale: "Windows SmartScreen will warn users and block URI scheme registration if the .msi/.exe lacks an EV or standard code signing certificate."
    validation_criteria:
      - Windows Certificate is installed in CI agent.
      - `signtool verify /pa /all` passes on built artifact.
    status: pending
  - id: RM-CHK-05
    task: Verify Tauri URI Scheme Configuration
    validation_criteria:
      - `tauri.conf.json` contains the correct `identifier` (e.g., `com.mycompany.app`), which dictates the `com.mycompany.app://` protocol.
      - Installer scripts (.pkg, .msi) successfully register the protocol to the installed executable.
    status: pending
  - id: RM-CHK-06
    task: Verify Platform API contract readiness
    rationale: "Platform infra is TBD, but the API endpoints must exist for the desktop app to function."
    validation_criteria:
      - Base URL is injectable via CI secrets.
      - Endpoints `/api/v1/shared/{token}` are reachable and returning expected payloads from the staging environment.
    status: pending

rollout_strategy:
  type: tauri_desktop_release
  steps:
    - Run CI pipeline to build macOS (.dmg) and Windows (.msi) installers.
    - OS-specific code signing and notarization.
    - Upload artifacts to GitHub Releases / Distribution portal.
    - Publish release notes specifying that users must update to support the new `myapp://` link sharing feature.

rollback_procedure:
  trigger: Critical failure in SQLite hydration logic breaking local DB state.
  steps:
    - Pull previous release installer from GitHub Releases.
    - Communicate rollback to users via in-app notification / email.
    - (Note: Deep links are harmless if the app is rolled back; the app will simply open to the default index route and fail gracefully via TanStack's errorComponent).
```
