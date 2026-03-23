// src/components/layout/left-panel.tsx
/**
 * Left panel — conversation list, search, new chat, workspace switcher,
 * and profile filter, now with pinned conversations, folder grouping, and dated collapsible groups.
 */

import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { open } from '@tauri-apps/plugin-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { Collapsible } from 'radix-ui'
import { ChevronDown, FolderOpen, FolderPlus, Plus, Search, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConversationItem } from '@/components/conversation/conversation-item'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { WorkspaceContextBadge } from '@/components/workspace/workspace-context-badge'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useFolders, useCreateFolder, useMoveConversationToFolder } from '@/hooks/use-folders'
import { useProfiles } from '@/hooks/use-profiles'
import { useOpenWorkspace, useWorkspaces } from '@/hooks/use-workspaces'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

// ----------------------------------------------------------------------
// Lottie-powered empty state animation with fallback and reduced motion
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

    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // If reduced motion is preferred or the Lottie failed to load, show static SVG
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
// Helper to group conversations by date
// ----------------------------------------------------------------------
import { isToday, isYesterday, subDays } from 'date-fns'

function getDateGroupKey(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (date > subDays(new Date(), 7)) return 'Last 7 days'
  if (date > subDays(new Date(), 30)) return 'Last 30 days'
  return 'Older'
}

