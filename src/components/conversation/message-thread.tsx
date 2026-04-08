// src/components/conversation/message-thread.tsx

import { useQueryClient } from '@tanstack/react-query'
import { useElementScrollRestoration } from '@tanstack/react-router'
import {
  elementScroll,
  useVirtualizer,
  type Virtualizer
} from '@tanstack/react-virtual'
import { invoke } from '@tauri-apps/api/core'
import { motion } from 'framer-motion'
import { GitBranch } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSendMessage } from '@/hooks/use-messages'
import { useWorkspaceGitStatus } from '@/hooks/use-workspace-git'
import { useWorkspaces } from '@/hooks/use-workspaces'
import type { MessageData, NodeDocument } from '@/lib/bindings'
import {
  DEFAULT_CHROME_CONFIG,
  DEFAULT_PROSE_CONFIG,
  estimateContextChipHeight,
  MarkdownHeightEngine
} from '@/lib/markdown-layout'
import { useConversationStore } from '@/store/conversation'
import { useToolApprovalStore } from '@/store/tool-approvals'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { useUILayoutStore } from '@/store/ui-layout'
import { useWorkspaceStore } from '@/store/workspace'
import { MessageBubble } from './message-bubble'
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
    measureRef
  }: VirtualRowProps) => {
    return (
      <div
        ref={(node) => {
          measureRef.current?.(node)
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

    // ─── Git repo init hint (F18) ─────────────────────────────────────────
    const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
    const { data: workspaces } = useWorkspaces()
    const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId)
    const { data: gitStatus } = useWorkspaceGitStatus(activeWorkspace?.path)
    const gitDismissed = useUIEphemeralStore((s) => s.gitInitDismissed)
    const setGitInitDismissed = useUIEphemeralStore(
      (s) => s.setGitInitDismissed
    )
    const queryClient = useQueryClient()

    const showGitHint =
      activeWorkspace?.path &&
      gitStatus &&
      !gitStatus.is_git_repo &&
      !gitDismissed[activeWorkspace.path]

    const handleGitInit = async (path: string) => {
      try {
        await invoke('git_init', { path })
        await queryClient.invalidateQueries({ queryKey: ['git-status', path] })
        toast.success('Git repository initialized')
      } catch (err) {
        toast.error(`Failed to initialize git: ${err}`)
      }
    }

    // ─── TanStack Router Scroll Restoration ───
    const scrollRestoration = useElementScrollRestoration({
      id: `message-thread-${conversationKey}`,
      getElement: () => scrollRef.current,
      getKey: (location) => location.pathname
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

    const isProgrammaticScrollRef = React.useRef(false)
    const userScrolledAwayRef = React.useRef(false)
    const autoScrollRef = React.useRef(autoScroll)
    autoScrollRef.current = autoScroll
    const streamingRef = React.useRef(streamingMessageId)
    streamingRef.current = streamingMessageId

    // Reset internal scroll state when conversation changes
    React.useEffect(() => {
      userScrolledAwayRef.current = false
    }, [])

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

    // ─── Height measurement engine ──────────────────────────────────────────
    const containerWidth = useUILayoutStore((s) => s.panelSizesPx.center)
    const effectiveWidth = containerWidth > 100 ? containerWidth : 800

    const engineRef = React.useRef<MarkdownHeightEngine | null>(null)
    if (!engineRef.current) {
      engineRef.current = new MarkdownHeightEngine(
        DEFAULT_PROSE_CONFIG,
        DEFAULT_CHROME_CONFIG
      )
    }

    // Prepare messages for the engine whenever they change
    React.useEffect(() => {
      const engine = engineRef.current
      if (!engine) return
      for (const msg of messages) {
        engine.prepare(
          msg.id,
          (msg as any).node_document,
          msg.role,
          msg.content
        )
      }
    }, [messages])

    const estimateSize = React.useCallback(
      (index: number): number => {
        const msg = filteredMessagesRef.current[index]
        if (!msg) return 80

        if (msg.role === 'tool') {
          return DEFAULT_CHROME_CONFIG.toolMessageBaseHeight
        }

        const baseHeight = engineRef.current!.layout(
          msg.id,
          effectiveWidth,
          msg.content.length
        )

        const chipHeight =
          (msg.context_items?.length ?? 0) > 0
            ? estimateContextChipHeight(
                msg.context_items!.length,
                effectiveWidth,
                DEFAULT_CHROME_CONFIG
              )
            : 0

        return baseHeight + chipHeight
      },
      [effectiveWidth]
    )

    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize,
      overscan: 10,
      useAnimationFrameWithResizeObserver: true,
      measureElement: (el) => {
        return el.getBoundingClientRect().height
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

    // Restore scroll position on conversation change
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
          if (!el) return () => {}
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
              {/* Git repo init hint banner (F18) */}
              {showGitHint && (
                <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-2 mx-4 mt-2 mb-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                      This folder is not a git repository. Initialize one?
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setGitInitDismissed(activeWorkspace!.path, true)
                      }
                      className="border-yellow-500/30 text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-300"
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleGitInit(activeWorkspace!.path)}
                      className="bg-yellow-600 text-white hover:bg-yellow-700"
                    >
                      Initialize
                    </Button>
                  </div>
                </div>
              )}

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

          {/* ❌ REMOVED the duplicate ThreadNavigator that was here */}
        </AutoScrollContext.Provider>
      </ScrollContainerContext.Provider>
    )
  }
)

MessageThread.displayName = 'MessageThread'
