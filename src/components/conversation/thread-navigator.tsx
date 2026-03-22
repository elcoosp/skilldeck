// src/components/conversation/thread-navigator.tsx
import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { ChevronRight, Bookmark, BookmarkCheck } from 'lucide-react'
import type { MessageData } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useAssistantMessageStore } from '@/store/assistant-messages'
import { useBookmarksStore } from '@/store/bookmarks'
import { useUIStore } from '@/store/ui'
import { toast } from 'sonner'

const VISIBLE_ITEMS = 10
const DOT_HEIGHT = 20          // 16px button + 4px gap (gap-1)

interface ThreadNavigatorProps {
  messages: MessageData[]
  activeIndex?: number
  activeHeadingIndex?: number | null
  onScrollTo: (index: number) => void
  onHeadingClick: (messageIndex: number, tocIndex: number) => void
  searchActive?: boolean // added to disable navigation when search is active
}

const ThreadNavigator = memo(function ThreadNavigator({
  messages,
  activeIndex = -1,
  activeHeadingIndex = null,
  onScrollTo,
  onHeadingClick,
  searchActive = false,
}: ThreadNavigatorProps) {
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const { loadBookmarks, getBookmarksForMessage, bookmarks } = useBookmarksStore()
  const [filterBookmarks, setFilterBookmarks] = useState(false)

  // Load bookmarks when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadBookmarks(activeConversationId)
    }
  }, [activeConversationId, loadBookmarks])

  const userMessages = useMemo(
    () =>
      messages
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.role === 'user'),
    [messages]
  )

  // Filter user messages based on bookmark filter
  const filteredUserMessages = useMemo(() => {
    if (!filterBookmarks || !activeConversationId) return userMessages
    return userMessages.filter(({ idx }) => {
      // Check if any bookmark exists for this message
      const msgId = messages[idx].id
      const bookmarksForMsg = getBookmarksForMessage(activeConversationId, msgId)
      return bookmarksForMsg.length > 0
    })
  }, [userMessages, filterBookmarks, activeConversationId, getBookmarksForMessage, messages])

  const headingsMap = useAssistantMessageStore((s) => s.headingsMap)

  const hasMessages = filteredUserMessages.length > 0

  const [optimisticActiveIndex, setOptimisticActiveIndex] = useState<number | null>(null)
  const effectiveActiveIndex = optimisticActiveIndex ?? activeIndex

  // Sliding window: index of the first visible dot (based on filtered messages)
  const [windowStart, setWindowStart] = useState(0)

  // Per-item TOC expand state
  const [expandedTocIdx, setExpandedTocIdx] = useState<number | null>(null)

  // Track which message TOCs the user manually collapsed
  const userCollapsedMessages = useRef<Set<number>>(new Set())

  // Only move the window when the active index is outside the visible range (using filtered list)
  useEffect(() => {
    if (!hasMessages) return
    const total = filteredUserMessages.length
    if (total <= VISIBLE_ITEMS) {
      setWindowStart(0)
      return
    }

    const currentIdx = filteredUserMessages.findIndex(u => u.idx === effectiveActiveIndex)
    if (currentIdx === -1) return

    const isOutside = currentIdx < windowStart || currentIdx >= windowStart + VISIBLE_ITEMS

    if (isOutside) {
      const half = Math.floor(VISIBLE_ITEMS / 2)
      const newStart = Math.max(0, Math.min(total - VISIBLE_ITEMS, currentIdx - half))
      setWindowStart(newStart)
    }
  }, [effectiveActiveIndex, filteredUserMessages, windowStart, hasMessages])

  // Keep windowStart within bounds when total changes
  useEffect(() => {
    if (!hasMessages) return
    const total = filteredUserMessages.length
    if (total <= VISIBLE_ITEMS) {
      setWindowStart(0)
    } else {
      setWindowStart(prev => Math.min(prev, total - VISIBLE_ITEMS))
    }
  }, [filteredUserMessages.length, hasMessages])

  // Translation amount for the full list
  const translateY = -windowStart * DOT_HEIGHT

  // Viewport height shows exactly VISIBLE_ITEMS dots (or fewer if total is less)
  const visibleCount = hasMessages ? Math.min(filteredUserMessages.length, VISIBLE_ITEMS) : 0
  const containerHeight = visibleCount * DOT_HEIGHT

  // Hover card logic
  const [isHovering, setIsHovering] = useState(false)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Refs to track previous active states for scroll triggering
  const prevActiveIndexRef = useRef(effectiveActiveIndex)
  const prevActiveHeadingIndexRef = useRef(activeHeadingIndex)

  // Helper: find message index that contains a given heading tocIndex
  const findMessageIndexForHeading = useCallback(
    (tocIndex: number): number | null => {
      for (let i = 0; i < filteredUserMessages.length; i++) {
        const { idx: messageIdx } = filteredUserMessages[i]
        const assistantMsgIdx = messageIdx + 1
        const assistantMsgId = messages[assistantMsgIdx]?.id
        if (assistantMsgId && headingsMap[assistantMsgId]) {
          const hasHeading = headingsMap[assistantMsgId].some(h => h.tocIndex === tocIndex)
          if (hasHeading) return i
        }
      }
      return null
    },
    [filteredUserMessages, messages, headingsMap]
  )

  // Function to scroll to an element (message or heading) and center it – instant scroll
  const scrollToElement = useCallback((element: HTMLElement) => {
    const container = scrollContainerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const scrollTop = container.scrollTop
    const targetScrollTop =
      scrollTop +
      elementRect.top -
      containerRect.top -
      containerRect.height / 2 +
      elementRect.height / 2
    container.scrollTo({ top: targetScrollTop, behavior: 'auto' }) // instant
  }, [])

  // Scroll to active heading or message when card opens or active target changes
  useEffect(() => {
    if (!isHovering || !cardPosition || !scrollContainerRef.current) return

    const activeChanged =
      prevActiveIndexRef.current !== effectiveActiveIndex ||
      prevActiveHeadingIndexRef.current !== activeHeadingIndex

    if (!activeChanged) return

    // Update refs
    prevActiveIndexRef.current = effectiveActiveIndex
    prevActiveHeadingIndexRef.current = activeHeadingIndex

    // First, try to scroll to active heading if it exists and is visible
    if (activeHeadingIndex !== null) {
      const headingElement = scrollContainerRef.current.querySelector(
        `[data-heading-idx="${activeHeadingIndex}"]`
      ) as HTMLElement | null

      if (headingElement) {
        scrollToElement(headingElement)
        return
      }
    }

    // Fallback: scroll to active message
    if (effectiveActiveIndex !== -1) {
      const messageElement = scrollContainerRef.current.querySelector(
        `[data-message-idx="${effectiveActiveIndex}"]`
      ) as HTMLElement | null
      if (messageElement) {
        scrollToElement(messageElement)
      }
    }
  }, [isHovering, cardPosition, effectiveActiveIndex, activeHeadingIndex, scrollToElement])

  // Update card position when hovering
  useEffect(() => {
    if (!isHovering || !containerRef.current || !hasMessages) {
      setCardPosition(null)
      return
    }
    const updatePosition = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const cardWidth = 256
      const rightMargin = 16
      let left = rect.left
      const maxLeft = window.innerWidth - cardWidth - rightMargin
      if (left > maxLeft) left = maxLeft
      setCardPosition({ top: rect.top + rect.height / 2, left })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isHovering, hasMessages])

  // Cleanup timers
  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    },
    []
  )

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => setIsHovering(true), 100)
  }
  const handleMouseLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => setIsHovering(false), 300)
  }

  const handleClick = (idx: number) => {
    if (searchActive) {
      toast.info('Clear the search to use thread navigation')
      return
    }
    setOptimisticActiveIndex(idx)
    onScrollTo(idx)
  }

  useEffect(() => {
    if (optimisticActiveIndex !== null && activeIndex === optimisticActiveIndex) {
      setOptimisticActiveIndex(null)
    }
  }, [activeIndex, optimisticActiveIndex])

  // When user toggles a chevron, mark that message as manually collapsed/expanded
  const handleToggleToc = (messageIdx: number, isExpanded: boolean) => {
    if (!isExpanded) {
      userCollapsedMessages.current.add(messageIdx)
    } else {
      userCollapsedMessages.current.delete(messageIdx)
    }
    setExpandedTocIdx(isExpanded ? messageIdx : null)
  }

  // When a heading is clicked, expand its TOC (override manual collapse) and close the card
  const handleHeadingClick = (assistantMsgIdx: number, tocIndex: number) => {
    if (searchActive) {
      toast.info('Clear the search to use thread navigation')
      return
    }
    const messageIdx = assistantMsgIdx - 1
    if (expandedTocIdx !== messageIdx) {
      // Remove from manual collapse set because the user now wants it expanded
      userCollapsedMessages.current.delete(messageIdx)
      setExpandedTocIdx(messageIdx)
    }
    onHeadingClick(assistantMsgIdx, tocIndex)
    setIsHovering(false)
  }

  const toggleBookmarkFilter = () => {
    setFilterBookmarks(!filterBookmarks)
  }

  const hasBookmarks = activeConversationId && (bookmarks[activeConversationId]?.length ?? 0) > 0

  return (
    <>
      <nav
        ref={containerRef}
        aria-label="Thread navigation"
        className={cn(
          'absolute left-2 top-0 bottom-0 flex flex-col justify-center z-20',
          isHovering && 'opacity-0 pointer-events-none',
          !hasMessages && 'hidden'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="relative overflow-hidden"
          style={{ height: `${containerHeight}px` }}
        >
          <motion.div
            className="flex flex-col gap-1"
            animate={{ y: translateY }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {filteredUserMessages.map(({ msg, idx }) => {
              const isActive = idx === effectiveActiveIndex
              const overallIndex = filteredUserMessages.findIndex(u => u.idx === idx)
              return (
                <button
                  key={msg.id}
                  type="button"
                  className="group w-4 h-4 flex items-center justify-center pointer-events-auto"
                  onClick={() => handleClick(idx)}
                  aria-label={`Jump to message ${overallIndex + 1}`}
                >
                  <div className="w-3 h-[3px] flex items-center justify-start">
                    <motion.div
                      className={cn(
                        'h-[2px] w-3 rounded-full origin-left transition-colors duration-150',
                        isActive
                          ? 'bg-primary'
                          : 'bg-muted-foreground/30 group-hover:bg-primary/60'
                      )}
                      animate={{
                        scaleX: isActive ? 1 : 0.6,
                        scaleY: isActive ? 1.5 : 1,
                        opacity: isActive ? 1 : 0.5,
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  </div>
                </button>
              )
            })}
          </motion.div>
        </div>
      </nav>

      {hasMessages &&
        createPortal(
          <AnimatePresence>
            {isHovering && cardPosition && (
              <motion.div
                initial={{ opacity: 0, x: -5, y: '-50%' }}
                animate={{ opacity: 1, x: 0, y: '-50%' }}
                exit={{ opacity: 0, x: -5, y: '-50%' }}
                transition={{ duration: 0.15 }}
                className="fixed z-50 w-64 p-2 bg-popover rounded-lg border shadow-md"
                style={{
                  top: cardPosition.top,
                  left: cardPosition.left,
                  transform: 'translateY(-50%)',
                  height: 'min(380px, 70vh)',
                }}
                onMouseEnter={() => {
                  if (leaveTimer.current) clearTimeout(leaveTimer.current)
                }}
                onMouseLeave={handleMouseLeave}
              >
                {/* Filter toggle header */}
                {hasBookmarks && (
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-border">
                    <span className="text-xs text-muted-foreground">Filter</span>
                    <button
                      type="button"
                      onClick={toggleBookmarkFilter}
                      className={cn(
                        'p-1 rounded transition-colors',
                        filterBookmarks
                          ? 'text-amber-500 bg-amber-500/10'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      title={filterBookmarks ? 'Show all messages' : 'Show only bookmarked'}
                    >
                      {filterBookmarks ? (
                        <BookmarkCheck className="size-3.5" />
                      ) : (
                        <Bookmark className="size-3.5" />
                      )}
                    </button>
                  </div>
                )}
                <div
                  ref={scrollContainerRef}
                  className="overflow-y-auto thin-scrollbar"
                  style={{ height: 'calc(min(380px, 70vh) - 16px)' }}
                >
                  <div className="space-y-1 pr-2">
                    {filteredUserMessages.map(({ msg, idx }) => {
                      const isActive = idx === effectiveActiveIndex
                      const assistantMsgIdx = idx + 1
                      const assistantMsgId = messages[assistantMsgIdx]?.id
                      const headings = assistantMsgId ? (headingsMap[assistantMsgId] ?? []) : []
                      const hasHeadings = headings.length > 0
                      const isExpanded = expandedTocIdx === idx
                      const isBookmarkedMsg = activeConversationId && getBookmarksForMessage(activeConversationId, msg.id).length > 0

                      return (
                        <div
                          key={msg.id}
                          data-message-idx={idx}
                        >
                          <div className="flex items-start gap-1 w-full">
                            {/* Main message button */}
                            <button
                              type="button"
                              className="group flex items-start gap-2 flex-1 text-left p-1.5 rounded transition-colors min-w-0"
                              onClick={() => {
                                if (searchActive) {
                                  toast.info('Clear the search to use thread navigation')
                                  return
                                }
                                handleClick(idx)
                                setIsHovering(false)
                              }}
                            >
                              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <div
                                  className={cn(
                                    'h-[2px] w-3 rounded-full transition-colors duration-150',
                                    isActive
                                      ? 'bg-primary'
                                      : 'bg-muted-foreground/30 group-hover:bg-primary/60'
                                  )}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground truncate flex-1 transition-colors duration-150 group-hover:text-foreground">
                                {msg.content}
                              </p>
                              {isBookmarkedMsg && (
                                <BookmarkCheck className="size-3 text-amber-500 shrink-0 ml-1" />
                              )}
                            </button>

                            {/* Chevron toggle — only shown if the assistant reply has headings */}
                            {hasHeadings && (
                              <button
                                type="button"
                                className="flex-shrink-0 p-1 ml-1 mr-0.5 self-center rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                                onClick={() => handleToggleToc(idx, !isExpanded)}
                                aria-label={isExpanded ? 'Collapse headings' : 'Expand headings'}
                              >
                                <motion.div
                                  animate={{ rotate: isExpanded ? 90 : 0 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <ChevronRight className="size-3" />
                                </motion.div>
                              </button>
                            )}
                          </div>

                          {/* Collapsible TOC for this message's assistant reply */}
                          <AnimatePresence initial={false}>
                            {isExpanded && hasHeadings && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <div className="ml-3 mt-0.5 mb-1.5 border-l-2 border-primary/20 pl-2 space-y-px">
                                  {headings.map((h) => {
                                    const isH1 = h.level === 1
                                    const isH2 = h.level === 2
                                    const isActiveHeading = isActive && h.tocIndex === activeHeadingIndex
                                    return (
                                      <button
                                        key={h.tocIndex}
                                        type="button"
                                        data-heading-idx={h.tocIndex}
                                        className={cn(
                                          'flex w-full text-left rounded transition-colors group',
                                          'hover:bg-muted/60',
                                          isH1 && 'py-1 px-1.5',
                                          isH2 && 'py-0.5 px-1.5',
                                          !isH1 && !isH2 && 'py-0.5 px-1.5',
                                        )}
                                        style={{ paddingLeft: `${(h.level - 1) * 8 + 6}px` }}
                                        onClick={() => handleHeadingClick(assistantMsgIdx, h.tocIndex)}
                                      >
                                        {/* Level indicator bar */}
                                        <span
                                          className={cn(
                                            'inline-block flex-shrink-0 self-center rounded-full mr-1.5 transition-colors',
                                            isActiveHeading
                                              ? 'bg-primary'
                                              : 'bg-muted-foreground/20 group-hover:bg-primary/40',
                                            isH1 && 'w-1 h-1',
                                            isH2 && 'w-0.5 h-0.5',
                                            !isH1 && !isH2 && 'w-0.5 h-0.5 opacity-60',
                                          )}
                                        />
                                        <span
                                          className={cn(
                                            'truncate transition-colors group-hover:text-foreground',
                                            isH1 && 'text-xs font-medium text-muted-foreground',
                                            isH2 && 'text-xs text-muted-foreground/80',
                                            !isH1 && !isH2 && 'text-[11px] text-muted-foreground/60',
                                            isActiveHeading && 'text-primary font-medium',
                                          )}
                                        >
                                          {h.text}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
})

export default ThreadNavigator
