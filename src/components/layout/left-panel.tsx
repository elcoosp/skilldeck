/**
 * Left panel — conversation list, search, new chat.
 */

import { FolderOpen, Plus, Search, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConversationItem } from '@/components/conversation/conversation-item'
import {
  useConversations,
  useCreateConversation
} from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { useUIStore } from '@/store/ui'
import { openWorkspace } from '@/lib/invoke'
import { toast } from 'sonner'

export function LeftPanel() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)

  const { data: conversations, isLoading } = useConversations()
  const { data: profiles } = useProfiles()
  const createConversation = useCreateConversation()

  const defaultProfile = profiles?.find((p) => p.is_default) ?? profiles?.[0]

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
      // Tauri dialog to pick directory is handled by the opener plugin
      await openWorkspace('.')
      toast.success('Workspace opened')
    } catch (err) {
      toast.error(`Could not open workspace: ${err}`)
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
              {searchQuery ? 'No matches' : 'No conversations yet'}
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

      {/* Footer */}
      <div className="p-3 border-t border-border shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleOpenWorkspace}
        >
          <FolderOpen className="size-3.5 mr-1.5" />
          Open Workspace
        </Button>
      </div>
    </div>
  )
}
