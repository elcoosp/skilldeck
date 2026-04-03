import {
  elementScroll,
  useVirtualizer,
  type Virtualizer
} from '@tanstack/react-virtual'
import { useElementScrollRestoration } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import * as React from 'react'
import { useSendMessage } from '@/hooks/use-messages'
import type { MessageData, NodeDocument } from '@/lib/bindings'
import { useConversationStore } from '@/store/conversation'
import { useToolApprovalStore } from '@/store/tool-approvals'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { MessageBubble } from './message-bubble'
import ThreadNavigator from './thread-navigator'
import { ToolApprovalCard } from './tool-approval-card'

export interface ScrollToken {
  messageId: string
  scrollTop: number
}

export interface MessageThreadHandle {
  scrollToMessage: (fullIndex: number, onComplete?: () => void) => void
  scrollToBottom: () => void
  getScrollElement: () => HTMLElement | null
  getScrollToken: () => ScrollToken | null
  getScrollPosition: () => number
  onScroll: (cb: () => void) => () => void
  isScrollingToMessage: () => boolean
}

interface MessageThreadProps {
  messages: MessageData[]
  conversationKey: string
  conversationId: string | null
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  searchCaseSensitive?: boolean
  searchRegex?: boolean
  highlightedMessageId?: string | null
  autoScroll?: boolean
  onVisibleUserIndexChange?: (index: number) => void
  onMessageVisible?: (messageId: string) => void
  branchParentMessageId?: string | null
  headings?: any[]
}

function distFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

const globalMeasuredSizes = new Map<string, number>()

export const ScrollContainerContext =
  React.createContext<React.RefObject<HTMLDivElement | null> | null>(null)
export const AutoScrollContext = React.createContext<boolean>(true)

interface VirtualRowProps {
  virtualItem: { index: number; start: number }
  message: MessageData
  isThisMessageStreaming: boolean
  streamingMessage: NodeDocument | null | undefined
  handleRetry: (() => Promise<undefined | null>) | undefined
  isBranchParent: boolean
  isHighlighted: boolean
  searchQuery: string | undefined
  searchCaseSensitive: boolean
  searchRegex: boolean
  measureRef: React.RefObject<(node: Element | null) => void>
  lastItemNodeRef: React.RefObject<Element | null>
  streamingRoRef: React.RefObject<ResizeObserver | null>
  isLast: boolean
}

