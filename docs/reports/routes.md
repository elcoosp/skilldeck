# Deep-Linking Implementation Plan (Final Consolidated)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full deep-linking with OS URI scheme (`skilldeck://`) and TanStack Router, making all UI state derivable from the URL. Replace Zustand stores for URL-persisted state with router search params.

**Architecture:** Tauri v2 deep-link plugin (with single-instance integration for desktop) intercepts OS custom protocol events. Frontend uses `onOpenUrl`/`getCurrent` from `@tauri-apps/plugin-deep-link` to receive URLs and navigate TanStack Router. File-based routing with Zod search param validation, loaders for data fetching. Shared conversation fetch/sync goes through the existing Rust `PlatformClient` and existing data models/repos — **no JavaScript HTTP client, no raw SQL**. Zustand stores for URL-persisted state are removed; components read from `useSearch()`.

**Tech Stack:** TanStack Router v1, Zod, Tauri v2, `@tauri-apps/plugin-deep-link`, `@tauri-apps/plugin-single-instance` (with `deep-link` feature), existing `PlatformClient` (Rust), existing DB models/repos (Rust), SQLite (existing), specta/ts-rs (existing).

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

- [ ] **Step 2: Run installation command**

```bash
pnpm install
```

### Task 2: Install and configure Tauri deep-link plugins

> **CRITICAL:** Per Tauri docs, on desktop the single-instance plugin **must** have the `deep-link` feature enabled, **must** be registered as the **first** plugin, and deep-link config goes under `plugins.deep-link` — NOT under `app.protocols`.

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 3: Add Tauri plugins to Cargo.toml with `deep-link` feature on single-instance**

```toml
[target."cfg(any(target_os = \"macos\", windows, target_os = \"linux\"))".dependencies]
tauri-plugin-single-instance = { version = "2", features = ["deep-link"] }

[dependencies]
tauri-plugin-deep-link = "2"
```

- [ ] **Step 4: Register plugins in lib.rs — single-instance FIRST, then deep-link, with dev-time `register_all()`**

> **Read `src-tauri/src/lib.rs` first** to understand the existing builder chain, state setup, and plugin registration order. Insert the new plugins without breaking existing ones.

```rust
// src-tauri/src/lib.rs — add at top:
use tauri_plugin_deep_link::DeepLinkExt;

// Inside run():
// MUST be the first plugin registered (insert before any existing .plugin() calls)
#[cfg(desktop)]
{
    builder = builder.plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
        // The deep-link event is already triggered by the plugin integration.
        // This callback is informational only — do NOT manually parse argv or emit events.
        println!("new instance opened with {argv:?}, deep-link event already handled");
    }));
}

// Register deep-link plugin after single-instance
builder = builder.plugin(tauri_plugin_deep_link::init());

// Inside the existing .setup() closure, add:
#[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
{
    app.deep_link().register_all()?;
}
```

- [ ] **Step 5: Configure URI scheme in tauri.conf.json under `plugins.deep-link`**

> **NOT** under `app.protocols` — Tauri v2 deep-link plugin uses its own config section. **Read existing `tauri.conf.json` first** and merge into the existing `plugins` object.

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

> **Read `src-tauri/capabilities/default.json` first** and add to the existing permissions array.

```json
{
  "permissions": [
    "core:event:default",
    "deep-link:default"
  ]
}
```

- [ ] **Step 7: Run cargo check to verify**

```bash
cd src-tauri && cargo check
```

---

## Chunk 2: Vite & Router Setup

### Task 3: Configure Vite with TanStack Router plugin

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 8: Update vite.config.ts**

> **Read existing `vite.config.ts` first.** Preserve all existing plugins, aliases, and config. Only add `TanStackRouterVite()` to the plugins array (before `react()`).

```typescript
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

// In plugins array, add TanStackRouterVite() as the first entry:
plugins: [TanStackRouterVite(), /* ...existing plugins... */]
```

- [ ] **Step 9: Create router instance**

**Files:**
- Create: `src/router.ts`

