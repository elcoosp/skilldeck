import { memo, useMemo, useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import type { MessageData } from '@/lib/bindings'
import { cn } from '@/lib/utils'

const VISIBLE_ITEMS = 10
const DOT_HEIGHT = 20          // 16px button + 4px gap (gap-1)

interface ThreadNavigatorProps {
  messages: MessageData[]
  activeIndex?: number
  onScrollTo: (index: number) => void
}

const ThreadNavigator = memo(function ThreadNavigator({
  messages,
  activeIndex = -1,
  onScrollTo,
}: ThreadNavigatorProps) {
  const userMessages = useMemo(
    () =>
      messages
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.role === 'user'),
    [messages]
  )

  const hasMessages = userMessages.length > 0

  const [optimisticActiveIndex, setOptimisticActiveIndex] = useState<number | null>(null)
  const effectiveActiveIndex = optimisticActiveIndex ?? activeIndex

  // Sliding window: index of the first visible dot
  const [windowStart, setWindowStart] = useState(0)

  // Only move the window when the active index is outside the visible range
  useEffect(() => {
    if (!hasMessages) return
    const total = userMessages.length
    if (total <= VISIBLE_ITEMS) {
      setWindowStart(0)
      return
    }

    const currentIdx = userMessages.findIndex(u => u.idx === effectiveActiveIndex)
    if (currentIdx === -1) return

    const isOutside = currentIdx < windowStart || currentIdx >= windowStart + VISIBLE_ITEMS

    if (isOutside) {
      const half = Math.floor(VISIBLE_ITEMS / 2)
      const newStart = Math.max(0, Math.min(total - VISIBLE_ITEMS, currentIdx - half))
      setWindowStart(newStart)
    }
  }, [effectiveActiveIndex, userMessages, windowStart, hasMessages])

  // Keep windowStart within bounds when total changes
  useEffect(() => {
    if (!hasMessages) return
    const total = userMessages.length
    if (total <= VISIBLE_ITEMS) {
      setWindowStart(0)
    } else {
      setWindowStart(prev => Math.min(prev, total - VISIBLE_ITEMS))
    }
  }, [userMessages.length, hasMessages])

  // Translation amount for the full list
  const translateY = -windowStart * DOT_HEIGHT

  // Viewport height shows exactly VISIBLE_ITEMS dots (or fewer if total is less)
  const visibleCount = hasMessages ? Math.min(userMessages.length, VISIBLE_ITEMS) : 0
  const containerHeight = visibleCount * DOT_HEIGHT

  // Hover card logic (unchanged)
  const [isHovering, setIsHovering] = useState(false)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const msg = userMessages.find(u => u.idx === idx)
    console.log(`[Navigator] 🖱️ clicked fullIndex=${idx}`)
    setOptimisticActiveIndex(idx)
    onScrollTo(idx)
  }

  useEffect(() => {
    if (optimisticActiveIndex !== null && activeIndex === optimisticActiveIndex) {
      setOptimisticActiveIndex(null)
    }
  }, [activeIndex, optimisticActiveIndex])

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
            {userMessages.map(({ msg, idx }) => {
              const isActive = idx === effectiveActiveIndex
              const overallIndex = userMessages.findIndex(u => u.idx === idx)
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
                <div
                  className="overflow-y-auto thin-scrollbar"
                  style={{ height: 'calc(min(380px, 70vh) - 16px)' }}
                >
                  <div className="space-y-1 pr-2">
                    {userMessages.map(({ msg, idx }) => {
                      const isActive = idx === effectiveActiveIndex
                      return (
                        <button
                          key={msg.id}
                          type="button"
                          className="flex items-start gap-2 w-full text-left hover:bg-muted/50 p-1.5 rounded transition-colors"
                          onClick={() => {
                            handleClick(idx)
                            setIsHovering(false)
                          }}
                        >
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <div
                              className={cn(
                                'h-[3px] w-3 rounded-full',
                                isActive ? 'bg-primary' : 'bg-muted-foreground/50'
                              )}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground break-words line-clamp-2 flex-1">
                            {msg.content}
                          </p>
                        </button>
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
