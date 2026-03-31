// src/components/conversation/conversation-item.tsx

import { formatDistanceToNow } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Folder,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  useDeleteConversation,
  usePinConversation,
  useRenameConversation,
  useUnpinConversation
} from '@/hooks/use-conversations'
import type { ConversationSummary } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface ConversationItemProps {
  conversation: ConversationSummary
  isActive: boolean
  isDeleting?: boolean
  onDeleteStart?: (conversationId: string) => void
  onClick: () => void
  workspaceName?: string
  profileName?: string | null
  profileDeleted?: boolean
  showProfileBadge?: boolean
}

export interface SkilldeckDragDropDetail {
  type: 'enter' | 'over' | 'drop' | 'leave'
  paths: string[]
  position: { x: number; y: number }
  targetConversationId: string | null
}

export function ConversationItem({
  conversation,
  isActive,
  isDeleting,
  onDeleteStart,
  onClick,
  workspaceName,
  profileName,
  profileDeleted,
  showProfileBadge
}: ConversationItemProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [draft, setDraft] = useState(conversation.title ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLButtonElement>(null)

  const [isDragTarget, setIsDragTarget] = useState(false)
  const isDragTargetRef = useRef(false)

  const deleteMutation = useDeleteConversation()
  const renameMutation = useRenameConversation()
  const pinMutation = usePinConversation()
  const unpinMutation = useUnpinConversation()

  // Mount guard to prevent re‑animation on re‑renders (e.g., panel resize)
  const hasMounted = useRef(false)
  useEffect(() => {
    hasMounted.current = true
  }, [])

  // ── Listen to the custom drag‑drop event from GlobalDropZone ──────────────
  useEffect(() => {
    const onDragDrop = (e: Event) => {
      const { type, paths, targetConversationId } = (
        e as CustomEvent<SkilldeckDragDropDetail>
      ).detail

      const isOver = targetConversationId === conversation.id

      if (type === 'leave') {
        if (isDragTargetRef.current) {
          isDragTargetRef.current = false
          setIsDragTarget(false)
        }
        return
      }

      if (type === 'enter' || type === 'over') {
        const next = isOver
        if (next !== isDragTargetRef.current) {
          isDragTargetRef.current = next
          setIsDragTarget(next)
        }
        return
      }

      if (type === 'drop' && isOver && isDragTargetRef.current) {
        isDragTargetRef.current = false
        setIsDragTarget(false)
        if (paths.length === 0) return

        commands
          .attachFilesToConversation(conversation.id, paths)
          .then((res) => {
            if (res.status === 'error') {
              toast.error(res.error)
            } else {
              toast.success(
                `Attached ${paths.length} file(s) to "${conversation.title ?? 'conversation'}"`
              )
            }
          })
          .catch(() => toast.error('Failed to attach files'))
      }
    }

    window.addEventListener('skilldeck:drag-drop', onDragDrop)
    return () => window.removeEventListener('skilldeck:drag-drop', onDragDrop)
  }, [conversation.id, conversation.title])

  // ─────────────────────────────────────────────────────────────────────────

  const cancelRename = useCallback(() => {
    setDraft(conversation.title ?? '')
    setIsRenaming(false)
  }, [conversation.title])

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== conversation.title) {
      renameMutation.mutate({ id: conversation.id, title: trimmed })
    }
    setIsRenaming(false)
  }

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (conversation.pinned) {
      unpinMutation.mutate(conversation.id)
    } else {
      pinMutation.mutate(conversation.id)
    }
  }

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  useEffect(() => {
    if (!isRenaming) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        cancelRename()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isRenaming, cancelRename])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!isRenaming && !isDeleting) onClick()
    }
    if (e.key === 'Escape' && isRenaming) {
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
      if (Number.isNaN(date.getTime())) return 'recently'
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'recently'
    }
  })()

  return (
    <button
      ref={containerRef}
      data-conversation-id={conversation.id}
      tabIndex={0}
      onClick={() => !isRenaming && !isDeleting && onClick()}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex items-start gap-2 w-full px-2 py-2 rounded-md text-left transition-colors cursor-pointer',
        'pr-6',
        isActive
          ? 'bg-primary/10 text-foreground'
          : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground',
        isDeleting && 'pointer-events-none opacity-50',
        isDragTarget && 'ring-2 ring-inset ring-primary',
        isDragTarget && isActive && 'bg-primary/20',
        isDragTarget && !isActive && 'bg-primary/5 text-foreground'
      )}
    >
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-1 h-5">
          <AnimatePresence mode="wait" initial={false}>
            {isRenaming ? (
              <motion.div
                key="input"
                initial={hasMounted.current ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                  }}
                  disabled={renameMutation.isPending || isDeleting}
                  className="w-full h-full text-xs bg-transparent border-b border-primary outline-none px-0 leading-none box-border"
                />
              </motion.div>
            ) : (
              <motion.span
                key="title"
                initial={hasMounted.current ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs font-medium truncate leading-none"
              >
                {conversation.title ?? 'Untitled'}
              </motion.span>
            )}
          </AnimatePresence>

          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              '-my-1 -mr-1 h-5 w-5',
              conversation.pinned
                ? 'text-primary opacity-100'
                : 'opacity-0 group-hover:opacity-50'
            )}
            onClick={togglePin}
            aria-label={
              conversation.pinned ? 'Unpin conversation' : 'Pin conversation'
            }
          >
            {conversation.pinned ? (
              <Pin className="size-3 fill-primary" />
            ) : (
              <PinOff className="size-3" />
            )}
          </Button>

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

        <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5 flex items-center gap-1 flex-wrap">
          {showProfileBadge && profileName && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1 py-0',
                profileDeleted && 'text-muted-foreground border-dashed'
              )}
              title={
                profileDeleted ? 'This profile has been deleted' : undefined
              }
            >
              {profileName}
              {profileDeleted && <span className="ml-0.5">(deleted)</span>}
            </Badge>
          )}
          {conversation.pinned && (
            <span className="inline-flex items-center gap-0.5 text-primary">
              <Pin className="size-2.5 fill-primary" /> Pinned
            </span>
          )}
          {workspaceName && (
            <span className="inline-flex items-center gap-0.5 bg-muted/50 px-1 py-0.5 rounded-sm">
              <Folder className="size-2.5" />
              {workspaceName}
            </span>
          )}
          <span>
            {conversation.message_count} msg · {relativeTime}
          </span>
        </p>
      </div>

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
    </button>
  )
}
