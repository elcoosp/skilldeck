import {
  useVirtualizer,
  elementScroll,
  Virtualizer
} from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import * as React from 'react'
import type { MessageData } from '@/lib/bindings'
import { MessageBubble } from './message-bubble'
import { useSendMessage } from '@/hooks/use-messages'
import { useToolApprovalStore } from '@/store/tool-approvals'
import { ToolApprovalCard } from './tool-approval-card'
import { useConversationStore } from '@/store/conversation'

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
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  searchCaseSensitive?: boolean
  searchRegex?: boolean
  highlightedMessageId?: string | null
  initialScrollToken?: ScrollToken | null
  autoScroll?: boolean
  onVisibleUserIndexChange?: (index: number) => void
  onScrollSettled?: (token: ScrollToken) => void
  /** Called when a message becomes visible (50% in view) */
  onMessageVisible?: (messageId: string) => void
  /** ID of the message where the branch starts, used to mark branch parent */
  branchParentMessageId?: string | null
}

function distFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

const globalMeasuredSizes = new Map<string, number>()

export const ScrollContainerContext = React.createContext<React.RefObject<HTMLDivElement | null> | null>(null)
export const AutoScrollContext = React.createContext<boolean>(true)

export const MessageThread = React.forwardRef<
  MessageThreadHandle,
  MessageThreadProps
