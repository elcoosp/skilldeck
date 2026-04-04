// src/components/layout/left-panel.tsx
/**
 * Left panel — completely remade UX:
 * - Narrow vertical band (min-w-[64px], pt-8 pb-4) with workspace avatar stack + bottom icons
 * - border-r border-border kept for the visible delimiter, with a gradient overlay on the top 1/7 to fade it
 * - All workspaces shown as clickable avatar circles (active one highlighted)
 * - "+" button to open/add a new workspace
 * - Sort toggle (F04): switch between updated/created order
 * - Open in Editor button (F08): opens workspace in preferred editor
 * - Main area — fully responsive conversation list
 * - Conversations filtered by currently selected workspace only
 */

import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown,
  ChevronDown,
  Code2,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Search,
  Settings
} from 'lucide-react'
import { Collapsible } from 'radix-ui'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConversationItem } from '@/components/conversation/conversation-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useExpandedDateGroups } from '@/hooks/use-expanded-date-groups'
import {
  useCreateFolder,
  useFolders,
} from '@/hooks/use-folders'
import { useLeftPanelSearch } from '@/hooks/use-left-panel-search'
import { useProfileFilter } from '@/hooks/use-profile-filter'
import { useProfiles } from '@/hooks/use-profiles'
import { useOpenWorkspace, useWorkspaces } from '@/hooks/use-workspaces'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings'
import { useUIOverlaysStore } from '@/store/ui-overlays'
import { useWorkspaceStore } from '@/store/workspace'