const VirtualRow = React.memo(
  ({
    virtualItem,
    message,
    isThisMessageStreaming,
    streamingMessage,
    handleRetry,
    isBranchParent,
    isHighlighted,
    searchQuery,
    searchCaseSensitive,
    searchRegex,
    isLast,
    measureRef,
    lastItemNodeRef,
    streamingRoRef
  }: VirtualRowProps) => {
    return (
      <div
        ref={(node) => {
          measureRef.current?.(node)
          if (isLast && node !== lastItemNodeRef.current) {
            if (lastItemNodeRef.current)
              streamingRoRef.current?.unobserve(lastItemNodeRef.current)
                ; (
                  lastItemNodeRef as React.MutableRefObject<Element | null>
                ).current = node
            if (node) streamingRoRef.current?.observe(node)
          }
        }}
        data-index={virtualItem.index}
        data-msg-id={message.id}
        data-role={message.role}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualItem.start}px)`
        }}
      >
        <div className="px-4 py-1.5">
          <MessageBubble
            message={message}
            isStreaming={isThisMessageStreaming}
            isHighlighted={isHighlighted}
            searchQuery={searchQuery}
            searchCaseSensitive={searchCaseSensitive}
            searchRegex={searchRegex}
            onRetry={handleRetry}
            isBranchParent={isBranchParent}
            streamingMessage={
              isThisMessageStreaming ? streamingMessage : undefined
            }
          />
        </div>
      </div>
    )
  },
  (prev, next) => {
    if (prev.virtualItem.start !== next.virtualItem.start) return false
    if (prev.isLast !== next.isLast) return false
    if (prev.isThisMessageStreaming !== next.isThisMessageStreaming)
      return false
    if (
      next.isThisMessageStreaming &&
      prev.streamingMessage !== next.streamingMessage
    )
      return false
    if (prev.isHighlighted !== next.isHighlighted) return false
    if (prev.searchQuery !== next.searchQuery) return false
    if (prev.isBranchParent !== next.isBranchParent) return false
    return prev.message === next.message
  }
)

export const MessageThread = React.forwardRef<
  MessageThreadHandle,
  MessageThreadProps
>(
  (
    {
      messages,
      conversationKey,
      conversationId,
      streamingMessageId,
      isLoading,
      searchQuery = '',
      searchCaseSensitive = false,
      searchRegex = false,
      highlightedMessageId,
      autoScroll = true,
      onVisibleUserIndexChange,
      onMessageVisible,
      branchParentMessageId,
      headings = []
    },
    ref
  ) => {
    const streamingMessage = useUIEphemeralStore(
      React.useCallback(
        (s) => s.streamingMessages[conversationId ?? ''] ?? null,
        [conversationId]
      )
    )

    const scrollRef = React.useRef<HTMLDivElement>(null)
    const activeConversationId = useConversationStore(
      (s) => s.activeConversationId
    )
    const sendMutation = useSendMessage(activeConversationId!)

    // ─── TanStack Router Scroll Restoration ───
    const scrollRestoration = useElementScrollRestoration({
      id: `message-thread-${conversationKey}`,
      getElement: () => scrollRef.current,
      getKey: (location) => location.pathname,
    })

    const messagesWithRetry = React.useMemo(() => {
      return messages.map((msg, idx) => {
        if (msg.role === 'user' && idx + 1 < messages.length) {
          const nextMsg = messages[idx + 1]
          if (nextMsg.role === 'assistant' && nextMsg.status === 'cancelled') {
            return { ...msg, retryAvailable: true }
          }
        }
        return msg
      })
    }, [messages])

    const filteredMessages = React.useMemo(() => {
      if (!searchQuery.trim()) return messagesWithRetry
      const q = searchQuery.toLowerCase()
      return messagesWithRetry.filter((m) =>
        m.content.toLowerCase().includes(q)
      )
    }, [messagesWithRetry, searchQuery])

    const filteredMessagesRef = React.useRef(filteredMessages)
    filteredMessagesRef.current = filteredMessages

    const measuredSizesRef = React.useRef(globalMeasuredSizes)
    const isProgrammaticScrollRef = React.useRef(false)
    const userScrolledAwayRef = React.useRef(false)
    const autoScrollRef = React.useRef(autoScroll)
    autoScrollRef.current = autoScroll
    const streamingRef = React.useRef(streamingMessageId)
    streamingRef.current = streamingMessageId

    // FIX: Reset internal scroll state when conversation changes
    React.useEffect(() => {
      userScrolledAwayRef.current = false
    }, [conversationKey])

    const scrollToFn: (
      offset: number,
      options: { adjustments?: number; behavior?: ScrollBehavior },
      instance: Virtualizer<HTMLDivElement, Element>
    ) => void = React.useCallback((offset, { behavior }, instance) => {
      isProgrammaticScrollRef.current = true
      elementScroll(offset, { behavior }, instance as any)
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false
      })
    }, [])

    const avgAssistantHeightRef = React.useRef(5000)
    const updateAvgAssistantHeight = React.useCallback((newHeight: number) => {
      avgAssistantHeightRef.current = Math.round(
        avgAssistantHeightRef.current * 0.7 + newHeight * 0.3
      )
    }, [])

    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: (index) => {
        const msg = filteredMessagesRef.current[index]
        if (!msg) return 80
        const known = measuredSizesRef.current.get(msg.id)
        if (known) return known
        return msg.role === 'assistant' ? avgAssistantHeightRef.current : 80
      },
      overscan: 10,
      useAnimationFrameWithResizeObserver: true,
      measureElement: (el) => {
        const h = el.getBoundingClientRect().height
        const msgId = (el as HTMLElement).dataset.msgId
        if (msgId) {
          const role = (el as HTMLElement).dataset.role ?? 'user'
          measuredSizesRef.current.set(msgId, h)
          if (role === 'assistant' && h > 80) updateAvgAssistantHeight(h)
        }
        return h
      },
      scrollToFn,
      initialOffset: scrollRestoration?.scrollY ?? 0,
      onChange: (instance) => {
        const items = instance.getVirtualItems()
        if (items.length === 0) return
        const el = instance.scrollElement as HTMLElement | null
        const dist = el ? distFromBottom(el) : 999
        if (!autoScrollRef.current) return
        if (streamingRef.current) return
        if (userScrolledAwayRef.current) return
        if (dist === 0) {
          const lastIdx = filteredMessagesRef.current.length - 1
          if (lastIdx >= 0) {
            instance.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
          }
        }
      }
    })
    const virtualizerRef = React.useRef(virtualizer)
    virtualizerRef.current = virtualizer

    // FIX: Improved Restoration Effect
    // 1. Allow scrollY === 0 (top of page) to be restored.
    // 2. Depend on scrollRestoration?.scrollY to trigger on conversation change.
    React.useLayoutEffect(() => {
      const el = scrollRef.current
      const scrollY = scrollRestoration?.scrollY

      if (!el || scrollY === undefined) return

      isProgrammaticScrollRef.current = true

      el.scrollTop = scrollY

      virtualizerRef.current.scrollToOffset(scrollY, { behavior: 'auto' })

      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false
      })
    }, [scrollRestoration?.scrollY])

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const onScroll = () => {
        if (isProgrammaticScrollRef.current) return
        userScrolledAwayRef.current = distFromBottom(el) > 100
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => el.removeEventListener('scroll', onScroll)
    }, [])

    React.useLayoutEffect(() => {
      if (searchQuery.trim())
        virtualizerRef.current.scrollToOffset(0, { behavior: 'auto' })
    }, [searchQuery])

    React.useEffect(() => {
      if (searchQuery.trim()) virtualizerRef.current.measure()
    }, [searchQuery])

    const lastItemNodeRef = React.useRef<Element | null>(null)
    const streamingRoRef = React.useRef<ResizeObserver | null>(null)

    React.useEffect(() => {
      if (streamingRoRef.current) {
        streamingRoRef.current.disconnect()
        streamingRoRef.current = null
      }

      if (!streamingMessageId) return

      const el = scrollRef.current
      if (!el) return

      const scrollToBottom = () => {
        if (!autoScrollRef.current || userScrolledAwayRef.current) return
        isProgrammaticScrollRef.current = true
        el.scrollTop = el.scrollHeight
        isProgrammaticScrollRef.current = false
      }

      scrollToBottom()

      const ro = new ResizeObserver(scrollToBottom)
      streamingRoRef.current = ro
      if (lastItemNodeRef.current) ro.observe(lastItemNodeRef.current)

      return () => {
        ro.disconnect()
        streamingRoRef.current = null
      }
    }, [streamingMessageId])

    const callbackRef = React.useRef(onVisibleUserIndexChange)
    React.useLayoutEffect(() => {
      callbackRef.current = onVisibleUserIndexChange
    })

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el || !onVisibleUserIndexChange) return

      const filteredToFull = new Map<number, number>()
      filteredMessages.forEach((msg, fi) => {
        const fullIdx = messages.findIndex((m) => m.id === msg.id)
        if (fullIdx !== -1) filteredToFull.set(fi, fullIdx)
      })
      const userFilteredIndices = filteredMessages
        .map((m, i) => (m.role === 'user' ? i : -1))
        .filter((i) => i !== -1)

      if (userFilteredIndices.length === 0) return

      let rafId: number | null = null
      let lastReported = -1

      const updateActive = () => {
        const vItems = virtualizerRef.current.getVirtualItems()
        if (vItems.length === 0) return

        const containerRect = el.getBoundingClientRect()
        const centerY = containerRect.top + containerRect.height / 2

        let bestUserFilteredIdx = -1
        let minDistance = Infinity

        for (const ui of userFilteredIndices) {
          const msg = filteredMessages[ui]
          if (!msg) continue
          const msgElement = el.querySelector(`[data-msg-id="${msg.id}"]`)
          if (msgElement) {
            const rect = msgElement.getBoundingClientRect()
            const msgCenterY = rect.top + rect.height / 2
            const distance = Math.abs(msgCenterY - centerY)
            if (distance < minDistance) {
              minDistance = distance
              bestUserFilteredIdx = ui
            }
          }
        }

        if (bestUserFilteredIdx !== -1) {
          const fullIdx = filteredToFull.get(bestUserFilteredIdx) ?? -1
          if (fullIdx !== -1 && fullIdx !== lastReported) {
            lastReported = fullIdx
            callbackRef.current?.(fullIdx)
          }
        }
      }

      const onScroll = () => {
        if (rafId !== null) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(updateActive)
      }

      el.addEventListener('scroll', onScroll, { passive: true })
      updateActive()

      return () => {
        el.removeEventListener('scroll', onScroll)
        if (rafId !== null) cancelAnimationFrame(rafId)
      }
    }, [filteredMessages, messages, onVisibleUserIndexChange])

    React.useEffect(() => {
      const container = scrollRef.current
      if (!container || !onMessageVisible) return

      const seenMessages = new Set<string>()

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const messageId = entry.target.getAttribute('data-message-id')
              if (messageId && !seenMessages.has(messageId)) {
                seenMessages.add(messageId)
                onMessageVisible(messageId)
              }
            }
          }
        },
        { threshold: 0.5, root: container }
      )

      const elements = container.querySelectorAll('[data-message-id]')
      for (const el of elements) {
        observer.observe(el)
      }

      const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element
              const messageId = el.getAttribute('data-message-id')
              if (messageId) {
                observer.observe(el)
                const rect = el.getBoundingClientRect()
                const containerRect = container.getBoundingClientRect()
                if (
                  rect.top >= containerRect.top &&
                  rect.bottom <= containerRect.bottom
                ) {
                  if (!seenMessages.has(messageId)) {
                    seenMessages.add(messageId)
                    onMessageVisible(messageId)
                  }
                }
              }
            }
          }
        }
      })

      mutationObserver.observe(container, { childList: true, subtree: true })

      return () => {
        observer.disconnect()
        mutationObserver.disconnect()
      }
    }, [onMessageVisible])

    const pendingApprovals = useToolApprovalStore((s) => s.pending)
    const removePending = useToolApprovalStore((s) => s.removePending)

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToMessage: (fullIndex: number, onComplete?: () => void) => {
          const el = scrollRef.current
          if (!el) return
          const targetId = messages[fullIndex]?.id
          if (!targetId) return
          const fi = filteredMessagesRef.current.findIndex(
            (m) => m.id === targetId
          )
          if (fi === -1) return
          virtualizerRef.current.scrollToIndex(fi, {
            align: 'start',
            behavior: 'auto'
          })
          let lastStart = -1
          let stableTicks = 0
          const poll = () => {
            const vItems = virtualizerRef.current.getVirtualItems()
            const targetItem = vItems.find((it) => it.index === fi)
            if (!targetItem) {
              virtualizerRef.current.scrollToIndex(fi, {
                align: 'start',
                behavior: 'auto'
              })
              requestAnimationFrame(poll)
              return
            }
            const start = targetItem.start
            if (Math.abs(start - lastStart) <= 2) stableTicks++
            else stableTicks = 0
            lastStart = start
            if (stableTicks >= 3) {
              isProgrammaticScrollRef.current = true
              el.scrollTop = start
              requestAnimationFrame(() => {
                isProgrammaticScrollRef.current = false
                onComplete?.()
              })
            } else {
              virtualizerRef.current.scrollToIndex(fi, {
                align: 'start',
                behavior: 'auto'
              })
              requestAnimationFrame(poll)
            }
          }
          requestAnimationFrame(poll)
        },
        scrollToBottom: () => {
          const el = scrollRef.current
          if (!el) return
          const lastIdx = filteredMessagesRef.current.length - 1
          if (lastIdx < 0) return
          virtualizerRef.current.scrollToIndex(lastIdx, {
            align: 'end',
            behavior: 'auto'
          })
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (scrollRef.current) {
                isProgrammaticScrollRef.current = true
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                requestAnimationFrame(() => {
                  isProgrammaticScrollRef.current = false
                })
              }
            })
          })
        },
        getScrollElement: () => scrollRef.current,
        getScrollToken: () => null,
        isScrollingToMessage: () => false,
        getScrollPosition: () => scrollRef.current?.scrollTop ?? 0,
        onScroll: (cb: () => void) => {
          const el = scrollRef.current
          if (!el) return () => { }
          el.addEventListener('scroll', cb, { passive: true })
          return () => el.removeEventListener('scroll', cb)
        }
      }),
      [messages]
    )

    const virtualItems = virtualizer.getVirtualItems()
    const lastFilteredIdx = filteredMessages.length - 1
    const measureElementRef = React.useRef((node: Element | null) => {
      virtualizer.measureElement(node)
    })
    React.useEffect(() => {
      measureElementRef.current = (node) => virtualizer.measureElement(node)
    })

    return (
      <ScrollContainerContext.Provider value={scrollRef}>
        <AutoScrollContext.Provider value={autoScroll}>
          <div className="relative h-full">
            <div
              ref={scrollRef}
              id="message-thread-scroll-container"
              data-scroll-restoration-id={`message-thread-${conversationKey}`}
              className="h-full overflow-y-auto thin-scrollbar pl-6"
            >
              {isLoading && (
                <motion.div
                  className="flex items-center justify-center h-full text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Loading your conversation...</span>
                  </div>
                </motion.div>
              )}

              {!isLoading && filteredMessages.length === 0 && (
                <motion.div
                  className="flex flex-col items-center justify-center h-full text-center px-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <img
                    src="/illustrations/empty-messages.svg"
                    alt="Empty conversation"
                    className="w-48 h-48 mb-4 opacity-90"
                  />
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {searchQuery
                      ? 'No matching messages'
                      : 'This conversation is empty'}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {searchQuery
                      ? 'Try a different search term.'
                      : 'Type a message below to begin your chat with the agent.'}
                  </p>
                </motion.div>
              )}

              {!isLoading && filteredMessages.length > 0 && (
                <div
                  style={{
                    height: virtualizer.getTotalSize(),
                    position: 'relative'
                  }}
                >
                  {virtualItems.map((virtualItem) => {
                    const message = filteredMessages[virtualItem.index]
                    const isThisMessageStreaming =
                      message.id === streamingMessageId
                    const isLast = virtualItem.index === lastFilteredIdx
                    const retryAvailable = (message as any).retryAvailable
                    const handleRetry = retryAvailable
                      ? () =>
                        sendMutation.mutateAsync({ content: message.content })
                      : undefined

                    return (
                      <VirtualRow
                        key={message.id}
                        virtualItem={virtualItem}
                        message={message}
                        isThisMessageStreaming={isThisMessageStreaming}
                        streamingMessage={
                          isThisMessageStreaming ? streamingMessage : undefined
                        }
                        handleRetry={handleRetry}
                        isBranchParent={branchParentMessageId === message.id}
                        isHighlighted={message.id === highlightedMessageId}
                        isLast={isLast}
                        searchQuery={searchQuery}
                        searchCaseSensitive={searchCaseSensitive}
                        searchRegex={searchRegex}
                        measureRef={measureElementRef}
                        lastItemNodeRef={lastItemNodeRef}
                        streamingRoRef={streamingRoRef}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            {pendingApprovals.size > 0 && (
              <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3 flex flex-col gap-2 pointer-events-none">
                {Array.from(pendingApprovals.entries()).map(
                  ([toolCallId, toolCall]) => (
                    <div key={toolCallId} className="pointer-events-auto">
                      <ToolApprovalCard
                        toolCallId={toolCallId}
                        toolCall={toolCall}
                        onResolved={() => removePending(toolCallId)}
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <ThreadNavigator
            messages={messages}
            activeIndex={-1}
            activeHeadingIndex={null}
            onScrollTo={(idx) => {
              const targetMsg = messages[idx]
              if (targetMsg) {
                const fullIndex = messages.findIndex(
                  (m) => m.id === targetMsg.id
                )
                if (fullIndex !== -1) {
                  virtualizerRef.current.scrollToIndex(fullIndex, {
                    align: 'start',
                    behavior: 'auto'
                  })
                }
              }
            }}
            onHeadingClick={(_msgIdx, _tocIdx) => { }}
            headings={headings}
          />
        </AutoScrollContext.Provider>
      </ScrollContainerContext.Provider>
    )
  }
)

MessageThread.displayName = 'MessageThread'