// ----------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------
export function LeftPanel() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)
  const setGlobalSearchOpen = useUIStore((s) => s.setGlobalSearchOpen)
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useUIStore((s) => s.setActiveWorkspace)

  // Track which conversation is being deleted for animation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Profile filter state
  const { data: profiles = [] } = useProfiles(false) // active profiles only
  const [filterProfileId, setFilterProfileId] = useState<string | null>(null)

  // Get profiles first for default profile fallback
  const { data: allProfiles, isLoading: profilesLoading } = useProfiles(true) // needed for default profile (might be deleted)
  const defaultProfile =
    allProfiles?.find((p) => p.is_default) ?? allProfiles?.[0]

  // Pass the profile ID to conversations query (null means all profiles)
  const { data: conversations, isLoading: conversationsLoading } =
    useConversations(filterProfileId)

  // Folders
  const { data: folders = [], isLoading: foldersLoading } = useFolders()
  const createFolder = useCreateFolder()
  const moveConversationToFolder = useMoveConversationToFolder()

  // UI state for collapsed date groups
  const collapsedDateGroups = useUIStore((s) => s.collapsedDateGroups)
  const toggleDateGroup = useUIStore((s) => s.toggleDateGroup)
  const setDateGroupCollapsed = useUIStore((s) => s.setDateGroupCollapsed)

  // New folder creation modal state (simple prompt)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Pass the profile ID to useCreateConversation so it can invalidate the correct query key
  const createConversation = useCreateConversation(defaultProfile?.id)

  const { data: workspaces = [] } = useWorkspaces()
  const openWorkspace = useOpenWorkspace()

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  // Helper to get workspace name from ID
  const getWorkspaceName = (workspaceId: string | null) => {
    if (!workspaceId) return null
    const ws = workspaces.find((w) => w.id === workspaceId)
    return ws?.name ?? null
  }

  // Apply search filter client-side
  const filtered = conversations?.filter((c) =>
    searchQuery
      ? (c.title ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

  // Separate pinned and unpinned conversations
  const pinnedConversations = filtered?.filter((c) => c.pinned) ?? []
  const unpinned = filtered?.filter((c) => !c.pinned) ?? []

  // Group unpinned conversations by folder
  const conversationsByFolder = new Map<string, typeof unpinned>()
  const conversationsWithoutFolder: typeof unpinned = []

  for (const conv of unpinned) {
    if (conv.folder_id) {
      const folderId = conv.folder_id
      const list = conversationsByFolder.get(folderId) || []
      list.push(conv)
      conversationsByFolder.set(folderId, list)
    } else {
      conversationsWithoutFolder.push(conv)
    }
  }

  // Group the remaining (folderless) conversations by date
  const groupedByDate: Record<string, typeof unpinned> = {}
  for (const conv of conversationsWithoutFolder) {
    const key = getDateGroupKey(conv.updated_at)
    if (!groupedByDate[key]) groupedByDate[key] = []
    groupedByDate[key].push(conv)
  }

  const handleNew = () => {
    if (!defaultProfile) {
      toast.error('No profile found. Add one in Settings.')
      return
    }
    createConversation.mutate({ title: undefined })
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

  const handleDeleteStart = (conversationId: string) => {
    setDeletingId(conversationId)
  }

  const handleDeleteComplete = () => {
    setDeletingId(null)
  }

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

  const handleMoveToFolder = async (conversationId: string, folderId: string | null) => {
    try {
      await moveConversationToFolder.mutateAsync({ conversationId, folderId })
      toast.success(folderId ? 'Moved to folder' : 'Removed from folder')
    } catch (err) {
      toast.error(`Failed to move: ${err}`)
    }
  }

  const isLoading = profilesLoading || conversationsLoading || foldersLoading

  // Find the currently selected profile name (if any)
  const selectedProfile = filterProfileId
    ? profiles.find((p) => p.id === filterProfileId)
    : null

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold tracking-tight">
            SkillDeck
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Search all conversations"
              onClick={() => {
                const event = new CustomEvent('skilldeck:open-global-search')
                window.dispatchEvent(event)
              }}
            >
              <Search className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </div>

        <Button
          className="w-full mb-2"
          size="sm"
          onClick={handleNew}
          disabled={createConversation.isPending || !defaultProfile}
        >
          <Plus className="size-4 mr-1.5" />
          New Chat
        </Button>

        {/* Search + filter row – flex-wrap prevents compression */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[120px] flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-7 text-sm"
            />
          </div>

          {/* Profile filter dropdown */}
          <Select
            value={filterProfileId ?? 'all'}
            onValueChange={(val) =>
              setFilterProfileId(val === 'all' ? null : val)
            }
          >
            <SelectTrigger className="w-[140px] h-7">
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

          {/* Profile creation shortcut */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setSettingsTab('profiles')
              setSettingsOpen(true)
            }}
            title="Create new profile"
            className="h-7 w-7"
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filtered?.length === 0 ? (
            // No conversations after applying search (or no conversations at all)
            searchQuery ? (
              // Case: search yielded no results
              <p className="text-center text-xs text-muted-foreground py-8">
                No matches
              </p>
            ) : (
              // No conversations at all
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center py-12 px-4 text-center"
              >
                {filterProfileId && selectedProfile ? (
                  // Contextual empty state for a specific profile
                  <>
                    <div className="w-48 h-48 mb-4 overflow-hidden rounded-3xl opacity-70">
                      <EmptyStateAnimation
                        alt={`No conversations in ${selectedProfile.name}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-1">
                      No conversations in "{selectedProfile.name}"
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-xs mb-4">
                      Start a new conversation to begin chatting with this
                      profile.
                    </p>
                  </>
                ) : (
                  // Default empty state (all profiles, no conversations anywhere)
                  <>
                    <div className="w-48 h-48 mb-4 overflow-hidden rounded-3xl">
                      <EmptyStateAnimation
                        alt="No conversations"
                        className="w-full h-full object-cover opacity-90"
                      />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-1">
                      Your deck is empty—time to deal the first card.
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Start a new conversation and build something brilliant.
                    </p>
                  </>
                )}
              </motion.div>
            )
          ) : (
            // Has conversations – render the list
            <AnimatePresence
              mode="popLayout"
              onExitComplete={handleDeleteComplete}
            >
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
                  <Collapsible.Content className="space-y-0.5 pl-2">
                    {pinnedConversations.map((c) => (
                      <motion.div
                        key={c.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          x: -10,
                          transition: { duration: 0.2 }
                        }}
                      >
                        <ConversationItem
                          conversation={c}
                          isActive={c.id === activeConversationId}
                          isDeleting={c.id === deletingId}
                          onDeleteStart={handleDeleteStart}
                          onClick={() => setActiveConversation(c.id)}
                          workspaceName={
                            getWorkspaceName(c.workspace_id) ?? undefined
                          }
                          profileName={c.profile_name}
                          profileDeleted={c.profile_deleted}
                          showProfileBadge={filterProfileId === null}
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
                        className="h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateFolder()
                          if (e.key === 'Escape') setShowNewFolderInput(false)
                        }}
                      />
                      <Button size="xs" onClick={handleCreateFolder}>
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
                          <div className="flex items-center gap-1.5">
                            <Folder className="size-3.5" />
                            <span className="truncate">{folder.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              ({folderConvs.length})
                            </span>
                          </div>
                          <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90" />
                        </Collapsible.Trigger>
                        <Collapsible.Content className="space-y-0.5 pl-5">
                          {folderConvs.map((c) => (
                            <motion.div
                              key={c.id}
                              layout
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{
                                opacity: 0,
                                x: -10,
                                transition: { duration: 0.2 }
                              }}
                            >
                              <ConversationItem
                                conversation={c}
                                isActive={c.id === activeConversationId}
                                isDeleting={c.id === deletingId}
                                onDeleteStart={handleDeleteStart}
                                onClick={() => setActiveConversation(c.id)}
                                workspaceName={
                                  getWorkspaceName(c.workspace_id) ?? undefined
                                }
                                profileName={c.profile_name}
                                profileDeleted={c.profile_deleted}
                                showProfileBadge={filterProfileId === null}
                              />
                            </motion.div>
                          ))}
                        </Collapsible.Content>
                      </Collapsible.Root>
                    )
                  })}
                </div>
              )}

              {/* Dated groups (only for conversations without a folder) */}
              {Object.entries(groupedByDate).map(([key, convs]) => (
                <Collapsible.Root
                  key={key}
                  open={!collapsedDateGroups[key]}
                  onOpenChange={(open) => setDateGroupCollapsed(key, !open)}
                >
                  <Collapsible.Trigger className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors group mt-2 first:mt-0">
                    {key}
                    <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90" />
                  </Collapsible.Trigger>
                  <Collapsible.Content className="space-y-0.5 pl-2">
                    {convs.map((c) => (
                      <motion.div
                        key={c.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          x: -10,
                          transition: { duration: 0.2 }
                        }}
                      >
                        <ConversationItem
                          conversation={c}
                          isActive={c.id === activeConversationId}
                          isDeleting={c.id === deletingId}
                          onDeleteStart={handleDeleteStart}
                          onClick={() => setActiveConversation(c.id)}
                          workspaceName={
                            getWorkspaceName(c.workspace_id) ?? undefined
                          }
                          profileName={c.profile_name}
                          profileDeleted={c.profile_deleted}
                          showProfileBadge={filterProfileId === null}
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

      {/* Footer with workspace switcher */}
      <div className="p-3 border-t border-border shrink-0 min-w-0 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
            >
              <span className="flex items-center gap-1 truncate">
                {activeWorkspace ? activeWorkspace.name : 'No workspace'}
                {activeWorkspace && (
                  <WorkspaceContextBadge workspace={activeWorkspace} />
                )}
              </span>
              <ChevronDown className="size-3.5 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width]"
          >
            {workspaces.length === 0 ? (
              <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
            ) : (
              workspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onClick={() => handleSwitchWorkspace(w)}
                  className={cn(
                    'flex items-center justify-between',
                    w.id === activeWorkspaceId && 'bg-accent'
                  )}
                >
                  <span className="truncate">{w.name}</span>
                  {!w.is_open && (
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                      (closed)
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleOpenWorkspace}
          title="Open another workspace"
        >
          <FolderOpen className="size-3.5 mr-1.5 shrink-0" />
          <span className="truncate">Open another workspace</span>
        </Button>
      </div>
    </div>
  )
}