// ----------------------------------------------------------------------
// Helper: deterministic color from workspace id
// ----------------------------------------------------------------------
function getWorkspaceColor(workspaceId: string): string {
  const colors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500'
  ]
  let hash = 0
  for (let i = 0; i < workspaceId.length; i++) {
    hash = (hash << 5) - hash + workspaceId.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

// ----------------------------------------------------------------------
// Date grouping helper
// ----------------------------------------------------------------------
import { isToday, isValid, isYesterday, parseISO, subDays } from 'date-fns'

function getDateGroupKey(dateStr: string): string {
  const normalized = dateStr
    .replace(' ', 'T')
    .replace(' +', '+')
    .replace(' -', '-')
  const date = parseISO(normalized)
  if (!isValid(date)) return 'Older'
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (date > subDays(new Date(), 7)) return 'Last 7 days'
  if (date > subDays(new Date(), 30)) return 'Last 30 days'
  return 'Older'
}

// ----------------------------------------------------------------------
// Empty state animation
// ----------------------------------------------------------------------
interface EmptyStateAnimationProps {
  alt: string
  className?: string
}

function EmptyStateAnimation({ alt, className }: EmptyStateAnimationProps) {
  const [hasError, setHasError] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  if (prefersReducedMotion || hasError) {
    return (
      <img
        src="/illustrations/empty-conversations.svg"
        alt={alt}
        className={className}
      />
    )
  }

  return (
    <DotLottieReact
      src="/illustrations/empty-conversations.lottie"
      autoplay
      className={className}
      onError={() => setHasError(true)}
      aria-label={alt}
    />
  )
}

// ----------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------
export function LeftPanel() {
  const router = useRouter()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Store & UI state
  const setGlobalSearchOpen = useUIOverlaysStore((s) => s.setGlobalSearchOpen)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)

  const { leftSearch, setLeftSearch } = useLeftPanelSearch()
  const { expandedDateGroups, toggleDateGroup } = useExpandedDateGroups()
  const { profileId, setProfileId } = useProfileFilter()

  // F04: Sort preference from settings store
  const conversationSort = useSettingsStore((s) => s.conversationSort) ?? 'updated'
  // F08: Preferred editor from settings store
  const preferredEditor = useSettingsStore((s) => s.preferredEditor) ?? 'system'

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Data hooks
  const { data: workspaces = [] } = useWorkspaces()
  const openWorkspace = useOpenWorkspace()
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  const { data: profiles = [] } = useProfiles(false)
  const { data: allProfiles, isLoading: profilesLoading } = useProfiles(true)
  const defaultProfile = allProfiles?.find((p) => p.is_default) ?? allProfiles?.[0]

  // Fetch all conversations (across all workspaces) then filter by current workspace
  const { data: allConversations, isLoading: conversationsLoading } =
    useConversations(profileId)
  const workspaceConversations = allConversations?.filter(
    (c) => c.workspace_id === activeWorkspaceId
  ) ?? []

  const { data: folders = [], isLoading: foldersLoading } = useFolders()
  const createFolder = useCreateFolder()
  const createConversation = useCreateConversation(defaultProfile?.id)

  // Apply search filter client-side on workspace-filtered conversations
  const filtered = workspaceConversations.filter((c) =>
    leftSearch
      ? (c.title ?? '').toLowerCase().includes(leftSearch.toLowerCase())
      : true
  )

  // F04: Sort by the user's chosen field before splitting into pinned/unpinned
  const sorted = [...filtered].sort((a, b) => {
    const field = conversationSort === 'updated' ? 'updated_at' : 'created_at'
    return new Date(b[field]).getTime() - new Date(a[field]).getTime()
  })

  // Pinned, folders, date groups
  const pinnedConversations = sorted.filter((c) => c.pinned)
  const unpinned = sorted.filter((c) => !c.pinned)

  const conversationsByFolder = new Map<string, typeof unpinned>()
  const conversationsWithoutFolder: typeof unpinned = []
  for (const conv of unpinned) {
    if (conv.folder_id) {
      const list = conversationsByFolder.get(conv.folder_id) || []
      list.push(conv)
      conversationsByFolder.set(conv.folder_id, list)
    } else {
      conversationsWithoutFolder.push(conv)
    }
  }

  const groupedByDate: Record<string, typeof unpinned> = {}
  for (const conv of conversationsWithoutFolder) {
    const key = getDateGroupKey(conv.updated_at)
    if (!groupedByDate[key]) groupedByDate[key] = []
    groupedByDate[key].push(conv)
  }

  const isLoading = profilesLoading || conversationsLoading || foldersLoading

  // Workspace actions
  const handleSwitchWorkspace = async (workspace: (typeof workspaces)[0]) => {
    if (!workspace.is_open) {
      try {
        const reopened = await openWorkspace.mutateAsync(workspace.path)
        setActiveWorkspace(reopened.id)
        toast.success(`Switched to ${reopened.name}`)
      } catch (err) {
        toast.error(`Failed to open workspace: ${err}`)
      }
    } else {
      setActiveWorkspace(workspace.id)
      toast.success(`Switched to ${workspace.name}`)
    }
  }

  const handleOpenWorkspace = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select workspace folder'
      })
      if (!selected) return
      const workspace = await openWorkspace.mutateAsync(selected)
      setActiveWorkspace(workspace.id)
      toast.success(`Workspace opened: ${workspace.name}`)
    } catch (err) {
      toast.error(`Could not open workspace: ${err}`)
    }
  }

  // F08: Open workspace in preferred editor
  const handleOpenInEditor = async () => {
    if (!activeWorkspace) return
    const path = activeWorkspace.path
    const editorSchemes: Record<string, string> = {
      vscode: `vscode://file/${path}`,
      cursor: `cursor://file/${path}`,
    }
    const url = editorSchemes[preferredEditor] ?? `file://${path}`
    try {
      await openUrl(url)
    } catch {
      toast.error('Could not open editor')
    }
  }

  // F04: Toggle sort
  const handleToggleSort = () => {
    useSettingsStore.getState().setConversationSort(
      conversationSort === 'updated' ? 'created' : 'updated'
    )
  }

  const handleNewChat = () => {
    if (!defaultProfile) {
      toast.error('No profile found. Add one in Settings.')
      return
    }
    if (!activeWorkspace) {
      toast.error('No workspace selected. Open or create a workspace first.')
      return
    }
    createConversation.mutate({ title: undefined })
  }

  const handleDeleteStart = (conversationId: string) => setDeletingId(conversationId)
  const handleDeleteComplete = () => setDeletingId(null)

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFolder.mutateAsync(newFolderName.trim())
      setNewFolderName('')
      setShowNewFolderInput(false)
      toast.success('Folder created')
    } catch (err) {
      toast.error(`Failed to create folder: ${err}`)
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Narrow vertical band — workspace avatar stack + bottom icons */}
      <div className="relative min-w-[64px] h-full flex flex-col justify-between border-r border-border bg-muted/10 pt-8 pb-4 shrink-0">
        {/* Gradient overlay: fades the top 1/7 of the border from background → transparent */}
        <div
          className="absolute right-0 top-0 h-[14.2857%] w-2 -translate-x-[3px] pointer-events-none z-10 bg-gradient-to-b from-background to-transparent"
          aria-hidden="true"
        />

        {/* Scrollable workspace avatar list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col items-center gap-2 px-2 pt-3 pb-3">
            {workspaces.map((w) => {
              const isActive = w.id === activeWorkspaceId
              const initials = w.name ? w.name.slice(0, 2).toUpperCase() : '??'
              const colorClass = getWorkspaceColor(w.id)

              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleSwitchWorkspace(w)}
                  title={w.is_open ? w.name : `${w.name} (closed)`}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm transition-transform duration-150 ease-out hover:scale-105 focus:outline-none shrink-0',
                    colorClass,
                    isActive
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md'
                      : 'opacity-70 hover:opacity-100'
                  )}
                >
                  {initials}
                </button>
              )
            })}

            {/* Add workspace button */}
            <button
              type="button"
              onClick={handleOpenWorkspace}
              title="Open workspace…"
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground border border-dashed border-muted-foreground/40 transition-transform duration-150 ease-out hover:scale-105 hover:border-muted-foreground/70 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shrink-0"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </ScrollArea>

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-4 pt-2 border-t border-border/40 mt-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Global search"
            onClick={() => setGlobalSearchOpen(true)}
            className="rounded-full h-9 w-9"
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => router.navigate({ to: '/settings/api-keys' })}
            className="rounded-full h-9 w-9"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main area — fully responsive conversation list */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        {/* Header: New chat + search + profile filter + sort + editor */}
        <div className="px-3 py-3 border-b border-border shrink-0">
          <Button
            className="w-full mb-2"
            size="sm"
            onClick={handleNewChat}
            disabled={createConversation.isPending || !defaultProfile || !activeWorkspace}
          >
            <Plus className="size-4 mr-1.5" />
            New Chat
          </Button>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Search — takes all remaining space, wraps to full width if needed */}
            <div className="relative min-w-[120px] flex-1 basis-full">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search…"
                value={leftSearch}
                onChange={(e) => setLeftSearch(e.target.value)}
                className="pl-7 h-7 text-sm w-full"
              />
            </div>

            {/* Profile select — sizes to content, never truncates */}
            <Select
              value={profileId ?? 'all'}
              onValueChange={(val) => setProfileId(val === 'all' ? null : val)}
            >
              <SelectTrigger className="h-7 text-sm shrink-0">
                <SelectValue placeholder="Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All profiles</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* F04: Sort toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title={`Sort by: ${conversationSort === 'updated' ? 'last updated' : 'created date'} (click to toggle)`}
              onClick={handleToggleSort}
            >
              <ArrowUpDown className="size-3.5" />
            </Button>

            {/* F08: Open in editor */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Open in editor"
              onClick={handleOpenInEditor}
              disabled={!activeWorkspace}
            >
              <Code2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!min-w-0">
          <div className="px-1.5 py-1.5 space-y-0.5">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : !activeWorkspace ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 px-3 text-center"
              >
                <div className="w-24 h-24 mb-3 rounded-full bg-muted flex items-center justify-center">
                  <FolderOpen className="size-10 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold mb-1">No workspace selected</h3>
                <p className="text-xs text-muted-foreground w-full mb-3">
                  Open a workspace to see your conversations.
                </p>
                <Button size="sm" onClick={handleOpenWorkspace}>
                  <FolderOpen className="size-3.5 mr-1.5" />
                  Open workspace
                </Button>
              </motion.div>
            ) : filtered.length === 0 ? (
              leftSearch ? (
                <p className="text-center text-xs text-muted-foreground py-8 px-3 w-full">
                  No matches
                </p>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-10 px-3 text-center"
                >
                  <div className="w-36 h-36 mb-3 overflow-hidden rounded-2xl opacity-70">
                    <EmptyStateAnimation
                      alt={`No conversations in ${activeWorkspace.name}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-sm font-semibold mb-1 truncate w-full">
                    No conversations in &ldquo;{activeWorkspace.name}&rdquo;
                  </h3>
                  <p className="text-xs text-muted-foreground w-full mb-3">
                    Start a new conversation to begin chatting.
                  </p>
                  <Button size="sm" onClick={handleNewChat}>
                    <Plus className="size-3.5 mr-1.5" />
                    New Chat
                  </Button>
                </motion.div>
              )
            ) : (
              <AnimatePresence mode="popLayout" onExitComplete={handleDeleteComplete}>
                {/* Pinned section */}
                {pinnedConversations.length > 0 && (
                  <Collapsible.Root defaultOpen>
                    <Collapsible.Trigger className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors group">
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-primary" />
                        Pinned
                      </span>
                      <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90" />
                    </Collapsible.Trigger>
                    <Collapsible.Content className="space-y-0.5">
                      {pinnedConversations.map((c) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.15 } }}
                          transition={{ duration: 0.2 }}
                        >
                          <ConversationItem
                            conversation={c}
                            isActive={pathname === `/conversations/${c.id}`}
                            isDeleting={c.id === deletingId}
                            onDeleteStart={handleDeleteStart}
                            onClick={() =>
                              router.navigate({
                                to: '/conversations/$conversationId',
                                params: { conversationId: c.id }
                              })
                            }
                            workspaceName={activeWorkspace.name}
                            profileName={c.profile_name}
                            profileDeleted={c.profile_deleted}
                            showProfileBadge={profileId === null}
                          />
                        </motion.div>
                      ))}
                    </Collapsible.Content>
                  </Collapsible.Root>
                )}

                {/* Folders section */}
                {folders.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        Folders
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowNewFolderInput(true)}
                        title="New folder"
                      >
                        <FolderPlus className="size-3.5" />
                      </Button>
                    </div>

                    {showNewFolderInput && (
                      <div className="px-2 py-1 flex gap-1">
                        <Input
                          placeholder="Folder name"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          className="h-7 text-xs min-w-0 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateFolder()
                            if (e.key === 'Escape') setShowNewFolderInput(false)
                          }}
                        />
                        <Button size="xs" onClick={handleCreateFolder} className="shrink-0">
                          Create
                        </Button>
                      </div>
                    )}

                    {folders.map((folder) => {
                      const folderConvs = conversationsByFolder.get(folder.id) ?? []
                      if (folderConvs.length === 0) return null
                      return (
                        <Collapsible.Root key={folder.id} defaultOpen>
                          <Collapsible.Trigger className="group flex items-center justify-between w-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Folder className="size-3.5 shrink-0" />
                              <span className="truncate">{folder.name}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                ({folderConvs.length})
                              </span>
                            </div>
                            <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90 shrink-0" />
                          </Collapsible.Trigger>
                          <Collapsible.Content className="space-y-0.5 pl-5">
                            {folderConvs.map((c) => (
                              <motion.div
                                key={c.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                                transition={{ duration: 0.2 }}
                              >
                                <ConversationItem
                                  conversation={c}
                                  isActive={pathname === `/conversations/${c.id}`}
                                  isDeleting={c.id === deletingId}
                                  onDeleteStart={handleDeleteStart}
                                  onClick={() =>
                                    router.navigate({
                                      to: '/conversations/$conversationId',
                                      params: { conversationId: c.id }
                                    })
                                  }
                                  workspaceName={activeWorkspace.name}
                                  profileName={c.profile_name}
                                  profileDeleted={c.profile_deleted}
                                  showProfileBadge={profileId === null}
                                />
                              </motion.div>
                            ))}
                          </Collapsible.Content>
                        </Collapsible.Root>
                      )
                    })}
                  </div>
                )}

                {/* Dated groups (folderless conversations) */}
                {Object.entries(groupedByDate).map(([key, convs]) => (
                  <Collapsible.Root
                    key={key}
                    open={!expandedDateGroups.includes(key)}
                    onOpenChange={() => toggleDateGroup(key)}
                  >
                    <Collapsible.Trigger className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors group mt-2 first:mt-0">
                      {key}
                      <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90 shrink-0" />
                    </Collapsible.Trigger>
                    <Collapsible.Content className="space-y-0.5">
                      {convs.map((c) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.15 } }}
                          transition={{ duration: 0.2 }}
                        >
                          <ConversationItem
                            conversation={c}
                            isActive={pathname === `/conversations/${c.id}`}
                            isDeleting={c.id === deletingId}
                            onDeleteStart={handleDeleteStart}
                            onClick={() =>
                              router.navigate({
                                to: '/conversations/$conversationId',
                                params: { conversationId: c.id }
                              })
                            }
                            workspaceName={activeWorkspace.name}
                            profileName={c.profile_name}
                            profileDeleted={c.profile_deleted}
                            showProfileBadge={profileId === null}
                          />
                        </motion.div>
                      ))}
                    </Collapsible.Content>
                  </Collapsible.Root>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
