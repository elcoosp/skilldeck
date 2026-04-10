// src/components/conversation/message-bubble.tsx
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileText,
  GitBranch,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  User
} from 'lucide-react'
import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { toast } from '@/components/ui/toast'
import { ContextChip } from '@/components/chat/context-chip'
import { MarkdownView } from '@/components/markdown-view'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useBookmarks, useToggleBookmark } from '@/hooks/use-bookmarks'
import { useCreateBranch } from '@/hooks/use-branches'
import { useEditMessage } from '@/hooks/use-edit-message'
import { useSendMessage } from '@/hooks/use-messages'
import type { MdNode, MessageData, NodeDocument } from '@/lib/bindings'
import { cn, highlightText } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { CreateBranchModal } from './create-branch-modal'
import { ScrollContainerContext } from './message-thread'
import { SubagentCard } from './subagent-card'
import { ThinkingView } from './thinking-view'
import { ToolResultBubble } from './tool-result-bubble'

interface MessageBubbleProps {
  message: MessageData
  isStreaming?: boolean
  isHighlighted?: boolean
  searchQuery?: string
  searchCaseSensitive?: boolean
  searchRegex?: boolean
  onRetry?: () => void
  isBranchParent?: boolean
  streamingMessage?: NodeDocument | null
}

const StreamingLoading = memo(() => (
  <div className="flex items-center gap-1.5 text-muted-foreground">
    <span className="size-1.5 rounded-full bg-current animate-pulse" />
    <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:0.2s]" />
    <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:0.4s]" />
  </div>
))

const AssistantMessageActions = memo(
  ({
    message,
    conversationId,
    onCopy,
    onDownload,
    onBranch
  }: {
    message: MessageData
    conversationId: string | null
    onCopy: () => void
    onDownload: () => void
    onBranch: () => void
  }) => {
    const { data: bookmarks = [] } = useBookmarks(conversationId)
    const toggleBookmark = useToggleBookmark(conversationId)

    const isBookmarked = bookmarks.some(
      (b) => b.message_id === message.id && !b.heading_anchor
    )

    const onBookmark = useCallback(() => {
      if (!conversationId) return
      toggleBookmark.mutate({ messageId: message.id, label: 'Message' })
    }, [conversationId, message.id, toggleBookmark])

    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors"
            aria-label="Message options"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            <span>Copy</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            <span>Download</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onBranch}>
            <GitBranch className="mr-2 h-4 w-4" />
            <span>Branch from here</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onBookmark}>
            {isBookmarked ? (
              <BookmarkCheck className="mr-2 h-4 w-4 text-amber-400 fill-amber-400" />
            ) : (
              <Bookmark className="mr-2 h-4 w-4 text-amber-400/70" />
            )}
            <span>{isBookmarked ? 'Remove bookmark' : 'Bookmark'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

const CollapsibleContent = React.forwardRef<
  CollapsibleHandle,
  { initialCollapsed?: boolean; messageId: string; children: React.ReactNode }
>(({ initialCollapsed = false, children }, ref) => {
  const outerRef = useRef<HTMLDivElement>(null)
  const collapsedRef = useRef(initialCollapsed)

  React.useImperativeHandle(
    ref,
    () => ({
      collapse() {
        const el = outerRef.current
        if (!el || collapsedRef.current) return
        collapsedRef.current = true
        const currentHeight = el.scrollHeight
        el.style.maxHeight = `${currentHeight}px`
        el.style.overflow = 'hidden'
        el.getBoundingClientRect()
        el.style.transition = 'max-height 0.18s ease, opacity 0.18s ease'
        el.style.maxHeight = '0px'
        el.style.opacity = '0'
      },
      expand() {
        const el = outerRef.current
        if (!el || !collapsedRef.current) return
        collapsedRef.current = false

        const doExpand = () => {
          if (!outerRef.current) return
          const targetHeight = outerRef.current.scrollHeight
          if (targetHeight === 0) {
            requestAnimationFrame(doExpand)
            return
          }
          const el2 = outerRef.current
          el2.style.transition = 'max-height 0.18s ease, opacity 0.18s ease'
          el2.style.maxHeight = `${targetHeight}px`
          el2.style.opacity = '1'
          const onEnd = () => {
            if (outerRef.current && !collapsedRef.current) {
              outerRef.current.style.maxHeight = 'none'
              outerRef.current.style.overflow = 'visible'
              outerRef.current.style.transition = ''
            }
            el2.removeEventListener('transitionend', onEnd)
          }
          el2.addEventListener('transitionend', onEnd)
        }
        doExpand()
      },
      isCollapsed: () => collapsedRef.current
    }),
    []
  )

  return (
    <div
      ref={outerRef}
      style={{
        overflow: initialCollapsed ? 'hidden' : 'visible',
        maxHeight: initialCollapsed ? '0px' : 'none',
        opacity: initialCollapsed ? 0 : 1
      }}
    >
      {children}
    </div>
  )
})

export interface CollapsibleHandle {
  collapse: () => void
  expand: () => void
  isCollapsed: () => boolean
}

const textDocCache = new Map<string, NodeDocument>()

function getTextNodeDocument(
  messageId: string,
  content: string
): NodeDocument | null {
  if (!content) return null
  const cached = textDocCache.get(messageId)
  if (cached) return cached

  const escaped = content.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;'
    if (m === '<') return '&lt;'
    if (m === '>') return '&gt;'
    return m
  })
  const paragraphNode: MdNode = {
    type: 'paragraph',
    id: `fallback-p-${messageId}`,
    html: `<p>${escaped}</p>`
  }
  const doc: NodeDocument = {
    stable_nodes: [paragraphNode],
    draft_nodes: [],
    toc_items: [],
    artifact_specs: []
  }
  textDocCache.set(messageId, doc)
  return doc
}