```typescript
// src/router.ts
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

- [ ] **Step 10: Update main.tsx to use RouterProvider and set up deep-link listeners**

**Files:**
- Modify: `src/main.tsx`

> **Read existing `main.tsx` first.** Replace the current root render with `RouterProvider`. Add deep-link listeners using the correct Tauri API (`getCurrent` + `onOpenUrl` — NOT `listen('deep-link', ...)`). Both return/handle **arrays** of URLs.

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { router } from './router'
// ...keep any existing imports (App.css, etc.)

function handleDeepLinkUrls(urls: string[]) {
  for (const url of urls) {
    try {
      const parsed = new URL(url)
      const pathWithSearch = parsed.pathname + parsed.search
      if (pathWithSearch && pathWithSearch !== '/') {
        router.navigate({ to: pathWithSearch })
        return // Handle first valid URL only
      }
    } catch {
      // Malformed URL, skip
    }
  }
}

// Handle cold-start deep link (app launched via skilldeck://...)
getCurrent().then((urls) => {
  if (urls && urls.length > 0) {
    handleDeepLinkUrls(urls)
  }
})

// Handle runtime deep links (app already running, new skilldeck://... triggered)
onOpenUrl((urls) => {
  handleDeepLinkUrls(urls)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
```

- [ ] **Step 11: Generate initial route tree**

```bash
pnpm exec vite --force
# This generates src/routeTree.gen.ts
```

---

## Chunk 3: Route Files Creation

### Task 4: Create root route with Zod validation

**Files:**
- Create: `src/routes/__root.tsx`

- [ ] **Step 12: Define root route with search schema**

> Export `Route` so nested routes/components can use `Route.useSearch()` to access root search params. **Read existing `src/components/layout/app-shell.tsx` first** to understand the current root render structure.

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { useEffect } from 'react'
import AppShell from '@/components/layout/app-shell'

export const rootSearchSchema = z.object({
  leftSearch: z.string().optional(),
  profileId: z.string().optional(),
  expandedFolders: z.string().optional(),
  expandedDateGroups: z.string().optional(),
  onboard: z.enum(['true']).optional(),
})

export type RootSearch = z.infer<typeof rootSearchSchema>

