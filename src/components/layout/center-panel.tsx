/**
 * Center panel — virtualized message thread and input bar.
 */

import { useRef, useState, useCallback } from 'react'
import { BranchNav } from '@/components/conversation/branch-nav'
import { MessageInput } from '@/components/conversation/message-input'
import { MessageThread, type MessageThreadHandle } from '@/components/conversation/message-thread'
import { ThreadNavigator } from '@/components/conversation/thread-navigator'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { useMessagesWithStream } from '@/hooks/use-messages'
import { useUIStore } from '@/store/ui'
import { useActiveConversationWorkspaceId } from '@/hooks/use-conversations'
import { useWorkspaces } from '@/hooks/use-workspaces'

export function CenterPanel() {
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const activeBranchId = useUIStore((s) => s.activeBranchId)
  const workspaceId = useActiveConversationWorkspaceId()
  const { data: workspaces = [] } = useWorkspaces()
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId)
  const workspaceRoot = activeWorkspace?.path

  const threadRef = useRef<MessageThreadHandle>(null)

  useAgentStream(activeConversationId)

  const messages = useMessagesWithStream(activeConversationId, activeBranchId)

  // MessageThread reports the nearest user-message index directly —
  // no re-mapping needed here.
  const [activeUserMessageIndex, setActiveUserMessageIndex] = useState<number | undefined>(undefined)

  const handleVisibleUserIndexChange = useCallback((index: number) => {
    setActiveUserMessageIndex(index)
  }, [])

  const scrollToMessage = useCallback((index: number) => {
    threadRef.current?.scrollToMessage(index)
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

      {/* relative here so ThreadNavigator positions against the thread area
          only — it won't overlap the input bar or branch nav */}
      <div className="relative flex-1 min-h-0">
        <MessageThread
          ref={threadRef}
          messages={messages}
          onVisibleUserIndexChange={handleVisibleUserIndexChange}
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
        <MessageInput conversationId={activeConversationId} workspaceRoot={workspaceRoot} />
      </div>
    </div>
  )
}
