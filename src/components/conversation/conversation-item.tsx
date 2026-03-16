/**
 * Sidebar conversation list item with inline rename and context menu.
 */

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  useDeleteConversation,
  useRenameConversation
} from '@/hooks/use-conversations'
import type { ConversationSummary } from '@/lib/bindings'

interface ConversationItemProps {
  conversation: ConversationSummary
  isActive: boolean
  onClick: () => void
}

export function ConversationItem({
  conversation,
  isActive,
  onClick
}: ConversationItemProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draft, setDraft] = useState(conversation.title ?? '')

  const deleteMutation = useDeleteConversation()
  const renameMutation = useRenameConversation()

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== conversation.title) {
      renameMutation.mutate({ id: conversation.id, title: trimmed })
    }
    setIsRenaming(false)
  }

  // Safely compute relative time – fallback to raw date or empty string
  const relativeTime = (() => {
    try {
      const date = new Date(conversation.updated_at)
      if (isNaN(date.getTime())) {
        // If date is invalid, return a fallback
        return 'recently'
      }
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'recently'
    }
  })()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !isRenaming && onClick()}
      onKeyDown={(e) => e.key === 'Enter' && !isRenaming && onClick()}
      className={cn(
        'group flex items-start gap-2 w-full px-2 py-2 rounded-md text-left transition-colors cursor-pointer',
        isActive
          ? 'bg-primary/10 text-foreground'
          : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground'
      )}
    >
      {isRenaming ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setIsRenaming(false)
          }}
          className="flex-1 text-xs bg-transparent border-b border-primary outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {conversation.title ?? 'Untitled'}
          </p>
          <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
            {conversation.message_count} msg · {relativeTime}
          </p>
        </div>
      )}

      {!isRenaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
              onClick={(e) => e.stopPropagation()}
              aria-label="Conversation options"
            >
              <MoreHorizontal className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                setDraft(conversation.title ?? '')
                setIsRenaming(true)
              }}
            >
              <Pencil className="size-3 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                deleteMutation.mutate(conversation.id)
              }}
            >
              <Trash2 className="size-3 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
