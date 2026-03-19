// src/components/layout/left-panel.tsx
/**
 * Left panel — conversation list, search, new chat, workspace switcher,
 * and profile filter.
 */

import { open } from '@tauri-apps/plugin-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FolderOpen, Plus, Search, Settings } from 'lucide-react'
import { useState } from 'react'
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
  SelectValue,
} from '@/components/ui/select'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { useOpenWorkspace, useWorkspaces } from '@/hooks/use-workspaces'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

export function LeftPanel() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)
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
  const defaultProfile = allProfiles?.find((p) => p.is_default) ?? allProfiles?.[0]

  // Pass the profile ID to conversations query (null means all profiles)
  const { data: conversations, isLoading: conversationsLoading } =
    useConversations(filterProfileId)

  // Pass the profile ID to useCreateConversation so it can invalidate the correct query key
  const createConversation = useCreateConversation(defaultProfile?.id)

  const { data: workspaces = [] } = useWorkspaces()
  const openWorkspace = useOpenWorkspace()

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  // Helper to get workspace name from ID
  const getWorkspaceName = (workspaceId: string | null) => {
    if (!workspaceId) return null
    const ws = workspaces.find(w => w.id === workspaceId)
    return ws?.name ?? null
  }

  const filtered = conversations?.filter((c) =>
    searchQuery
      ? (c.title ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

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

  const isLoading = profilesLoading || conversationsLoading

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold tracking-tight">
            SkillDeck
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
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
            onValueChange={(val) => setFilterProfileId(val === 'all' ? null : val)}
          >
            <SelectTrigger className="w-[140px] h-7">
              <SelectValue placeholder="Profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All profiles</SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
            searchQuery ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                No matches
              </p>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center py-12 px-4 text-center"
              >
                <div className="w-48 h-48 mb-4 overflow-hidden rounded-3xl">
                  <img
                    src="/illustrations/empty-conversations.svg"
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
              </motion.div>
            )
          ) : (
            <AnimatePresence
              mode="popLayout"
              onExitComplete={handleDeleteComplete}
            >
              {filtered?.map((c) => (
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
                    workspaceName={getWorkspaceName(c.workspace_id)}
                    // FIX: Use snake_case fields from ConversationSummary
                    profileName={c.profile_name}
                    profileDeleted={c.profile_deleted}
                    showProfileBadge={filterProfileId === null}
                  />
                </motion.div>
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
              <span className="truncate">
                {activeWorkspace ? activeWorkspace.name : 'No workspace'}
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