export const Route = createRootRoute({
  validateSearch: rootSearchSchema,
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  useEffect(() => {
    if (search.onboard === 'true') {
      window.dispatchEvent(new CustomEvent('skilldeck:show-onboarding'))
      const { onboard, ...rest } = search
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void navigate({ search: rest as RootSearch })
    }
  }, [search.onboard, navigate])

  return <AppShell />
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

### Task 5: Create conversation route

**Files:**
- Create: `src/routes/conversations.$conversationId.tsx`

> Note: TanStack Router file-based routing uses `.` for path segments. The file is `conversations.$conversationId.tsx`, NOT `conversations/$conversationId.tsx`.

- [ ] **Step 13: Define conversation route with loader and search schema**

> **Read `src/store/conversation.ts` first** to find the actual store method names (`setActiveConversation`, `setScrollToMessageId`, etc.) and verify they exist. **Read `src/lib/bindings.ts` (or equivalent) first** to find the actual Tauri command name for fetching a conversation.

```tsx
// src/routes/conversations.$conversationId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CenterPanel } from '@/components/layout/center-panel'
import { useConversationStore } from '@/store/conversation'
import { useEffect } from 'react'
import { commands } from '@/lib/bindings'

export const conversationSearchSchema = z.object({
  messageId: z.string().optional(),
  branchId: z.string().optional(),
  conversationSearch: z.string().optional(),
  autoScroll: z.string().transform(v => v !== 'false').optional(),
})

export const Route = createFileRoute('/conversations/$conversationId')({
  validateSearch: conversationSearchSchema,
  loader: async ({ params }) => {
    // VERIFY: use the actual command name from your bindings
    const res = await commands.getConversation(params.conversationId)
    if (res.status === 'error') {
      throw new Error(res.error)
    }
    return res.data
  },
  pendingComponent: () => <div className="p-4">Loading conversation...</div>,
  errorComponent: ({ error }) => (
    <div className="p-4 text-destructive">Error: {error.message}</div>
  ),
  component: ConversationLayout,
})

function ConversationLayout() {
  const { conversationId } = Route.useParams()
  const { messageId } = Route.useSearch()
  // VERIFY: use actual method names from your conversation store
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation)
  const setScrollToMessageId = useConversationStore((s) => s.setScrollToMessageId)

  useEffect(() => {
    setActiveConversation(conversationId)
    if (messageId) {
      setScrollToMessageId(messageId)
    }
  }, [conversationId, messageId, setActiveConversation, setScrollToMessageId])

  return <CenterPanel />
}
```

### Task 6: Create settings routes

**Files:**
- Create: `src/routes/settings.tsx`
- Create: `src/routes/settings.profiles.tsx`
- Create: `src/routes/settings.api-keys.tsx`
- Create: `src/routes/settings.tool-approvals.tsx`
- Create: `src/routes/settings.appearance.tsx`
- Create: `src/routes/settings.preferences.tsx`
- Create: `src/routes/settings.platform.tsx`
- Create: `src/routes/settings.referral.tsx`
- Create: `src/routes/settings.lint.tsx`
- Create: `src/routes/settings.sources.tsx`
- Create: `src/routes/settings.achievements.tsx`

- [ ] **Step 14: Create settings layout route**

> Child routes inherit root search params automatically — no need to re-declare `validateSearch`.

```tsx
// src/routes/settings.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <div className="container max-w-2xl mx-auto py-8">
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 15: Create settings child routes**

> **CRITICAL: Before creating each route file, read the corresponding component file in `src/components/settings/` to verify the file exists and the exported component name matches what you import.**

```bash
# List existing settings components to verify names:
ls src/components/settings/
```

```tsx
// src/routes/settings.profiles.tsx — pattern for each:
import { createFileRoute } from '@tanstack/react-router'
import { ProfilesTab } from '@/components/settings/profiles-tab'  // VERIFY export name

export const Route = createFileRoute('/settings/profiles')({
  component: ProfilesTab,
})
```

Repeat for each settings tab (`api-keys`, `tool-approvals`, `appearance`, `preferences`, `platform`, `referral`, `lint`, `sources`, `achievements`). If a component doesn't exist yet, use a placeholder:

```tsx
export const Route = createFileRoute('/settings/achievements')({
  component: () => <div className="p-8">Achievements — coming soon</div>,
})
```

### Task 7: Create shared route for platform hydration

**Files:**
- Create: `src/routes/shared.$shareToken.tsx`

- [ ] **Step 16: Implement shared route — calls Tauri commands, NOT a JS HTTP client**

```tsx
// src/routes/shared.$shareToken.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { commands } from '@/lib/bindings'

export const Route = createFileRoute('/shared/$shareToken')({
  loader: async ({ params }) => {
    // Step 1: Fetch shared conversation via Tauri command (calls PlatformClient internally)
    const fetchRes = await commands.getSharedConversation(params.shareToken)
    if (fetchRes.status === 'error') {
      throw new Error(fetchRes.error)
    }

    // Step 2: Hydrate into local SQLite via Tauri command using existing models/repos
    const hydrateRes = await commands.hydrateSharedConversation(fetchRes.data)
    if (hydrateRes.status === 'error') {
      throw new Error(hydrateRes.error)
    }

    // Step 3: Redirect to local conversation route
    throw redirect({
      to: '/conversations/$conversationId',
      params: { conversationId: hydrateRes.data.localId },
    })
  },
  component: () => <div className="p-4">Loading shared conversation...</div>,
})
```

### Task 8: Create standalone routes

**Files:**
- Create: `src/routes/skills.tsx`
- Create: `src/routes/mcp.tsx`
- Create: `src/routes/workflows.tsx`
- Create: `src/routes/analytics.tsx`
- Create: `src/routes/artifacts.tsx`
- Create: `src/routes/index.tsx`

- [ ] **Step 17: Create standalone routes using existing components**

> **CRITICAL: Read each component file first** to verify it exists and the export name is correct.

```bash
# Verify components exist:
ls src/components/skills/
```

```tsx
// src/routes/skills.tsx
import { createFileRoute } from '@tanstack/react-router'
import { UnifiedSkillList } from '@/components/skills/unified-skill-list'  // VERIFY

export const Route = createFileRoute('/skills')({
  component: UnifiedSkillList,
})
```

Repeat for each (`mcp`, `workflows`, `analytics`, `artifacts`). Use placeholder pattern for missing components:

```tsx
export const Route = createFileRoute('/mcp')({
  component: () => <div className="p-8">MCP — coming soon</div>,
})
```

- [ ] **Step 18: Create index route (home)**

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <div className="p-8 text-center">Select a conversation or start a new chat</div>,
})
```

---

## Chunk 4: Rust Backend — Shared Conversation Support

> **This chunk adds the shared conversation endpoints to the existing `PlatformClient` and exposes them as Tauri commands.** No JavaScript HTTP client is created. No raw SQL is used.

### Task 9: Add shared conversation DTOs to PlatformClient

**Files:**
- Modify: `src-tauri/src/platform.rs` (or wherever `PlatformClient` lives — **find it first**)

- [ ] **Step 19: Locate the PlatformClient file**

```bash
grep -rn "pub struct PlatformClient" src-tauri/src/ --include="*.rs"
```

- [ ] **Step 20: Add DTOs for shared conversations**

> Add these near the existing DTOs section (after `SyncSkillsResponse`, before `impl PlatformClient`).

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
- Modify: the file containing `impl PlatformClient`

- [ ] **Step 21: Add `get_shared_conversation` (public/auth-free endpoint)**

> Add in the "Auth-free endpoints" section, after `validate_referral_code`.

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

- [ ] **Step 22: Add `check_sync_status` (authed endpoint)**

> Add in a new "Shared Conversations (authed)" section after the Skills section.

```rust
// ── Shared Conversations (authed) ────────────────────────────────────────────

/// Check if a local conversation has been synced to the platform.
pub async fn check_sync_status(
    &self,
    conversation_id: &str,
    cancel: Option<CancellationToken>,
) -> Result<SyncStatusResponse, PlatformError> {
    self.check_enabled()?;
    let auth = self.auth_header()?;
    let url = format!(
        "{}/api/conversations/{}/sync-status",
        self.base_url, conversation_id
    );
    let fut = || async {
        let resp = self
            .http
            .get(&url)
            .header("Authorization", &auth)
            .send()
            .await?;
        Self::check_response(resp).await
    };
    self.retry(fut, cancel).await
}
```

- [ ] **Step 23: Add `share_conversation` (authed endpoint)**

```rust
/// Create a shareable link for a conversation that is already synced.
pub async fn share_conversation(
    &self,
    conversation_id: &str,
    cancel: Option<CancellationToken>,
) -> Result<ShareResponse, PlatformError> {
    self.check_enabled()?;
    let auth = self.auth_header()?;
    let url = format!(
        "{}/api/conversations/{}/share",
        self.base_url, conversation_id
    );
    let fut = || async {
        let resp = self
            .http
            .post(&url)
            .header("Authorization", &auth)
            .send()
            .await?;
        Self::check_response(resp).await
    };
    self.retry(fut, cancel).await
}
```

- [ ] **Step 24: Add `sync_conversation_to_platform` (authed endpoint)**

```rust
/// Sync a local conversation to the platform, returning a share token.
pub async fn sync_conversation_to_platform(
    &self,
    conversation_id: &str,
    payload: SyncConversationRequest,
    cancel: Option<CancellationToken>,
) -> Result<SyncConversationResponse, PlatformError> {
    self.check_enabled()?;
    let auth = self.auth_header()?;
    let url = format!(
        "{}/api/conversations/{}/sync",
        self.base_url, conversation_id
    );
    let fut = || async {
        let resp = self
            .http
            .put(&url)
            .header("Authorization", &auth)
            .json(&payload)
            .send()
            .await?;
        Self::check_response(resp).await
    };
    self.retry(fut, cancel).await
}
```

- [ ] **Step 25: Run cargo check**

```bash
cd src-tauri && cargo check
```

### Task 11: Add Tauri commands for shared conversations

**Files:**
- Modify: the file containing existing Tauri command definitions (**find it first**)

- [ ] **Step 26: Locate the commands file and existing models**

```bash
# Find where commands are defined
grep -rn "#[tauri::command]" src-tauri/src/ --include="*.rs" -l

# Find conversation model definitions
grep -rn "struct Conversation" src-tauri/src/ --include="*.rs" -l

# Find message model definitions
grep -rn "struct Message" src-tauri/src/ --include="*.rs" -l

# Find how conversations/messages are created (NO raw SQL)
grep -rn "create_conversation\|insert_conversation\|save_conversation\|new_conversation\|import_conversation" src-tauri/src/ --include="*.rs" -l
```

- [ ] **Step 27: Add `get_shared_conversation` command**

> **Read the existing commands first** to understand the pattern: how they access state, return errors, etc.

```rust
#[tauri::command]
#[specta::specta]
pub async fn get_shared_conversation(
    platform: tauri::State<'_, PlatformClient>,
    share_token: String,
) -> Result<SharedConversationPayload, String> {
    platform
        .get_shared_conversation(&share_token, None)
        .await
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 28: Add `check_sync_status` command**

```rust
#[tauri::command]
#[specta::specta]
pub async fn check_sync_status(
    platform: tauri::State<'_, PlatformClient>,
    conversation_id: String,
) -> Result<SyncStatusResponse, String> {
    platform
        .check_sync_status(&conversation_id, None)
        .await
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 29: Add `share_conversation` command**

```rust
#[tauri::command]
#[specta::specta]
pub async fn share_conversation(
    platform: tauri::State<'_, PlatformClient>,
    conversation_id: String,
) -> Result<ShareResponse, String> {
    platform
        .share_conversation(&conversation_id, None)
        .await
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 30: Add `sync_conversation_to_platform` command**

```rust
#[tauri::command]
#[specta::specta]
pub async fn sync_conversation_to_platform(
    platform: tauri::State<'_, PlatformClient>,
    conversation_id: String,
    payload: SyncConversationRequest,
) -> Result<SyncConversationResponse, String> {
    platform
        .sync_conversation_to_platform(&conversation_id, payload, None)
        .await
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 31: Add `hydrate_shared_conversation` command using existing models/repos (NO RAW SQL)**

> **Read the conversation/message models and creation methods found in Step 26.** Adapt the code below to match your exact model structs and method signatures. **Do NOT use `sqlx::query` directly.**

```rust
#[tauri::command]
#[specta::specta]
pub async fn hydrate_shared_conversation(
    // VERIFY: use your actual DB state type (e.g., DbRepo, AppState)
    db: tauri::State<'_, YourDbRepo>,
    payload: SharedConversationPayload,
) -> Result<HydrateResponse, String> {
    // PATTERN A: If your repo takes model structs directly
    // let conversation = Conversation {
    //     id: payload.id.clone(),
    //     title: payload.title.clone(),
    //     created_at: payload.created_at.clone(),
    //     // ...map other required fields, use defaults for optional ones
    // };
    // db.create_conversation(conversation).await.map_err(|e| e.to_string())?;

    // for msg in &payload.messages {
    //     let message = Message {
    //         id: msg.id.clone(),
    //         conversation_id: payload.id.clone(),
    //         role: msg.role.clone(),
    //         content: msg.content.clone(),
    //         created_at: msg.created_at.clone(),
    //         branch_id: msg.branch_id.clone(),
    //         // ...map other required fields
    //     };
    //     db.create_message(message).await.map_err(|e| e.to_string())?;
    // }

    // PATTERN B: If your repo takes individual fields
    // db.create_conversation(
    //     payload.id.clone(),
    //     payload.title.clone(),
    //     payload.created_at.clone(),
    // ).await.map_err(|e| e.to_string())?;

    // for msg in &payload.messages {
    //     db.create_message(
    //         msg.id.clone(),
    //         payload.id.clone(),
    //         msg.role.clone(),
    //         msg.content.clone(),
    //         msg.created_at.clone(),
    //         msg.branch_id.clone(),
    //     ).await.map_err(|e| e.to_string())?;
    // }

    // PATTERN C: If you have a bulk import method (preferred if available)
    // let input = ImportConversationInput { /* map fields */ };
    // db.import_conversation(input).await.map_err(|e| e.to_string())?;

    Ok(HydrateResponse {
        local_id: payload.id,
    })
}
```

- [ ] **Step 32: Register new commands in the builder**

> **Read `src-tauri/src/lib.rs`** to find where `.invoke_handler()` is called and add the new commands to the existing list.

```rust
// In the invoke_handler macro call, add:
// get_shared_conversation,
// check_sync_status,
// share_conversation,
// sync_conversation_to_platform,
// hydrate_shared_conversation,
```

- [ ] **Step 33: Run cargo check**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 34: Regenerate frontend bindings**

```bash
# Run whatever command regenerates src/lib/bindings.ts:
pnpm generate:bindings  # or pnpm specta, etc.
```

- [ ] **Step 35: Verify new commands appear in bindings**

```bash
grep -n "getSharedConversation\|checkSyncStatus\|shareConversation\|syncConversationToPlatform\|hydrateSharedConversation" src/lib/bindings.ts
```

---

## Chunk 5: URL State Hooks & Zustand Removal

### Task 12: Create URL-derived hooks (replace Zustand slices)

**Files:**
- Create: `src/hooks/use-left-panel-search.ts`
- Create: `src/hooks/use-expanded-folders.ts`
- Create: `src/hooks/use-expanded-date-groups.ts`
- Create: `src/hooks/use-profile-filter.ts`

- [ ] **Step 36: Implement useLeftPanelSearch**

> Uses `Route.useSearch()` from the root route. Works because `LeftPanel` is rendered inside `AppShell` (the root route component), so `navigate({ search: fn })` updates root-level search params.

```tsx
// src/hooks/use-left-panel-search.ts
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback } from 'react'

export function useLeftPanelSearch() {
  const navigate = useNavigate()
  const { leftSearch } = Route.useSearch()

  const setLeftSearch = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({ ...prev, leftSearch: value || undefined }),
      })
    },
    [navigate],
  )

  return { leftSearch: leftSearch ?? '', setLeftSearch }
}
```

- [ ] **Step 37: Implement useExpandedFolders**

```tsx
// src/hooks/use-expanded-folders.ts
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
          const current = prev.expandedFolders
            ? prev.expandedFolders.split(',')
            : []
          const next = current.includes(folderId)
            ? current.filter((id) => id !== folderId)
            : [...current, folderId]
          return {
            ...prev,
            expandedFolders: next.length ? next.join(',') : undefined,
          }
        },
      })
    },
    [navigate],
  )

  return { expandedFolders: folderIds, toggleFolder }
}
```

- [ ] **Step 38: Implement useExpandedDateGroups**

```tsx
// src/hooks/use-expanded-date-groups.ts
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
          const current = prev.expandedDateGroups
            ? prev.expandedDateGroups.split(',')
            : []
          const next = current.includes(key)
            ? current.filter((k) => k !== key)
            : [...current, key]
          return {
            ...prev,
            expandedDateGroups: next.length ? next.join(',') : undefined,
          }
        },
      })
    },
    [navigate],
  )

  return { expandedDateGroups: groupKeys, toggleDateGroup }
}
```

- [ ] **Step 39: Implement useProfileFilter**

```tsx
// src/hooks/use-profile-filter.ts
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback } from 'react'

export function useProfileFilter() {
  const navigate = useNavigate()
  const { profileId } = Route.useSearch()

  const setProfileId = useCallback(
    (id: string | null) => {
      navigate({
        search: (prev) => ({ ...prev, profileId: id || undefined }),
      })
    },
    [navigate],
  )

  return { profileId: profileId ?? null, setProfileId }
}
```

### Task 13: Remove Zustand state that is now URL-derived

**Files:**
- Modify: `src/store/ui-ephemeral.ts` — remove `searchQuery` and `setSearchQuery`
- Modify: `src/store/ui-layout.ts` — remove `collapsedDateGroups`, `toggleDateGroup`, `setDateGroupCollapsed`

- [ ] **Step 40: Remove searchQuery from ui-ephemeral store**

> **Read `src/store/ui-ephemeral.ts` first** to find the exact field/action names.

```typescript
// In src/store/ui-ephemeral.ts, delete:
// - searchQuery: string  (from state)
// - setSearchQuery: (query: string) => void  (from actions)
// - Any selectors like getSearchQuery
// Keep: streaming state, draft message state, any other ephemeral UI state
```

- [ ] **Step 41: Remove collapsedDateGroups from ui-layout store**

> **Read `src/store/ui-layout.ts` first** to find exact field/action names.

```typescript
// In src/store/ui-layout.ts, delete:
// - collapsedDateGroups: Record<string, boolean>  (from state)
// - toggleDateGroup: (key: string) => void  (from actions)
// - setDateGroupCollapsed: (key: string, collapsed: boolean) => void  (from actions)
// Keep: panel widths, sidebar collapsed state, other layout state
```

- [ ] **Step 42: Update LeftPanel to use new URL hooks**

> **Read `src/components/layout/left-panel.tsx` first** to find exact import paths, variable names, and component structure.

```tsx
// In src/components/layout/left-panel.tsx — replace Zustand imports with URL hooks:

// REMOVE:
// const searchQuery = useUIEphemeralStore(s => s.searchQuery)
// const setSearchQuery = useUIEphemeralStore(s => s.setSearchQuery)
// const collapsedDateGroups = useUILayoutStore(s => s.collapsedDateGroups)
// const toggleDateGroup = useUILayoutStore(s => s.toggleDateGroup)

// ADD:
import { useLeftPanelSearch } from '@/hooks/use-left-panel-search'
import { useExpandedFolders } from '@/hooks/use-expanded-folders'
import { useExpandedDateGroups } from '@/hooks/use-expanded-date-groups'
import { useProfileFilter } from '@/hooks/use-profile-filter'

// Inside component body:
const { leftSearch, setLeftSearch } = useLeftPanelSearch()
const { expandedFolders, toggleFolder } = useExpandedFolders()
const { expandedDateGroups, toggleDateGroup } = useExpandedDateGroups()
const { profileId, setProfileId } = useProfileFilter()
```

- [ ] **Step 43: Find and update ALL other components referencing removed Zustand fields**

```bash
grep -rn "searchQuery" src/ --include="*.ts" --include="*.tsx"
grep -rn "collapsedDateGroups" src/ --include="*.ts" --include="*.tsx"
grep -rn "toggleDateGroup" src/ --include="*.ts" --include="*.tsx"
grep -rn "setSearchQuery" src/ --include="*.ts" --include="*.tsx"
```

Update every hit to use the new URL hooks or remove dead code.

---

## Chunk 6: Share Button & Conversation Search via URL

### Task 14: Update share button to use Tauri commands

**Files:**
- Modify: the existing conversation header/share button component

- [ ] **Step 44: Find the share button component**

```bash
grep -rn "share\|clipboard\|copy.*link" src/components/ --include="*.tsx" -l
```

- [ ] **Step 45: Update share handler to use Tauri commands**

> **Read the existing share component first** to understand the current flow and what UI elements (modals, toasts) are available.

```tsx
// In the share button handler — replace any existing share logic:
import { commands } from '@/lib/bindings'

const handleShare = async (conversationId: string) => {
  try {
    // Step 1: Check if conversation is already synced to platform
    const syncRes = await commands.checkSyncStatus(conversationId)
    if (syncRes.status === 'error') {
      toast.error('Failed to check sync status')
      return
    }

    if (!syncRes.data.is_synced) {
      // Show upload confirmation modal using existing modal component
      // After user confirms:
      // const messages = await commands.getConversationMessages(conversationId)
      // const syncPayload = { title: '...', messages: messages.data }
      // await commands.syncConversationToPlatform(conversationId, syncPayload)
    }

    // Step 2: Create share link
    const shareRes = await commands.shareConversation(conversationId)
    if (shareRes.status === 'error') {
      toast.error('Failed to share conversation')
      return
    }

    // Step 3: Copy skilldeck:// deep link to clipboard
    const shareUrl = `skilldeck://shared/${shareRes.data.share_token}`
    await navigator.clipboard.writeText(shareUrl)

    // Use existing toast/notification component
    toast.success('Shareable link copied!')
  } catch (err) {
    toast.error('Failed to share conversation')
  }
}
```

### Task 15: Bind conversation search to URL params

**Files:**
- Modify: the component containing the conversation-level search input

- [ ] **Step 46: Find the conversation search input**

```bash
grep -rn "conversationSearch\|search.*message\|filterMessage" src/components/ --include="*.tsx" -l
```

- [ ] **Step 47: Bind to URL search param**

> **Read the component first** to understand the current state management.

```tsx
import { useNavigate } from '@tanstack/react-router'
import { Route as ConversationRoute } from '@/routes/conversations.$conversationId'

// Inside component:
const navigate = useNavigate()
const { conversationSearch } = ConversationRoute.useSearch()

const handleConversationSearch = (value: string) => {
  navigate({
    search: (prev) => ({
      ...prev,
      conversationSearch: value || undefined,
    }),
  })
}

// Bind to input:
<input
  value={conversationSearch ?? ''}
  onChange={(e) => handleConversationSearch(e.target.value)}
/>
```

---

## Chunk 7: Devtools, Testing & Cleanup

### Task 16: Add route devtools

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 48: Add TanStack Router Devtools in development**

```tsx
// src/routes/__root.tsx — import and render inside RootComponent
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

function RootComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  useEffect(() => {
    if (search.onboard === 'true') {
      window.dispatchEvent(new CustomEvent('skilldeck:show-onboarding'))
      const { onboard, ...rest } = search
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void navigate({ search: rest as RootSearch })
    }
  }, [search.onboard, navigate])

  return (
    <>
      <AppShell />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  )
}
```

### Task 17: Clean up conversation store sync

**Files:**
- Modify: `src/store/conversation.ts`

- [ ] **Step 49: Ensure conversation store syncs from URL on mount**

> **Read `src/store/conversation.ts` first.** Keep `activeConversationId` in the store for non-router consumers, but ensure it doesn't have a conflicting default. The `ConversationLayout` useEffect (Step 13) sets it from the URL.

```typescript
// Verify:
// - Remove any hardcoded default activeConversationId that could conflict with URL
// - The setActiveConversation call in ConversationLayout (Step 13) is the source of truth
// - Any component reading activeConversationId from the store gets the URL-derived value
```

### Task 18: Type-check and verify no dead references

- [ ] **Step 50: Run TypeScript type-check**

```bash
pnpm typecheck
```

- [ ] **Step 51: Run unit tests**

```bash
pnpm test
```

- [ ] **Step 52: Run e2e tests (if configured)**

```bash
pnpm test:e2e
```

- [ ] **Step 53: Verify no remaining references to removed Zustand fields**

```bash
grep -rn "setSearchQuery\|collapsedDateGroups\|toggleDateGroup\|setDateGroupCollapsed" src/ --include="*.ts" --include="*.tsx"
# Expect: zero results (or only in store files' removed sections)
```

- [ ] **Step 54: Verify no JavaScript platform API client exists**

```bash
grep -rn "platform-api\|platformApi\|fetch.*platform" src/ --include="*.ts" --include="*.tsx"
# Expect: zero results (all platform calls go through commands.*)
```

### Task 19: Manual deep-link verification

- [ ] **Step 55: Test desktop deep-link in dev mode**

> The `register_all()` call in Step 4 ensures schemes are registered at runtime for dev.

```bash
# Windows (dev mode works thanks to register_all)
start skilldeck://conversations/test-123

# Linux (dev mode works thanks to register_all)
xdg-open skilldeck://conversations/test-123

# macOS (requires bundled app in /Applications — dev mode won't work)
# Only test after building and installing the .app bundle
```

- [ ] **Step 56: Test URL state persistence**

1. Navigate to `/conversations/abc?messageId=xyz&leftSearch=test`
2. Verify left panel search shows "test"
3. Verify scroll targets message `xyz`
4. Refresh the page — state should persist from URL
5. Clear `leftSearch` — verify URL updates and param is removed

- [ ] **Step 57: Test shared conversation flow**

1. Trigger `skilldeck://shared/<token>` deep link
2. Verify loader calls `commands.getSharedConversation(token)`
3. Verify hydration via `commands.hydrateSharedConversation(data)`
4. Verify redirect to `/conversations/<localId>`

- [ ] **Step 58: Test single-instance behavior (desktop)**

1. Launch app
2. Launch app again via `skilldeck://conversations/test`
3. Verify second instance doesn't open
4. Verify first instance navigates to the deep-link URL

---

## Summary of Key Corrections from Original Plan

| Area | Original (Wrong) | Revised (Correct) |
|---|---|---|
| **Platform API** | New JS `src/lib/platform-api.ts` with `fetch()` | New methods on existing Rust `PlatformClient` + Tauri commands |
| **DB Hydration** | Raw `sqlx::query` in Tauri command | Uses existing crate models/repos (zero raw SQL) |
| **Cargo.toml** | `tauri-plugin-single-instance = "2"` (no feature) | `{ version = "2", features = ["deep-link"] }` with target cfg |
| **Plugin order** | No ordering specified | Single-instance **must** be first plugin |
| **Single-instance callback** | Manually emits `deep-link` event | Callback is informational only — "deep link event already triggered" |
| **Frontend API** | `listen('deep-link', ...)` from `@tauri-apps/api/event` | `onOpenUrl()` and `getCurrent()` from `@tauri-apps/plugin-deep-link` |
| **URL payload type** | Single string | **Array** of strings (`urls: string[]`) |
| **Config location** | `app.protocols` in tauri.conf.json | `plugins.deep-link.desktop.schemes` in tauri.conf.json |
| **Dev mode** | Not addressed | `register_all()` in setup for Linux/Windows debug builds |
| **Permissions** | Not included | `deep-link:default` + `core:event:default` in capabilities |
| **npm packages** | Missing `@tauri-apps/plugin-deep-link` | Added to dependencies |
| **Route file naming** | `conversations/$conversationId.tsx` | `conversations.$conversationId.tsx` (TanStack convention) |
| **Root search access** | `useSearch({ from: '/' })` | `Route.useSearch()` importing `Route` from `__root.tsx` |
| **Binding regeneration** | Not specified | Explicit step to run specta/ts-rs binding gen |
