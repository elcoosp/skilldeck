/**
 * Center panel — virtualized message thread and input bar.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BranchNav } from '@/components/conversation/branch-nav'
import { MessageInput } from '@/components/conversation/message-input'
import {
  MessageThread,
  type MessageThreadHandle
} from '@/components/conversation/message-thread'
import { ThreadNavigator } from '@/components/conversation/thread-navigator'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { useActiveConversationWorkspaceId } from '@/hooks/use-conversations'
import { useMessagesWithStream } from '@/hooks/use-messages'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useUIStore } from '@/store/ui'

export function CenterPanel() {
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const activeBranchId = useUIStore((s) => s.activeBranchId)
  const workspaceId = useActiveConversationWorkspaceId()
  const { data: workspaces = [] } = useWorkspaces()
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId)
  const workspaceRoot = activeWorkspace?.path

  // Within-conversation search state
  const searchQuery = useUIStore((s) => s.conversationSearchQuery)
  const setSearchQuery = useUIStore((s) => s.setConversationSearchQuery)
  const [debouncedSearch] = useDebounce(searchQuery, 300)

  const threadRef = useRef<MessageThreadHandle>(null)

  useAgentStream(activeConversationId)

  const messages = useMessagesWithStream(activeConversationId, activeBranchId)

  const [activeUserMessageIndex, setActiveUserMessageIndex] = useState<
    number | undefined
  >(undefined)

  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleVisibleUserIndexChange = useCallback((index: number) => {
    setActiveUserMessageIndex(index)
  }, [])

  const scrollToMessage = useCallback(
    (index: number) => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }

      const targetMessage = messages[index]
      if (targetMessage) {
        setHighlightedMessageId(targetMessage.id)
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedMessageId(null)
        }, 800)
      }

      threadRef.current?.scrollToMessage(index)
    },
    [messages]
  )

  // Clear search when conversation changes
  useEffect(() => {
    setSearchQuery('')
  }, [activeConversationId, setSearchQuery])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  if (!activeConversationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
          <span className="text-2xl">✦</span>
        </div>
        <h2 className="text-lg font-medium">Welcome to SkillDeck</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Pick a thread or create a new one to get chatting.
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full">
      {activeConversationId && (
        <BranchNav conversationId={activeConversationId} />
      )}

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search in this conversation… (⌘F)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        <MessageThread
          ref={threadRef}
          messages={messages}
          searchQuery={debouncedSearch}
          onVisibleUserIndexChange={handleVisibleUserIndexChange}
          highlightedMessageId={highlightedMessageId}
        />

        {messages.length > 2 && (
          <ThreadNavigator
            messages={messages}
            onScrollTo={scrollToMessage}
            activeIndex={activeUserMessageIndex}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-border">
        <MessageInput
          conversationId={activeConversationId}
          workspaceRoot={workspaceRoot}
        />
      </div>
    </div>
  )
}
