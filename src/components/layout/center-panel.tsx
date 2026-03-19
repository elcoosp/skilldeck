/**
 * Center panel — virtualized message thread and input bar.
 */

import { BranchNav } from '@/components/conversation/branch-nav'
import { MessageInput } from '@/components/conversation/message-input'
import { MessageThread } from '@/components/conversation/message-thread'
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

  // Subscribe to streaming events for the active conversation.
  useAgentStream(activeConversationId)

  const messages = useMessagesWithStream(activeConversationId, activeBranchId)

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
    <div className="flex flex-col h-full">
      {/* Branch navigation bar — only shown when a branch is active and branches exist */}
      {activeConversationId && (
        <BranchNav conversationId={activeConversationId} />
      )}

      {/* Virtualized message thread */}
      <div className="flex-1 min-h-0">
        <MessageThread messages={messages} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border">
        <MessageInput conversationId={activeConversationId} workspaceRoot={workspaceRoot} />
      </div>
    </div>
  )
}