>(
  (
    {
      messages,
      conversationKey,
      streamingMessageId,
      isLoading,
      searchQuery = '',
      searchCaseSensitive = false,
      searchRegex = false,
      highlightedMessageId,
      initialScrollToken,
      autoScroll = true,
      onVisibleUserIndexChange,
      onScrollSettled,
      onMessageVisible,
      branchParentMessageId,
    },
    ref
  ) => {

    const scrollRef = React.useRef<HTMLDivElement>(null)

    // Get active conversation ID for sending retry messages
    const activeConversationId = useConversationStore((s) => s.activeConversationId)
    const sendMutation = useSendMessage(activeConversationId!)

    // Add retry ability to user messages whose next assistant message is cancelled
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
      return messagesWithRetry.filter((m) => m.content.toLowerCase().includes(q))
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
    const onScrollSettledRef = React.useRef(onScrollSettled)
    onScrollSettledRef.current = onScrollSettled

    const prevConversationKeyRef = React.useRef(conversationKey)
    const initialScrollTokenRef = React.useRef(initialScrollToken)
    const isSwitchingRef = React.useRef(false)

    if (prevConversationKeyRef.current !== conversationKey) {
      prevConversationKeyRef.current = conversationKey
      initialScrollTokenRef.current = initialScrollToken
      isSwitchingRef.current = true
    }

    const navigatorActiveRef = React.useRef(false)
    const autoScrollReadyRef = React.useRef(false)

    const scrollToFn: (
      offset: number,
      options: { behavior?: ScrollBehavior },
      instance: Virtualizer<Element, Element>
    ) => void = React.useCallback((offset, { behavior }, instance) => {
      isProgrammaticScrollRef.current = true
      elementScroll(offset, { behavior }, instance)
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
      onChange: (instance) => {
        const items = instance.getVirtualItems()
        if (items.length === 0) return
        const el = instance.scrollElement as HTMLElement | null
        const dist = el ? distFromBottom(el) : 999
        if (!autoScrollRef.current) return
        if (streamingRef.current) return
        if (userScrolledAwayRef.current) return
        if (!autoScrollReadyRef.current) return
        if (navigatorActiveRef.current) return
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

    const applyScrollTop = React.useCallback(
      (
        el: HTMLElement,
        savedScrollTop: number,
        onLanded: (actual: number) => void,
        maxAttempts = 60
      ) => {
        let attempts = 0
        const tryApply = () => {
          const maxScroll = el.scrollHeight - el.clientHeight
          if (maxScroll >= savedScrollTop || attempts >= maxAttempts) {
            const final = Math.min(savedScrollTop, Math.max(0, maxScroll))
            isProgrammaticScrollRef.current = true
            el.scrollTop = final
            requestAnimationFrame(() => {
              isProgrammaticScrollRef.current = false
              requestAnimationFrame(() => {
                onLanded(el.scrollTop)
              })
            })
          } else {
            attempts++
            requestAnimationFrame(tryApply)
          }
        }
        requestAnimationFrame(tryApply)
      },
      []
    )

    React.useLayoutEffect(() => {
      if (!isSwitchingRef.current) return
      isSwitchingRef.current = false
      const el = scrollRef.current
      if (!el) return
      navigatorActiveRef.current = false
      autoScrollReadyRef.current = false
      userScrolledAwayRef.current = false
      const token = initialScrollTokenRef.current
      if (token?.scrollTop) {
        applyScrollTop(el, token.scrollTop, (actual) => {
          if (onScrollSettledRef.current && token.messageId) {
            onScrollSettledRef.current({ messageId: token.messageId, scrollTop: actual })
          }
        })
      } else {
        const lastIdx = filteredMessagesRef.current.length - 1
        if (lastIdx >= 0) {
          virtualizerRef.current.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
        }
        autoScrollReadyRef.current = true
      }
    })

    const didMountRef = React.useRef(false)
    React.useLayoutEffect(() => {
      if (didMountRef.current) return
      didMountRef.current = true
      const el = scrollRef.current
      if (!el) return
      const token = initialScrollTokenRef.current
      if (token?.scrollTop) {
        applyScrollTop(el, token.scrollTop, (actual) => {
          if (onScrollSettledRef.current && token.messageId) {
            onScrollSettledRef.current({ messageId: token.messageId, scrollTop: actual })
          }
        })
      } else {
        const lastIdx = filteredMessagesRef.current.length - 1
        if (lastIdx >= 0) {
          virtualizerRef.current.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
        }
        autoScrollReadyRef.current = true
      }
    }, [applyScrollTop])

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const onScroll = () => {
        if (isProgrammaticScrollRef.current) return
        if (navigatorActiveRef.current) navigatorActiveRef.current = false
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

    // ─── Streaming auto-scroll with requestAnimationFrame to avoid layout thrashing ───
    React.useEffect(() => {
      if (streamingRoRef.current) {
        streamingRoRef.current.disconnect()
        streamingRoRef.current = null
      }
      if (!streamingMessageId) {
        userScrolledAwayRef.current = false
        return
      }
      userScrolledAwayRef.current = false
      const el = scrollRef.current
      if (!el) return

      const scrollToBottom = () => {
        if (!autoScrollRef.current || userScrolledAwayRef.current) return
        // Schedule the scroll in the next animation frame to separate read/write phases.
        requestAnimationFrame(() => {
          if (!autoScrollRef.current || userScrolledAwayRef.current) return
          isProgrammaticScrollRef.current = true
          el.scrollTop = el.scrollHeight
          requestAnimationFrame(() => {
            isProgrammaticScrollRef.current = false
          })
        })
      }

      // Trigger an immediate scroll to catch any already-rendered content.
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
    React.useLayoutEffect(() => { callbackRef.current = onVisibleUserIndexChange })

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

      let lastReported = -1
      const report = () => {
        if (navigatorActiveRef.current) return
        const vItems = virtualizerRef.current.getVirtualItems()
        if (vItems.length === 0) return
        const scrollTop = el.scrollTop
        let topItem = vItems[0]
        for (const item of vItems) {
          if (item.start <= scrollTop) topItem = item
          else break
        }
        let best = userFilteredIndices[0]
        for (const ui of userFilteredIndices) {
          if (ui <= topItem.index) best = ui
          else break
        }
        const fullIdx = filteredToFull.get(best) ?? -1
        if (fullIdx !== -1 && fullIdx !== lastReported) {
          lastReported = fullIdx
          callbackRef.current?.(fullIdx)
        }
      }

      el.addEventListener('scroll', report, { passive: true })
      const t = setTimeout(report, 50)
      return () => { clearTimeout(t); el.removeEventListener('scroll', report) }
    }, [filteredMessages, messages, onVisibleUserIndexChange])

    // Intersection Observer for marking messages as seen
    React.useEffect(() => {
      const container = scrollRef.current
      if (!container || !onMessageVisible) return

      const seenMessages = new Set<string>()

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const messageId = entry.target.getAttribute('data-message-id')
              if (messageId && !seenMessages.has(messageId)) {
                seenMessages.add(messageId)
                onMessageVisible(messageId)
              }
            }
          })
        },
        { threshold: 0.5, root: container }
      )

      // Observe existing messages
      const elements = container.querySelectorAll('[data-message-id]')
      elements.forEach((el) => observer.observe(el))

      // MutationObserver to handle dynamically added messages
      const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element
              const messageId = el.getAttribute('data-message-id')
              if (messageId) {
                observer.observe(el)
                // Check visibility immediately (might be in view due to auto-scroll)
                const rect = el.getBoundingClientRect()
                const containerRect = container.getBoundingClientRect()
                if (rect.top >= containerRect.top && rect.bottom <= containerRect.bottom) {
                  if (!seenMessages.has(messageId)) {
                    seenMessages.add(messageId)
                    onMessageVisible(messageId)
                  }
                }
              }
            }
          })
        })
      })

      mutationObserver.observe(container, { childList: true, subtree: true })

      return () => {
        observer.disconnect()
        mutationObserver.disconnect()
      }
    }, [onMessageVisible, scrollRef.current])

    // NEW: Get pending approvals from store
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
          const fi = filteredMessagesRef.current.findIndex((m) => m.id === targetId)
          if (fi === -1) return
          navigatorActiveRef.current = true
          virtualizerRef.current.scrollToIndex(fi, { align: 'start', behavior: 'auto' })
          let lastStart = -1
          let stableTicks = 0
          const poll = () => {
            if (!navigatorActiveRef.current) return
            const vItems = virtualizerRef.current.getVirtualItems()
            const targetItem = vItems.find((it) => it.index === fi)
            if (!targetItem) {
              virtualizerRef.current.scrollToIndex(fi, { align: 'start', behavior: 'auto' })
              requestAnimationFrame(poll)
              return
            }
            const start = targetItem.start
            if (Math.abs(start - lastStart) <= 2) stableTicks++
            else stableTicks = 0
            lastStart = start
            if (stableTicks >= 3) {
              navigatorActiveRef.current = false
              isProgrammaticScrollRef.current = true
              el.scrollTop = start
              requestAnimationFrame(() => {
                isProgrammaticScrollRef.current = false
                if (onScrollSettledRef.current) {
                  const msg = filteredMessagesRef.current[fi]
                  if (msg) onScrollSettledRef.current({ messageId: msg.id, scrollTop: start })
                }
                onComplete?.()
              })
            } else {
              virtualizerRef.current.scrollToIndex(fi, { align: 'start', behavior: 'auto' })
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
          virtualizerRef.current.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (scrollRef.current) {
                isProgrammaticScrollRef.current = true
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                requestAnimationFrame(() => { isProgrammaticScrollRef.current = false })
              }
            })
          })
        },

        getScrollElement: () => scrollRef.current,
        getScrollToken: (): ScrollToken | null => {
          if (navigatorActiveRef.current) return null
          const el = scrollRef.current
          if (!el) return null
          const vItems = virtualizerRef.current.getVirtualItems()
          if (vItems.length === 0) return null
          const scrollTop = el.scrollTop
          let topItem = vItems[0]
          for (const item of vItems) {
            if (item.start <= scrollTop) topItem = item
            else break
          }
          const msg = filteredMessagesRef.current[topItem.index]
          if (!msg) return null
          return { messageId: msg.id, scrollTop }
        },

        isScrollingToMessage: () => navigatorActiveRef.current,
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

    return (
      <ScrollContainerContext.Provider value={scrollRef}>
        <AutoScrollContext.Provider value={autoScroll}>
          <div className="relative h-full">
            <div ref={scrollRef} className="h-full overflow-y-auto thin-scrollbar">
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
                    {searchQuery ? 'No matching messages' : 'This conversation is empty'}
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
                    const isLast = virtualItem.index === lastFilteredIdx
                    const retryAvailable = (message as any).retryAvailable
                    const handleRetry = retryAvailable
                      ? () => sendMutation.mutateAsync({ content: message.content })
                      : undefined
                    const isBranchParent = branchParentMessageId === message.id

                    return (
                      <div
                        key={message.id}
                        ref={(node) => {
                          virtualizer.measureElement(node)
                          if (isLast) {
                            if (node !== lastItemNodeRef.current) {
                              if (lastItemNodeRef.current && streamingRoRef.current) {
                                streamingRoRef.current.unobserve(lastItemNodeRef.current)
                              }
                              lastItemNodeRef.current = node
                              if (node && streamingRoRef.current) {
                                streamingRoRef.current.observe(node)
                              }
                            }
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
                            isStreaming={message.id === streamingMessageId}
                            isHighlighted={message.id === highlightedMessageId}
                            searchQuery={searchQuery.trim() ? searchQuery : undefined}
                            searchCaseSensitive={searchCaseSensitive}
                            searchRegex={searchRegex}
                            onRetry={handleRetry}
                            isBranchParent={isBranchParent}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* NEW: Render pending tool approvals as an absolute overlay */}
            {pendingApprovals.size > 0 && (
              <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3 flex flex-col gap-2 pointer-events-none">
                {Array.from(pendingApprovals.entries()).map(([toolCallId, toolCall]) => (
                  <div key={toolCallId} className="pointer-events-auto">
                    <ToolApprovalCard
                      toolCallId={toolCallId}
                      toolCall={toolCall}
                      onResolved={() => removePending(toolCallId)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </AutoScrollContext.Provider>
      </ScrollContainerContext.Provider>
    )
  }
)

MessageThread.displayName = 'MessageThread'
