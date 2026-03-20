import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import type { MessageData } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface VirtualItem {
  index: number
  start: number
  size: number
}

interface VirtualizerRef {
  getVirtualItems: () => VirtualItem[]
  // We might also need measurementsCache if available; but for now we only use getVirtualItems.
  // However the original code used a custom `measurementsCache` that doesn't exist in the public API.
  // We'll assume the virtualizer's internal cache is not needed; we'll rely on DOM transforms.
  // The active index detection can work with DOM transforms as it did before.
}

interface ThreadNavigatorProps {
  messages: MessageData[]
  scrollRef: React.RefObject<HTMLDivElement>
  virtualizerRef: React.RefObject<VirtualizerRef>
  onScrollTo: (index: number) => void
}

const ThreadNavigator = memo(function ThreadNavigator({
  messages,
  scrollRef,
  virtualizerRef,
  onScrollTo,
}: ThreadNavigatorProps) {
  const userMessages = useMemo(
    () =>
      messages
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.role === 'user'),
    [messages]
  )

  const userIndices = useMemo(() => userMessages.map(({ idx }) => idx), [userMessages])

  const userIndicesRef = useRef(userIndices)
  userIndicesRef.current = userIndices

  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      const indices = userIndicesRef.current
      if (indices.length === 0) {
        setActiveIndex((prev) => (prev === -1 ? prev : -1))
        return
      }

      const { scrollTop, scrollHeight, clientHeight } = el
      const maxScroll = scrollHeight - clientHeight

      if (scrollTop <= 0) {
        setActiveIndex((prev) => (prev === indices[0] ? prev : indices[0]))
        return
      }
      if (maxScroll <= 0 || scrollTop >= maxScroll - 1) {
        setActiveIndex((prev) =>
          prev === indices[indices.length - 1] ? prev : indices[indices.length - 1]
        )
        return
      }

      // Use the virtualizer's measurements if available, otherwise fall back to DOM transforms
      const virt = virtualizerRef.current
      const cache = (virt as any)?.measurementsCache as Array<{ start: number }> | undefined

      let result = indices[0]
      for (const ui of indices) {
        let top: number | null = null

        // Try DOM transform first
        const domItem = scrollRef.current?.querySelector(
          `[data-message-index="${ui}"]`
        ) as HTMLElement | null
        if (domItem) {
          const match = domItem.style.transform.match(/translateY\(([-\d.]+)px\)/)
          if (match) top = parseFloat(match[1])
        }

        // Fall back to virtualizer cache if DOM failed
        if (top === null && cache && cache[ui]) {
          top = cache[ui].start
        }

        if (top === null) continue
        if (top <= scrollTop + 1) result = ui
        else break
      }

      setActiveIndex((prev) => (prev === result ? prev : result))
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, virtualizerRef])

  const [isHovering, setIsHovering] = useState(false)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isHovering || !containerRef.current) {
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
  }, [isHovering])

  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    },
    []
  )

  if (userMessages.length < 3) return null

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => setIsHovering(true), 100)
  }
  const handleMouseLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => setIsHovering(false), 300)
  }

  const handleClick = (idx: number) => {
    // Just call the parent's scroll handler – no direct virtualizer access
    onScrollTo(idx)
  }

  return (
    <>
      <nav
        ref={containerRef}
        aria-label="Thread navigation"
        className={cn(
          'absolute left-2 top-0 bottom-0 flex flex-col justify-center gap-1 z-20',
          isHovering && 'opacity-0 pointer-events-none'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {userMessages.map(({ msg, idx }) => {
          const isActive = idx === activeIndex
          const dotNumber = userIndices.indexOf(idx)
          return (
            <button
              key={msg.id}
              type="button"
              className="group w-4 h-4 flex items-center justify-center pointer-events-auto"
              onClick={() => handleClick(idx)}
              aria-label={`Jump to message ${dotNumber + 1}`}
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
      </nav>

      {createPortal(
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
                    const isActive = idx === activeIndex
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
