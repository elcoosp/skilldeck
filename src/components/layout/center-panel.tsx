// src/components/layout/center-panel.tsx
/**
 * Center panel — virtualized message thread and input bar.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { ArrowDown, CaseSensitive, Regex, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BranchNav } from '@/components/conversation/branch-nav'
import { MessageInput } from '@/components/conversation/message-input'
import {
  MessageThread,
  type MessageThreadHandle,
  type ScrollToken,
} from '@/components/conversation/message-thread'
import ThreadNavigator from '@/components/conversation/thread-navigator'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { useActiveConversationWorkspaceId } from '@/hooks/use-conversations'
import { useMessagesWithStream } from '@/hooks/use-messages'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { extractHeadings } from '@/lib/markdown-toc'
import { useAssistantMessageStore } from '@/store/assistant-messages'
import { commands } from '@/lib/bindings'
import { getScrollToken, setScrollToken } from '@/lib/scroll-token'
// NEW: import the bootstrap hook
import { useConversationBootstrap } from '@/hooks/use-conversation-bootstrap'
import { useQueryClient } from '@tanstack/react-query'

// ─── Heading extraction: runs outside React, result is cached by message id ──
const headingCache = new Map<string, { contentLen: number; hasHeadings: boolean }>()

export function CenterPanel() {
  // ─── Granular UIStore selectors (primitives only — no object selectors) ───
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const activeBranchId = useUIStore((s) => s.activeBranchId)

  const scrollToMessageId = useUIStore((s) => s.scrollToMessageId)
  const setScrollToMessageId = useUIStore((s) => s.setScrollToMessageId)

  const workspaceId = useActiveConversationWorkspaceId()
  const { data: workspaces = [] } = useWorkspaces()
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId)
  const workspaceRoot = activeWorkspace?.path

  const searchQuery = useUIStore((s) => s.conversationSearchQuery)
  const setSearchQuery = useUIStore((s) => s.setConversationSearchQuery)
  const [debouncedSearch] = useDebounce(searchQuery, 300)
  const [autoScroll, setAutoScroll] = useState(true)

  // search toggles
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false)
  const [searchRegex, setSearchRegex] = useState(false)

  const threadRef = useRef<MessageThreadHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeUserMessageIndex, setActiveUserMessageIndex] = useState<number | undefined>(undefined)
  const [activeHeadingIndex, setActiveHeadingIndex] = useState<number | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── React Query client for cache invalidation ────────────────────────────
  const queryClient = useQueryClient()

  // ─── Streaming state ──────────────────────────────────────────────────────
  const { isRunning } = useAgentStream(activeConversationId)
  const messages = useMessagesWithStream(activeConversationId, activeBranchId)

  const streamingMessageId = (() => {
    if (!isRunning) return undefined
    const last = messages[messages.length - 1]
    return last?.role === 'assistant' ? last.id : undefined
  })()

  // ─── Bootstrap data: replaces separate calls for queued, draft, branches ───
  // We keep it even if not all data is used immediately; future refactors can use it.
  const { data: bootstrap, isLoading: bootstrapLoading } = useConversationBootstrap(activeConversationId)
  // We'll use bootstrap.queued instead of separate useQueuedMessages
  const queuedMessages = bootstrap?.queued ?? []

  // ─── Headings extraction for assistant messages ───────────────────────────
  const setHeadings = useAssistantMessageStore((s) => s.setHeadings)
  const clearHeadings = useAssistantMessageStore((s) => s.clearHeadings)

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.content || msg.id === '__streaming__') continue

      const cached = headingCache.get(msg.id)
      const contentLen = msg.content.length

      if (cached?.contentLen === contentLen) continue

      const headings = extractHeadings(msg.content, msg.id)
      const hasHeadings = headings.length > 0
      headingCache.set(msg.id, { contentLen, hasHeadings })

      if (hasHeadings) setHeadings(msg.id, headings)
      else clearHeadings(msg.id)
    }
  }, [messages, setHeadings, clearHeadings])

  useEffect(() => {
    return () => { headingCache.delete('__streaming__') }
  }, [activeConversationId])

  // ─── Conversation key ─────────────────────────────────────────────────────
  const activeKey = activeConversationId
    ? `${activeConversationId}_${activeBranchId ?? 'main'}`
    : undefined

  // ─── Save scroll token on conversation switch (synchronous during render) ─
  const activeKeyRef = useRef<string | undefined>(undefined)
  if (activeKeyRef.current !== activeKey) {
    if (activeKeyRef.current && threadRef.current) {
      if (!threadRef.current.isScrollingToMessage?.()) {
        const token = threadRef.current.getScrollToken()
        if (token) setScrollToken(activeKeyRef.current, token)
      }
    }
    activeKeyRef.current = activeKey
  }

  const initialScrollToken = (() => {
    if (!activeKey) return undefined
    const cached = getScrollToken(activeKey)
    if (!cached || typeof cached.messageId !== 'string') return undefined
    return cached
  })()

  // ─── Jump-to-latest + unseen badge ───────────────────────────────────────
  const realMessageCount = messages.filter(m => m.id !== '__streaming__').length
  const messagesLengthRef = useRef(realMessageCount)
  messagesLengthRef.current = realMessageCount

  const unseenCount = useMemo(() => {
    return messages.filter(m => !m.seen && m.role === 'assistant').length
  }, [messages])

  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [unseenJumpCount, setUnseenJumpCount] = useState(0)
  const lastSeenCountRef = useRef(realMessageCount)

  const initialScrollSettledRef = useRef(false)

  useEffect(() => {
    lastSeenCountRef.current = messagesLengthRef.current
    setUnseenJumpCount(0)
    setShowJumpToLatest(false)
  }, [activeKey])

  useEffect(() => {
    if (isRunning) {
      lastSeenCountRef.current = messagesLengthRef.current
      setUnseenJumpCount(0)
    }
  }, [isRunning])

  useEffect(() => {
    if (!scrollToMessageId || !messages.length) return
    const targetMessage = messages.find(m => m.id === scrollToMessageId)
    if (targetMessage) {
      const fullIndex = messages.findIndex(m => m.id === scrollToMessageId)
      threadRef.current?.scrollToMessage(fullIndex)
      setHighlightedMessageId(scrollToMessageId)
      setTimeout(() => setHighlightedMessageId(null), 800)
      setScrollToMessageId(null)
    }
  }, [scrollToMessageId, messages, setScrollToMessageId])

  // Helper to bulk-mark unseen assistant messages as seen
  const markAllUnseenAsSeen = useCallback(async () => {
    const unseenIds = messages
      .filter(m => !m.seen && m.role === 'assistant' && m.id !== '__streaming__')
      .map(m => m.id)
    if (unseenIds.length === 0) return
    try {
      await Promise.all(unseenIds.map(id => commands.markMessageSeen(id)))
      // Invalidate the messages cache so unseenCount recomputes from fresh data
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] })
    } catch (err) {
      console.error('Failed to mark messages seen:', err)
    }
  }, [messages, activeConversationId, queryClient])

  const computeShowJump = useCallback(() => {
    const el = threadRef.current?.getScrollElement()
    if (!el) return

    // If content doesn't overflow, there's nothing to jump to
    if (el.scrollHeight <= el.clientHeight + 1) {
      setShowJumpToLatest(false)
      setUnseenJumpCount(0)
      lastSeenCountRef.current = messagesLengthRef.current
      return
    }

    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100
    setShowJumpToLatest(!nearBottom && messagesLengthRef.current > 0)
    if (nearBottom) {
      lastSeenCountRef.current = messagesLengthRef.current
      setUnseenJumpCount(0)
      markAllUnseenAsSeen()
    } else {
      setUnseenJumpCount(Math.max(0, messagesLengthRef.current - lastSeenCountRef.current))
    }
  }, [markAllUnseenAsSeen])

  // Attach scroll listener with delayed initial call
  useEffect(() => {
    let unsub = () => { }
    const t = setTimeout(() => {
      const thread = threadRef.current
      if (!thread) return
      unsub = thread.onScroll(computeShowJump)
      if (initialScrollSettledRef.current) computeShowJump()
    }, 50)
    return () => { clearTimeout(t); unsub() }
  }, [activeKey, computeShowJump])

  useEffect(() => { computeShowJump() }, [realMessageCount, computeShowJump])

  const jumpToLatest = useCallback(() => {
    if (messages.length === 0) return
    threadRef.current?.scrollToBottom()
    lastSeenCountRef.current = messagesLengthRef.current
    setUnseenJumpCount(0)
    setShowJumpToLatest(false)                             // <-- NEW: eagerly hide
    markAllUnseenAsSeen()
    const lastMsg = messages[messages.length - 1]
    if (lastMsg) {
      setHighlightedMessageId(lastMsg.id)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    }
  }, [messages, markAllUnseenAsSeen])

  // ─── Scroll settled — save token after programmatic navigation ────────────
  const handleScrollSettled = useCallback((token: ScrollToken) => {
    if (activeKeyRef.current) {
      setScrollToken(activeKeyRef.current, token)
    }
    if (!initialScrollSettledRef.current) {
      initialScrollSettledRef.current = true
    }
  }, [])

  // ─── Thread navigator ─────────────────────────────────────────────────────
  const handleVisibleUserIndexChange = useCallback((index: number) => {
    setActiveUserMessageIndex(index)
  }, [])

  const handleNavigatorScrollTo = useCallback((index: number) => {
    const targetMessage = messages[index]
    if (!targetMessage) return
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    setHighlightedMessageId(targetMessage.id)
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    threadRef.current?.scrollToMessage(index)
  }, [messages])

  // ─── Active heading tracking ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = threadRef.current?.onScroll(() => {
      const scrollContainer = threadRef.current?.getScrollElement()
      if (!scrollContainer || activeUserMessageIndex == null) return

      const assistantMsgId = messages[activeUserMessageIndex + 1]?.id
      if (!assistantMsgId) return

      const bubble = scrollContainer.querySelector(`[data-msg-id="${assistantMsgId}"]`)
      if (!bubble) return

      const headingEls = Array.from(bubble.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      if (!headingEls.length) return

      const containerTop = scrollContainer.getBoundingClientRect().top
      let activeIdx = 0
      for (let i = 0; i < headingEls.length; i++) {
        const headingTop = headingEls[i].getBoundingClientRect().top
        if (headingTop - containerTop <= 32) {
          activeIdx = i
        }
      }
      setActiveHeadingIndex(prev => (prev === activeIdx ? prev : activeIdx))
    })
    return () => unsub?.()
  }, [activeUserMessageIndex, messages])

  useEffect(() => {
    setActiveHeadingIndex(null)
  }, [activeUserMessageIndex])

  // ─── Heading click handler ────────────────────────────────────────────────
  const handleHeadingClick = useCallback((messageIndex: number, tocIndex: number) => {
    const targetMsgId = messages[messageIndex]?.id
    const scrollContainer = threadRef.current?.getScrollElement()
    const userMsgIndex = messageIndex - 1
    const userMsg = messages[userMsgIndex]

    const scrollToHeading = () => {
      requestAnimationFrame(() => {
        const container = threadRef.current?.getScrollElement()
        const bubble = container?.querySelector(`[data-msg-id="${targetMsgId}"]`)
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

    const bubbleAlreadyRendered = !!scrollContainer?.querySelector(`[data-msg-id="${targetMsgId}"]`)

    if (bubbleAlreadyRendered) {
      scrollToHeading()
    } else {
      threadRef.current?.scrollToMessage(messageIndex, scrollToHeading)
    }
  }, [messages, handleVisibleUserIndexChange])

  // ─── Message visibility handler ───────────────────────────────────────────
  const handleMessageVisible = useCallback(async (messageId: string) => {
    const res = await commands.markMessageSeen(messageId)
    if (res.status === 'error') console.error('Failed to mark message seen:', res.error)
  }, [])

  // ─── Keyboard shortcut ⌘F / Ctrl+F ───────────────────────────────────────
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

  // ─── Clear search on conversation switch ─────────────────────────────────
  useEffect(() => {
    setSearchQuery('')
  }, [activeConversationId, setSearchQuery])

  const modifierKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

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
      {activeConversationId && <BranchNav conversationId={activeConversationId} />}

      {/* Search bar with toggles */}
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
                      "p-0.5 rounded transition-colors",
                      searchCaseSensitive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground"
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
                      "p-0.5 rounded transition-colors",
                      searchRegex
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Regex className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Regular expression</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <KbdGroup className="hidden sm:flex ml-1">
              <Kbd>{modifierKey}</Kbd><Kbd>F</Kbd>
            </KbdGroup>
          </div>
        </div>
        {searchQuery && (
          <Button variant="ghost" size="icon-sm" onClick={() => setSearchQuery('')} aria-label="Clear search">
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
      </div>

      {/* Message thread — no key= prop, conversationKey drives internal reset */}
      <div className="relative flex-1 min-h-0">
        <MessageThread
          ref={threadRef}
          conversationKey={activeKey ?? ''}
          messages={messages}
          streamingMessageId={streamingMessageId}
          searchQuery={debouncedSearch}
          searchCaseSensitive={searchCaseSensitive}
          searchRegex={searchRegex}
          highlightedMessageId={highlightedMessageId}
          initialScrollToken={initialScrollToken}
          autoScroll={autoScroll}
          onVisibleUserIndexChange={handleVisibleUserIndexChange}
          onScrollSettled={handleScrollSettled}
          onMessageVisible={handleMessageVisible}
        />

        {messages.length > 2 && (
          <ThreadNavigator
            messages={messages}
            activeIndex={activeUserMessageIndex}
            activeHeadingIndex={activeHeadingIndex}
            onScrollTo={handleNavigatorScrollTo}
            onHeadingClick={handleHeadingClick}
          />
        )}

        {/* Jump to latest button with unseen count badge */}
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

      {/* Input */}
      <div className="shrink-0 border-t border-border">
        <MessageInput conversationId={activeConversationId} workspaceRoot={workspaceRoot} />
      </div>
    </div>
  )
}
