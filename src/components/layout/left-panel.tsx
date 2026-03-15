/**
 * Left panel — conversation list, search, new chat, workspace switcher.
 */

import { FolderOpen, Plus, Search, Settings, ChevronDown } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConversationItem } from '@/components/conversation/conversation-item'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { useWorkspaces, useOpenWorkspace } from '@/hooks/use-workspaces'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'

export function LeftPanel() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useUIStore((s) => s.setActiveWorkspace)

  const { data: conversations, isLoading } = useConversations()
  const { data: profiles } = useProfiles()
  const { data: workspaces = [] } = useWorkspaces()
  const openWorkspace = useOpenWorkspace()
  const createConversation = useCreateConversation()

  const defaultProfile = profiles?.find((p) => p.is_default) ?? profiles?.[0]
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId)

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
    createConversation.mutate({ profileId: defaultProfile.id })
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

  const handleSwitchWorkspace = async (workspace: typeof workspaces[0]) => {
    if (!workspace.is_open) {
      // Reopen closed workspace
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
          disabled={createConversation.isPending}
        >
          <Plus className="size-4 mr-1.5" />
          New Chat
        </Button>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-7 text-sm"
          />
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
            <p className="text-center text-xs text-muted-foreground py-8">
              {searchQuery ? 'No matches' : 'Your chat log is empty – time to start a conversation!'}
            </p>
          ) : (
            filtered?.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={c.id === activeConversationId}
                onClick={() => setActiveConversation(c.id)}
              />
            ))
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
          <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
            {workspaces.length === 0 ? (
              <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
            ) : (
              workspaces.map(w => (
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
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">(closed)</span>
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
