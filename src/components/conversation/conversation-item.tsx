// src/components/conversation/conversation-item.tsx
/**
 * Sidebar conversation list item with inline rename and context menu.
 */

import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  isDeleting?: boolean
  onDeleteStart?: (conversationId: string) => void
  onClick: () => void
}

export function ConversationItem({
  conversation,
  isActive,
  isDeleting,
  onDeleteStart,
  onClick
}: ConversationItemProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draft, setDraft] = useState(conversation.title ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const deleteMutation = useDeleteConversation()
  const renameMutation = useRenameConversation()

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  // Click outside to cancel rename (without saving)
  useEffect(() => {
    if (!isRenaming) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        cancelRename();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRenaming, cancelRename]);

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== conversation.title) {
      renameMutation.mutate({ id: conversation.id, title: trimmed })
    }
    setIsRenaming(false)
  }

  const cancelRename = () => {
    setDraft(conversation.title ?? '')
    setIsRenaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelRename()
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDeleteStart?.(conversation.id)
    deleteMutation.mutate(conversation.id)
  }

  const relativeTime = (() => {
    try {
      const date = new Date(conversation.updated_at)
      if (isNaN(date.getTime())) return 'recently'
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'recently'
    }
  })()

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={() => !isRenaming && !isDeleting && onClick()}
      onKeyDown={(e) => e.key === 'Enter' && !isRenaming && !isDeleting && onClick()}
      className={cn(
        'group relative flex items-start gap-2 w-full px-2 py-2 rounded-md text-left transition-colors cursor-pointer',
        isActive
          ? 'bg-primary/10 text-foreground'
          : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground',
        isDeleting && 'pointer-events-none opacity-50'
      )}
    >
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Title row – fixed height to prevent layout shift */}
        <div className="flex items-center gap-1 h-5"> {/* h-5 = 20px, matches text-xs line height */}
          <AnimatePresence mode="wait">
            {isRenaming ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="flex-1 h-full"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleKeyDown}
                  disabled={renameMutation.isPending || isDeleting}
                  className="w-full h-full text-xs bg-transparent border-b border-primary outline-none px-0 leading-none box-border"
                />
              </motion.div>
            ) : (
              <motion.span
                key="title"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="text-xs font-medium truncate leading-none"
              >
                {conversation.title ?? 'Untitled'}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Pencil icon – only visible on hover */}
          {!isRenaming && !isDeleting && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 -my-1 -mr-1 h-5 w-5"
              onClick={(e) => {
                e.stopPropagation()
                setDraft(conversation.title ?? '')
                setIsRenaming(true)
              }}
              aria-label="Rename conversation"
            >
              <Pencil className="size-3" />
            </Button>
          )}
        </div>

        {/* Metadata – always visible */}
        <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
          {conversation.message_count} msg · {relativeTime}
        </p>
      </div>

      {/* Dropdown menu */}
      {!isRenaming && !isDeleting && (
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
              onClick={handleDelete}
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
