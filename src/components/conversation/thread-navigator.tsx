import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { MessageData } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface ThreadNavigatorProps {
  messages: MessageData[]
  onScrollTo: (index: number) => void
  activeIndex?: number
}

export function ThreadNavigator({
  messages,
  onScrollTo,
  activeIndex
}: ThreadNavigatorProps) {
  // All hooks must be called unconditionally at the top
  const [isHovering, setIsHovering] = useState(false)
  const [cardPosition, setCardPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<NodeJS.Timeout | null>(null)
  const leaveTimer = useRef<NodeJS.Timeout | null>(null)

  // Effect to update floating card position
  useEffect(() => {
    if (!isHovering || !containerRef.current) {
      setCardPosition(null)
      return
    }

    const updatePosition = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      setCardPosition({
        top: rect.top + rect.height / 2,
        left: rect.left - 12
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isHovering])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }
  }, [])

  // Derived data (can be after hooks)
  const userMessages = messages
    .map((msg, idx) => ({ msg, idx }))
    .filter(({ msg }) => msg.role === 'user')

  // Early return – safe now because all hooks are above
  if (userMessages.length < 3) return null

  // Event handlers (not hooks, can be placed here)
  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => {
      setIsHovering(true)
    }, 100)
  }

  const handleMouseLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => {
      setIsHovering(false)
    }, 300)
  }

  return (
    <>
      {/* Dots container */}
      <div
        ref={containerRef}
        role="navigation"
        aria-label="Thread navigation"
        className="absolute right-2 top-0 bottom-0 flex flex-col justify-center gap-1 z-20"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {userMessages.map(({ msg, idx }) => {
          const isActive = idx === activeIndex
          return (
            <button
              key={msg.id}
              type="button"
              className="group w-4 h-4 flex items-center justify-center pointer-events-auto"
              onClick={() => onScrollTo(idx)}
              aria-label="Jump to message"
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
                    opacity: isActive ? 1 : 0.5
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Floating card portal */}
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
                maxHeight: 'min(380px, 70vh)'
              }}
              onMouseEnter={() => {
                if (leaveTimer.current) clearTimeout(leaveTimer.current)
              }}
              onMouseLeave={handleMouseLeave}
            >
              <ScrollArea className="h-full max-h-[inherit] pr-2">
                <div className="space-y-1">
                  {userMessages.map(({ msg, idx }) => {
                    const isActive = idx === activeIndex
                    return (
                      <button
                        key={msg.id}
                        type="button"
                        className="flex items-start gap-2 w-full text-left hover:bg-muted/50 p-1.5 rounded transition-colors"
                        onClick={() => {
                          onScrollTo(idx)
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
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
