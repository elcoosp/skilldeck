import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  ArrowDown,
  CaseSensitive,
  Regex,
  Search,
  Share2,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { useDebounce } from 'use-debounce'
import { z } from 'zod'
import { BranchNav } from '@/components/conversation/branch-nav'
import { MessageInput } from '@/components/conversation/message-input'
import {
  MessageThread,
  type MessageThreadHandle
} from '@/components/conversation/message-thread'
import ThreadNavigator from '@/components/conversation/thread-navigator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { useBranches } from '@/hooks/use-branches'
import { useConversationBootstrap } from '@/hooks/use-conversation-bootstrap'
import { useActiveConversationWorkspaceId } from '@/hooks/use-conversations'
import { useMessagesWithStream } from '@/hooks/use-messages'
import { useScrollToMessage } from '@/hooks/use-scroll-to-message'
import { useWorkspaces } from '@/hooks/use-workspaces'
import type { MessageData } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'

export const conversationSearchSchema = z.object({
  messageId: z.string().optional(),
  branchId: z.string().optional(),
  conversationSearch: z.string().optional(),
  autoScroll: z
    .string()
    .transform((v) => v !== 'false')
    .optional()
})

export const Route = createFileRoute('/_app/conversations/$conversationId')({
  validateSearch: conversationSearchSchema,
  component: ConversationView,
  notFoundComponent: () => <ConversationNotFound />
})

