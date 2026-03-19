import { motion } from 'framer-motion'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { MessageData } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface ThreadNavigatorProps {
  messages: MessageData[]
  onScrollTo: (index: number) => void
  activeIndex?: number
}

export function ThreadNavigator({ messages, onScrollTo, activeIndex }: ThreadNavigatorProps) {
  const userMessages = messages
    .map((msg, idx) => ({ msg, idx }))
    .filter(({ msg }) => msg.role === 'user')

  if (userMessages.length < 3) return null

  return (
    <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-center gap-1 z-20 pointer-events-none">
      {userMessages.map(({ msg, idx }) => {
        const isActive = idx === activeIndex

        return (
          <Tooltip key={msg.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="group w-4 h-4 flex items-center justify-center pointer-events-auto"
                onClick={() => onScrollTo(idx)}
                aria-label={`Jump to: ${msg.content.slice(0, 40)}`}
              >
                {/*
                  Outer div is fixed size — never changes, no layout thrash.
                  motion.div only animates transform (scaleX/scaleY) and opacity,
                  which are GPU-composited and cause zero reflow.
                  Color transitions via className so Tailwind handles them.
                */}
                <div className="w-3 h-[3px] flex items-center justify-start">
                  <motion.div
                    className={cn(
                      'h-[2px] w-3 rounded-full origin-left transition-colors duration-150',
                      isActive
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/60'
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
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="max-w-[200px] truncate text-xs">
                {msg.content.slice(0, 80)}
              </p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