function MessageBubbleInner({
  message,
  isStreaming = false,
  isHighlighted = false,
  searchQuery = '',
  searchCaseSensitive = false,
  searchRegex = false,
  onRetry,
  isBranchParent = false,
  streamingMessage
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  )
  const scrollContainer = useContext(ScrollContainerContext) as
    | React.RefObject<HTMLElement>
    | undefined

  // Thinking document from ephemeral store (during streaming)
  const thinkingDoc = useUIEphemeralStore(
    (s) => s.thinkingDocuments[activeConversationId ?? ''] ?? null
  )

  // State for user message "Show more/less" based on content length
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLongContent, setIsLongContent] = useState(false)

  const handleBranch = useCallback(() => {
    setBranchModalOpen(true)
  }, [])

  const createBranch = useCreateBranch()
  const editMessage = useEditMessage()
  const sendMessage = useSendMessage(activeConversationId!)
  const editingMessageId = useUIEphemeralStore((s) => s.editingMessageId)
  const setEditingMessageId = useUIEphemeralStore((s) => s.setEditingMessageId)

  // Check if this message is being edited
  const isEditing = editingMessageId === message.id

  // When edit mode starts, initialize edit content and focus textarea
  useEffect(() => {
    if (isEditing && !isInlineEditing) {
      setIsInlineEditing(true)
      setEditContent(message.content)
    }
  }, [isEditing, message.content, isInlineEditing])

  // Focus textarea when inline editing becomes active
  useEffect(() => {
    if (isInlineEditing && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.select()
    }
  }, [isInlineEditing])

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'
  const isSystem = message.role === 'system'
  const syntheticStreaming = message.id === '__streaming__'

  // Determine if content is long based on character count (threshold: 300 chars)
  useEffect(() => {
    if (isUser && message.content && !isStreaming && !syntheticStreaming) {
      setIsLongContent(message.content.length > 300)
    } else {
      setIsLongContent(false)
    }
  }, [isUser, message.content, isStreaming, syntheticStreaming])

  // Helper to get truncated text (first 200 chars)
  const getTruncatedText = (text: string) => {
    if (text.length <= 200) return text
    return `${text.slice(0, 200)}...`
  }

  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const clearMarks = () => {
      if (!document.contains(container)) return
      container.querySelectorAll('mark[data-search]').forEach((mark) => {
        const parent = mark.parentNode
        if (!parent || !document.contains(parent)) return
        try {
          parent.replaceChild(
            document.createTextNode(mark.textContent ?? ''),
            mark
          )
          parent.normalize()
        } catch {
          /* node removed */
        }
      })
    }

    if (!searchQuery?.trim() || !message.content) {
      clearMarks()
      return
    }
    clearMarks()
    if (!document.contains(container)) return

    let pattern = searchQuery
    if (!searchRegex)
      pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const flags = searchCaseSensitive ? 'g' : 'gi'
    let regex: RegExp
    try {
      regex = new RegExp(pattern, flags)
    } catch {
      return
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        let p = node.parentElement
        while (p && p !== container) {
          if (p.tagName === 'CODE' || p.tagName === 'PRE')
            return NodeFilter.FILTER_REJECT
          p = p.parentElement
        }
        return regex.test(node.textContent ?? '')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
      }
    })

    const textNodes: Text[] = []
    let node = walker.nextNode()
    while (node) {
      textNodes.push(node as Text)
      node = walker.nextNode()
    }

    for (const textNode of textNodes) {
      if (!textNode.parentNode || !document.contains(textNode)) continue
      const text = textNode.textContent ?? ''
      regex.lastIndex = 0
      const frag = document.createDocumentFragment()
      let last = 0
      let match = regex.exec(text)
      while (match !== null) {
        if (match.index > last)
          frag.appendChild(
            document.createTextNode(text.slice(last, match.index))
          )
        const mark = document.createElement('mark')
        mark.setAttribute('data-search', '')
        mark.style.backgroundColor = isUser
          ? 'var(--highlight-inline-user, rgba(255,255,255,0.35))'
          : 'var(--highlight-inline, rgba(250,204,21,0.4))'
        mark.style.color = 'inherit'
        mark.style.borderRadius = '2px'
        mark.textContent = match[0]
        frag.appendChild(mark)
        last = regex.lastIndex
        match = regex.exec(text)
      }
      if (last < text.length)
        frag.appendChild(document.createTextNode(text.slice(last)))
      try {
        textNode.parentNode?.replaceChild(frag, textNode)
      } catch {
        /* ignore */
      }
    }

    return clearMarks
  }, [searchQuery, searchCaseSensitive, searchRegex, message.content, isUser])

  const isQueued = useMemo(() => {
    if (!message.metadata) return false
    try {
      const meta =
        typeof message.metadata === 'string'
          ? JSON.parse(message.metadata)
          : message.metadata
      return meta.from_queue === true
    } catch {
      return false
    }
  }, [message.metadata])

  const contextItems = message.context_items || []
  const shouldHighlight = searchQuery && message.content

  const copyMessage = useCallback(async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Message copied')
  }, [message.content])

  const downloadMessage = useCallback(async () => {
    const path = await save({
      defaultPath: `message_${message.id}.txt`,
      filters: [{ name: 'Text', extensions: ['txt', 'md'] }]
    })
    if (!path) return
    try {
      await writeTextFile(path, message.content)
      toast.success('Message saved')
    } catch (err) {
      toast.error(`Failed to save: ${err}`)
    }
  }, [message.id, message.content])

  const collapsibleRef = useRef<CollapsibleHandle>(null)
  const collapsedStateRef = useRef(isSystem) // System messages start collapsed
  const [, forceUpdate] = useState(0)
  const isCollapsed = collapsedStateRef.current
  const canCollapseAssistant =
    (isAssistant || isSystem || isTool) && !isStreaming && !syntheticStreaming

  const toggleCollapsed = useCallback(() => {
    const handle = collapsibleRef.current
    if (!handle) return
    if (handle.isCollapsed()) {
      handle.expand()
      collapsedStateRef.current = false
    } else {
      handle.collapse()
      collapsedStateRef.current = true
    }
    forceUpdate((n) => n + 1)
  }, [])

  // Edit handlers
  const handleEditClick = () => {
    setEditDialogOpen(true)
  }

  const handleEditInPlace = () => {
    setEditDialogOpen(false)
    setEditingMessageId(message.id)
  }

  const handleEditNewBranch = async () => {
    setEditDialogOpen(false)
    if (!activeConversationId) {
      toast.error('No active conversation')
      return
    }
    try {
      const branchId = await createBranch.mutateAsync({
        conversation_id: activeConversationId,
        parent_message_id: message.id,
        name: `Edit of ${message.id.slice(0, 6)}`
      })
      toast.success('Branch created for editing')
      useConversationStore.getState().setActiveBranch(branchId)
    } catch (err) {
      toast.error(`Failed to create branch: ${err}`)
    }
  }

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      toast.error('Message cannot be empty')
      return
    }

    try {
      await editMessage.mutateAsync({
        messageId: message.id,
        newContent: editContent.trim()
      })
      // Resend the edited message to trigger agent
      await sendMessage.mutateAsync({
        content: editContent.trim()
      })
      setIsInlineEditing(false)
      setEditingMessageId(null)
      toast.success('Message updated and resent')
    } catch (err) {
      toast.error(`Failed to update message: ${err}`)
    }
  }

  const handleCancelEdit = () => {
    setIsInlineEditing(false)
    setEditingMessageId(null)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSaveEdit()
    }
  }

  let subagentData: any = null
  if (isAssistant && !isStreaming && message.content) {
    try {
      subagentData = JSON.parse(message.content)
    } catch {
      /* ignore */
    }
  }
  if (subagentData?.subagentId) {
    return (
      <SubagentCard
        stepName={subagentData.task || 'Subagent'}
        status="running"
        onOpen={() => { }}
      />
    )
  }

  if (isTool) {
    const parseToolContent = (
      raw: string
    ): { blocks: Array<{ type: string; text: string }>; isError: boolean } => {
      try {
        const parsed = JSON.parse(raw)
        return {
          blocks: parsed.content ?? [{ type: 'text', text: raw }],
          isError: parsed.is_error ?? false
        }
      } catch {
        return { blocks: [{ type: 'text', text: raw }], isError: false }
      }
    }

    const { blocks, isError } = parseToolContent(message.content)
    const combinedText = blocks.map((b) => b.text).join('\n\n')
    const toolName = (message.metadata as any)?.tool_name as string | undefined

    return (
      <div className="ml-10">
        <ToolResultBubble
          content={combinedText}
          toolName={toolName}
          isError={isError}
        />
      </div>
    )
  }

  // Assistant AND System messages share the same layout
  if (isAssistant || isSystem || syntheticStreaming) {
    const nodeDocument = (message as any).node_document as
      | NodeDocument
      | null
      | undefined
    const documentToRender =
      (nodeDocument != null ? nodeDocument : null) ??
      streamingMessage ??
      getTextNodeDocument(message.id, message.content)

    const showShimmer =
      (isAssistant || syntheticStreaming) && isStreaming && !documentToRender

    const contentElement = showShimmer ? (
      <StreamingLoading />
    ) : documentToRender ? (
      <MarkdownView
        document={documentToRender}
        messageId={message.id}
        className="prose prose-sm dark:prose-invert max-w-none break-words"
        conversationId={activeConversationId}
        isStreaming={isStreaming || syntheticStreaming}
        scrollContainerRef={scrollContainer}
      />
    ) : null

    if (!contentElement && !showShimmer && !documentToRender) return null

    const formatTime = (dateStr?: string) => {
      if (!dateStr) return 'just now'
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return 'just now'
        return date.toLocaleTimeString()
      } catch {
        return 'just now'
      }
    }
    const timeString = formatTime(message.created_at)

    // Avatar and role label
    const avatarIcon = isSystem ? <FileText className="size-3.5" /> : <Bot className="size-3.5" />
    const avatarClass = isSystem
      ? 'bg-blue-500/20 text-blue-500'
      : 'bg-muted text-foreground'
    const roleLabel = isSystem
      ? (message.content.startsWith('[Compacted summary of previous conversation]') ? 'System: Compacted summary' : 'System')
      : 'Assistant'

    return (
      <motion.div
        id={`msg-${message.id}`}
        className="flex flex-col max-w-full group"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex-shrink-0 size-7 rounded-full flex items-center justify-center',
              avatarClass
            )}
            aria-hidden
          >
            {avatarIcon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="text-xs font-medium">{roleLabel}</span>
              {canCollapseAssistant && (
                <motion.button
                  type="button"
                  onClick={toggleCollapsed}
                  className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors"
                  aria-label={
                    isCollapsed ? 'Expand message' : 'Collapse message'
                  }
                  whileTap={{ scale: 0.9 }}
                >
                  <motion.div
                    animate={{ rotate: isCollapsed ? 0 : 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </motion.div>
                </motion.button>
              )}
              {/* Only show actions for assistant messages, not system */}
              {isAssistant && !isStreaming && !syntheticStreaming && (
                <AssistantMessageActions
                  message={message}
                  conversationId={activeConversationId}
                  onCopy={copyMessage}
                  onDownload={downloadMessage}
                  onBranch={handleBranch}
                />
              )}
              {isAssistant &&
                !isStreaming &&
                !syntheticStreaming &&
                isBranchParent && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <GitBranch className="size-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Branch starts here</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
            </div>
          </div>
        </div>

        <div className="mt-1">
          <div
            ref={contentRef}
            data-message-id={message.id}
            className={cn(
              'relative py-2.5 pr-3.5 pl-3 text-sm leading-relaxed transition-colors duration-300',
              'bg-transparent w-full inline-block',
              isQueued && 'border-l-2 border-amber-400'
            )}
          >
            <motion.div
              className="absolute inset-0 ring-2 ring-primary/50 pointer-events-none rounded-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHighlighted ? 1 : 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ willChange: 'opacity' }}
            />

            {isQueued && (
              <span className="text-xs bg-primary-foreground/10 text-primary-foreground rounded-full px-2 py-0.5 mb-1 flex items-center gap-1 self-start">
                <Clock className="size-3" /> Queued
              </span>
            )}

            {contextItems.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {contextItems.map((item: any, idx: number) => (
                  <ContextChip
                    key={item.path || item.name || `item-${idx}`}
                    item={item}
                    readonly
                  />
                ))}
              </div>
            )}

            <CollapsibleContent
              ref={collapsibleRef}
              initialCollapsed={isSystem} // System messages start collapsed
              messageId={message.id}
            >
              {/* Thinking panel only for assistant */}
              {isAssistant && (
                <ThinkingView
                  document={
                    isStreaming
                      ? thinkingDoc
                      : (message as any).thinking_document ?? null
                  }
                  messageId={message.id}
                  conversationId={activeConversationId}
                  isStreaming={isStreaming && !!thinkingDoc}
                />
              )}
              {contentElement}
            </CollapsibleContent>
          </div>
        </div>

        {/* Bottom row - left-aligned for both assistant and system */}
        <div className="mt-1 relative h-5">
          <div className="absolute left-0 top-0 inline-flex items-center gap-2 group-hover:opacity-0 transition-opacity">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {timeString}
            </span>
          </div>
          <div className="absolute left-0 top-0 inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={copyMessage}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
            {/* No edit button for system messages */}
            {!isSystem && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                aria-label="Retry"
              >
                <RotateCcw className="size-3" />
              </button>
            )}
          </div>
        </div>

        {isAssistant && message.status === 'cancelled' && (
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            <span className="italic">Cancelled</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs text-primary hover:underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <CreateBranchModal
          open={branchModalOpen}
          onClose={() => setBranchModalOpen(false)}
          conversationId={activeConversationId!}
          parentMessageId={message.id}
        />
      </motion.div>
    )
  }

  // User message return block with "Show more/less" button at the bottom
  const displayContent =
    isLongContent && !isExpanded
      ? getTruncatedText(message.content)
      : message.content

  // Safe date formatting for user messages
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'just now'
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return 'just now'
      return date.toLocaleTimeString()
    } catch {
      return 'just now'
    }
  }
  const timeString = formatTime(message.created_at)

  // If inline editing is active, show textarea instead of content
  if (isInlineEditing && isUser) {
    return (
      <motion.div
        id={`msg-${message.id}`}
        className={cn('flex gap-3 max-w-full group', 'flex-row-reverse')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <div
          className="flex-shrink-0 size-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground mt-0.5"
          aria-hidden
        >
          <User className="size-3.5" />
        </div>

        <div className="flex flex-col items-end min-w-0 max-w-[78%]">
          <div className="w-full">
            <div className="relative px-3.5 py-2.5 rounded-xl rounded-tr-sm bg-primary text-primary-foreground block w-full">
              <Textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="min-h-[80px] w-full bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50 border-primary-foreground/20"
                placeholder="Edit your message..."
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  Save & Resend
                </Button>
              </div>
              <p className="text-xs text-primary-foreground/70 mt-2 text-right">
                Press Escape to cancel, Ctrl+Enter to save
              </p>
            </div>
          </div>
        </div>

        <CreateBranchModal
          open={branchModalOpen}
          onClose={() => setBranchModalOpen(false)}
          conversationId={activeConversationId!}
          parentMessageId={message.id}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      id={`msg-${message.id}`}
      className={cn(
        'flex gap-3 max-w-full group',
        isUser && 'flex-row-reverse'
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <div
        className={cn(
          'flex-shrink-0 size-7 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-primary text-primary-foreground mt-0.5'
            : isSystem
              ? 'bg-blue-500/20 text-blue-500 mt-0.5'
              : 'bg-muted text-foreground mt-1.5'
        )}
        aria-hidden
      >
        {isUser ? (
          <User className="size-3.5" />
        ) : isSystem ? (
          <FileText className="size-3.5" />
        ) : (
          <Bot className="size-3.5" />
        )}
      </div>

      <div
        className={cn(
          'flex flex-col min-w-0',
          isUser ? 'items-end' : 'items-start',
          'max-w-[78%]'
        )}
      >
        <div className={cn(isUser && 'text-right', 'w-full')}>
          <div
            ref={contentRef}
            data-message-id={message.id}
            className={cn(
              'relative px-3.5 py-2.5 rounded-xl text-sm leading-relaxed transition-colors duration-300',
              isUser
                ? 'bg-primary text-primary-foreground rounded-tr-sm block w-full'
                : 'bg-muted/50 inline-block',
              isQueued && 'border-l-2 border-amber-400 pl-3'
            )}
          >
            <motion.div
              className={cn(
                'absolute inset-0 ring-2 ring-primary/50 pointer-events-none rounded-inherit',
                isUser ? 'rounded-xl rounded-tr-sm' : 'rounded-xl'
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: isHighlighted ? 1 : 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ willChange: 'opacity' }}
            />

            {isQueued && (
              <span className="text-xs bg-primary-foreground/10 text-primary-foreground rounded-full px-2 py-0.5 mb-1 flex items-center gap-1 self-start">
                <Clock className="size-3" /> Queued
              </span>
            )}

            {contextItems.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {contextItems.map((item: any, idx: number) => (
                  <ContextChip
                    key={item.path || item.name || `item-${idx}`}
                    item={item}
                    readonly
                  />
                ))}
              </div>
            )}

            {/* Message content (truncated or full) */}
            {shouldHighlight ? (
              <span
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{
                  __html: highlightText(displayContent, searchQuery, {
                    caseSensitive: searchCaseSensitive,
                    isRegex: searchRegex
                  })
                }}
              />
            ) : (
              <span className="whitespace-pre-wrap break-words">
                {displayContent}
              </span>
            )}

            {/* "Show more/less" button at the bottom of the bubble */}
            {isLongContent && !isStreaming && !syntheticStreaming && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-xs font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>

        {/* Bottom row - fixed height, no layout shift, date replaced by actions on hover */}
        <div className="mt-1 relative h-5 w-full">
          <div className="absolute right-0 top-0 inline-flex items-center gap-2 group-hover:opacity-0 transition-opacity">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {timeString}
            </span>
          </div>
          <div className="absolute right-0 top-0 inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={copyMessage}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
            <button
              type="button"
              onClick={handleEditClick}
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              aria-label="Edit message"
            >
              <Pencil className="size-3" />
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                aria-label="Retry"
              >
                <RotateCcw className="size-3" />
              </button>
            )}
          </div>
        </div>

        {isUser && onRetry && (
          <div className="text-xs text-muted-foreground mt-1 flex justify-end">
            <button
              type="button"
              onClick={onRetry}
              className="text-xs text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Edit Choice Dialog */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Message</AlertDialogTitle>
            <AlertDialogDescription>
              Edit in place to replace this message, or edit on a new branch to
              preserve the original conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditNewBranch}>
              New Branch
            </AlertDialogAction>
            <AlertDialogAction onClick={handleEditInPlace}>
              Edit in Place
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateBranchModal
        open={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        conversationId={activeConversationId!}
        parentMessageId={message.id}
      />
    </motion.div>
  )
}

export const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  if (prev.isStreaming !== next.isStreaming) return false
  if (prev.isHighlighted !== next.isHighlighted) return false
  if (prev.searchQuery !== next.searchQuery) return false
  if (prev.searchCaseSensitive !== next.searchCaseSensitive) return false
  if (prev.searchRegex !== next.searchRegex) return false
  if (prev.message.id !== next.message.id) return false
  if (prev.message.role !== next.message.role) return false
  if (prev.message.metadata !== next.message.metadata) return false
  if (prev.message.context_items !== next.message.context_items) return false
  if (prev.isBranchParent !== next.isBranchParent) return false

  const syntheticStreaming = next.message.id === '__streaming__'
  if (syntheticStreaming) {
    return prev.streamingMessage === next.streamingMessage
  }

  if (next.isStreaming || prev.isStreaming) return true

  return (
    prev.message.content === next.message.content &&
    prev.streamingMessage === next.streamingMessage
  )
})
