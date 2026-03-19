// src/components/conversation/queue/queue-pause-indicator.tsx
import { AnimatePresence, motion } from 'framer-motion'
import { Pause } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useQueueStore } from '@/store/queue'

interface QueuePauseIndicatorProps {
  conversationId: string
}

export function QueuePauseIndicator({
  conversationId
}: QueuePauseIndicatorProps) {
  const editingId = useQueueStore((s) => s.editingId[conversationId])
  const isDragging = useQueueStore((s) => s.isDragging[conversationId] ?? false)
  const mode = useQueueStore((s) => s.mode[conversationId] ?? 'view')

  const isPaused = editingId !== null || isDragging || mode === 'select'

  return (
    <AnimatePresence>
      {isPaused && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="sticky top-0 z-20 w-full h-7 bg-warning text-warning-foreground text-xs flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Pause className="size-3.5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">Auto‑send paused</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="max-w-[200px]">
                Messages in the queue will be sent one by one. Auto‑send is paused while you're editing, dragging, or selecting.
              </p>
            </TooltipContent>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