function ConversationView() {
  const { conversationId } = Route.useParams()
  const setActiveConversation = useConversationStore(
    (s) => s.setActiveConversation
  )

  // Sync URL param to store
  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId)
    }
  }, [conversationId, setActiveConversation])
  const searchQuery = useUIEphemeralStore((s) => s.conversationSearchQuery)
  const setSearchQuery = useUIEphemeralStore(
    (s) => s.setConversationSearchQuery
  )

  const workspaceId = useActiveConversationWorkspaceId()
  const { data: workspaces = [] } = useWorkspaces()
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId)
  const workspaceRoot = activeWorkspace?.path

  const [debouncedSearch] = useDebounce(searchQuery, 300)
  const [autoScroll, setAutoScroll] = useState(true)
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false)
  const [searchRegex, setSearchRegex] = useState(false)

  const threadRef = useRef<MessageThreadHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeUserMessageIndex, setActiveUserMessageIndex] = useState<
    number | undefined
  >(undefined)
  const [activeHeadingIndex, setActiveHeadingIndex] = useState<number | null>(
    null
  )
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const queryClient = useQueryClient()
  const [sharing, setSharing] = useState(false)

  const { isRunning } = useAgentStream(conversationId)
  const messages = useMessagesWithStream(conversationId, null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const streamingMessageId = (() => {
    if (!isRunning) return undefined
    const last = messages[messages.length - 1]
    return last?.role === 'assistant' ? last.id : undefined
  })()

  const { data: bootstrap, isLoading: bootstrapLoading } =
    useConversationBootstrap(conversationId)
  const headings = bootstrap?.headings ?? []
  const { data: branches = [] } = useBranches(conversationId)
  const activeBranchId = null // TODO: from URL
  const currentBranch = branches.find((b) => b.id === activeBranchId)
  const branchParentMessageId = currentBranch?.parent_message_id ?? null
  const scrollToMessageId = useScrollToMessage()

  // All hooks are now at the top, before any conditional return.
  // Now we can conditionally render based on loading/not found.
  const showNotFound = !bootstrapLoading && !bootstrap

  useEffect(() => {
    if (!scrollToMessageId || !messages.length) return
    const targetMessage = messages.find((m) => m.id === scrollToMessageId)
    if (!targetMessage) return
    const raf = requestAnimationFrame(() => {
      const fullIndex = messages.findIndex((m) => m.id === scrollToMessageId)
      threadRef.current?.scrollToMessage(fullIndex)
      setHighlightedMessageId(scrollToMessageId)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = setTimeout(
        () => setHighlightedMessageId(null),
        800
      )
    })
    return () => cancelAnimationFrame(raf)
  }, [scrollToMessageId, messages])

  const realMessageCount = messages.filter(
    (m) => m.id !== '__streaming__'
  ).length
  const messagesLengthRef = useRef(realMessageCount)
  messagesLengthRef.current = realMessageCount
  const locallySeenRef = useRef<Set<string>>(new Set())

  const unseenCount = useMemo(() => {
    return messages.filter(
      (m) =>
        !m.seen &&
        !locallySeenRef.current.has(m.id) &&
        m.role === 'assistant' &&
        m.id !== '__streaming__'
    ).length
  }, [messages])

  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [, setUnseenJumpCount] = useState(0)
  const lastSeenCountRef = useRef(realMessageCount)
  const initialScrollSettledRef = useRef(false)

  useEffect(() => {
    lastSeenCountRef.current = messagesLengthRef.current
    setUnseenJumpCount(0)
    setShowJumpToLatest(false)
    locallySeenRef.current = new Set()
  }, [])

  useEffect(() => {
    if (isRunning) {
      lastSeenCountRef.current = messagesLengthRef.current
      setUnseenJumpCount(0)
    }
  }, [isRunning])

  const markMessagesSeenByIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const convId = conversationId
      if (!convId) return
      const idSet = new Set(ids)
      for (const id of idSet) locallySeenRef.current.add(id)
      queryClient.setQueriesData<MessageData[]>(
        { queryKey: ['messages', convId] },
        (old) => old?.map((m) => (idSet.has(m.id) ? { ...m, seen: true } : m))
      )
      Promise.all(ids.map((id) => commands.markMessageSeen(id))).catch((err) =>
        console.error('Failed to mark messages seen:', err)
      )
    },
    [queryClient, conversationId]
  )

  const markAllUnseenAsSeen = useCallback(() => {
    const currentMessages = messagesRef.current
    const unseenIds = currentMessages
      .filter(
        (m) =>
          !m.seen &&
          !locallySeenRef.current.has(m.id) &&
          m.role === 'assistant' &&
          m.id !== '__streaming__'
      )
      .map((m) => m.id)
    if (unseenIds.length === 0) return
    markMessagesSeenByIds(unseenIds)
  }, [markMessagesSeenByIds])

  const computeShowJump = useCallback(() => {
    const el = threadRef.current?.getScrollElement()
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + 1) {
      setShowJumpToLatest(false)
      setUnseenJumpCount(0)
      lastSeenCountRef.current = messagesLengthRef.current
      markAllUnseenAsSeen()
      return
    }
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100
    setShowJumpToLatest(!nearBottom && messagesLengthRef.current > 0)
    if (nearBottom) {
      lastSeenCountRef.current = messagesLengthRef.current
      setUnseenJumpCount(0)
      markAllUnseenAsSeen()
    } else {
      setUnseenJumpCount(
        Math.max(0, messagesLengthRef.current - lastSeenCountRef.current)
      )
    }
  }, [markAllUnseenAsSeen])

  useEffect(() => {
    let unsub = () => { }
    const t = setTimeout(() => {
      const thread = threadRef.current
      if (!thread) return
      unsub = thread.onScroll(computeShowJump)
      if (initialScrollSettledRef.current) computeShowJump()
    }, 50)
    return () => {
      clearTimeout(t)
      unsub()
    }
  }, [computeShowJump])

  useEffect(() => {
    computeShowJump()
  }, [computeShowJump])

  const jumpToLatest = useCallback(() => {
    if (messages.length === 0) return
    threadRef.current?.scrollToBottom()
    lastSeenCountRef.current = messagesLengthRef.current
    setUnseenJumpCount(0)
    setShowJumpToLatest(false)
    markAllUnseenAsSeen()
    const lastMsg = messages[messages.length - 1]
    if (lastMsg) {
      setHighlightedMessageId(lastMsg.id)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = setTimeout(
        () => setHighlightedMessageId(null),
        800
      )
    }
  }, [messages, markAllUnseenAsSeen])

  const handleVisibleUserIndexChange = useCallback((index: number) => {
    setActiveUserMessageIndex(index)
  }, [])

  const handleNavigatorScrollTo = useCallback(
    (index: number) => {
      const targetMessage = messages[index]
      if (!targetMessage) return
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      setHighlightedMessageId(targetMessage.id)
      highlightTimeoutRef.current = setTimeout(
        () => setHighlightedMessageId(null),
        800
      )
      threadRef.current?.scrollToMessage(index)
    },
    [messages]
  )

  useEffect(() => {
    const unsub = threadRef.current?.onScroll(() => {
      const scrollContainer = threadRef.current?.getScrollElement()
      if (!scrollContainer || activeUserMessageIndex == null) return
      const assistantMsgId = messages[activeUserMessageIndex + 1]?.id
      if (!assistantMsgId) return
      const bubble = scrollContainer.querySelector(
        `[data-msg-id="${assistantMsgId}"]`
      )
      if (!bubble) return
      const headingEls = Array.from(
        bubble.querySelectorAll('h1,h2,h3,h4,h5,h6')
      )
      if (!headingEls.length) return
      const containerTop = scrollContainer.getBoundingClientRect().top
      let activeIdx = 0
      for (let i = 0; i < headingEls.length; i++) {
        const headingTop = headingEls[i].getBoundingClientRect().top
        if (headingTop - containerTop <= 32) {
          activeIdx = i
        }
      }
      setActiveHeadingIndex((prev) => (prev === activeIdx ? prev : activeIdx))
    })
    return () => unsub?.()
  }, [activeUserMessageIndex, messages])

  useEffect(() => {
    setActiveHeadingIndex(null)
  }, [])

  const handleHeadingClick = useCallback(
    (messageIndex: number, tocIndex: number) => {
      const targetMsgId = messages[messageIndex]?.id
      const scrollContainer = threadRef.current?.getScrollElement()
      const userMsgIndex = messageIndex - 1
      const userMsg = messages[userMsgIndex]
      const scrollToHeading = () => {
        requestAnimationFrame(() => {
          const container = threadRef.current?.getScrollElement()
          const bubble = container?.querySelector(
            `[data-msg-id="${targetMsgId}"]`
          )
          if (!bubble || !container) return
          const headingEls = bubble.querySelectorAll('h1,h2,h3,h4,h5,h6')
          const target = headingEls[tocIndex]
          if (!target) return
          const targetRect = (target as HTMLElement).getBoundingClientRect()
          if (targetRect.top === 0 && targetRect.bottom === 0) return
          const elTop = targetRect.top
          const containerTop = container.getBoundingClientRect().top
          container.scrollTop += elTop - containerTop - 16
          if (userMsg) handleVisibleUserIndexChange(userMsgIndex)
        })
      }
      const bubbleAlreadyRendered = !!scrollContainer?.querySelector(
        `[data-msg-id="${targetMsgId}"]`
      )
      if (bubbleAlreadyRendered) {
        scrollToHeading()
      } else {
        threadRef.current?.scrollToMessage(messageIndex, scrollToHeading)
      }
    },
    [messages, handleVisibleUserIndexChange]
  )

  const handleMessageVisible = useCallback(
    (messageId: string) => {
      if (locallySeenRef.current.has(messageId)) return
      markMessagesSeenByIds([messageId])
    },
    [markMessagesSeenByIds]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    setSearchQuery('')
  }, [setSearchQuery])

  const modifierKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

  const handleShare = async () => {
    if (!conversationId) return
    setSharing(true)
    try {
      const syncRes = await commands.checkSyncStatus(conversationId)
      if (syncRes.status === 'error') {
        console.error('Sync status check failed:', syncRes.error)
        toast.error('Could not check sync status')
        return
      }
      if (!syncRes.data.is_synced) {
        const title = bootstrap?.title || 'Shared Conversation'
        const syncPayload = {
          title,
          messages: messages
            .filter((m) => m.id !== '__streaming__')
            .map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              created_at: m.created_at,
              branch_id: null
            }))
        }
        const syncConvRes = await commands.syncConversationToPlatform(
          conversationId,
          syncPayload
        )
        if (syncConvRes.status === 'error') {
          toast.error('Failed to sync conversation')
          return
        }
      }
      const shareRes = await commands.shareConversation(conversationId)
      if (shareRes.status === 'error') {
        toast.error('Failed to create share link')
        return
      }
      const shareUrl = `skilldeck://shared/${shareRes.data.share_token}`
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Share link copied to clipboard!')
    } catch (err) {
      console.error('Share failed:', err)
      toast.error('Failed to share conversation')
    } finally {
      setSharing(false)
    }
  }

  if (showNotFound) {
    return <ConversationNotFound />
  }

  return (
    <div className="relative flex flex-col h-full">
      <BranchNav conversationId={conversationId} />

      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-16 h-8 text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSearchCaseSensitive(!searchCaseSensitive)}
                    className={cn(
                      'p-0.5 rounded transition-colors',
                      searchCaseSensitive
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <CaseSensitive className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Case sensitive</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSearchRegex(!searchRegex)}
                    className={cn(
                      'p-0.5 rounded transition-colors',
                      searchRegex
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Regex className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Regular expression</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <KbdGroup className="hidden sm:flex ml-1">
              <Kbd>{modifierKey}</Kbd>
              <Kbd>F</Kbd>
            </KbdGroup>
          </div>
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
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="size-3 accent-primary cursor-pointer"
          />
          Auto-scroll
        </label>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleShare}
          disabled={sharing || !conversationId}
          title="Share this conversation"
          className="shrink-0"
        >
          {sharing ? (
            <div className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Share2 className="size-3.5" />
          )}
        </Button>
      </div>

      <div className="relative flex-1 min-h-0">
        <MessageThread
          key={conversationId}
          ref={threadRef}
          conversationKey={conversationId}
          conversationId={conversationId}
          messages={messages}
          streamingMessageId={streamingMessageId}
          searchQuery={debouncedSearch}
          searchCaseSensitive={searchCaseSensitive}
          searchRegex={searchRegex}
          highlightedMessageId={highlightedMessageId}
          autoScroll={autoScroll}
          onVisibleUserIndexChange={handleVisibleUserIndexChange}
          onMessageVisible={handleMessageVisible}
          branchParentMessageId={branchParentMessageId}
        />

        {messages.length > 2 && (
          <ThreadNavigator
            messages={messages}
            activeIndex={activeUserMessageIndex}
            activeHeadingIndex={activeHeadingIndex}
            onScrollTo={handleNavigatorScrollTo}
            onHeadingClick={handleHeadingClick}
            headings={headings}
          />
        )}

        <button
          type="button"
          onClick={jumpToLatest}
          className={cn(
            'absolute bottom-4 right-4 z-30 flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            showJumpToLatest
              ? 'opacity-100 visible pointer-events-auto'
              : 'opacity-0 invisible pointer-events-none'
          )}
          aria-label="Jump to latest message"
          title="Jump to latest"
        >
          <ArrowDown className="size-4" />
          {unseenCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center px-1 leading-none">
              {unseenCount > 99 ? '99+' : unseenCount}
            </span>
          )}
        </button>
      </div>

      <div className="shrink-0">
        <MessageInput
          conversationId={conversationId}
          workspaceRoot={workspaceRoot}
        />
      </div>
    </div>
  )
}

function ConversationNotFound() {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-2xl font-bold">Conversation not found</h1>
      <p className="text-muted-foreground">
        The conversation you're looking for doesn't exist or has been deleted.
      </p>
      <Button onClick={() => router.navigate({ to: '/' })}>Go to Home</Button>
    </div>
  )
}
