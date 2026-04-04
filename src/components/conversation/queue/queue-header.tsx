// src/components/conversation/queue/queue-header.tsx

import { ChevronDown, ChevronRight, Edit2, X } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import type { QueuedMessage } from '@/hooks/use-queued-messages'
import { useQueueStore } from '@/store/queue'

// Stable empty array – same reference on every render
const EMPTY_ARRAY: string[] = []

interface QueueHeaderProps {
  conversationId: string
  messages: QueuedMessage[]
}

export function QueueHeader({ conversationId, messages }: QueueHeaderProps) {
  const expanded = useQueueStore((s) => s.expanded[conversationId] ?? false)
  const mode = useQueueStore((s) => s.mode[conversationId] ?? 'view')

  const selectedIdsArray = useQueueStore(
    (s) => s.selectedIds[conversationId] ?? EMPTY_ARRAY
  )

  const selectedIds = useMemo(
    () => new Set(selectedIdsArray),
    [selectedIdsArray]
  )

  const setExpanded = useQueueStore((s) => s.setExpanded)
  const setMode = useQueueStore((s) => s.setMode)
  const clearSelected = useQueueStore((s) => s.clearSelected)

  const count = messages.length
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])

  const handleSelectClick = useCallback(() => {
    setMode(conversationId, 'select')
    clearSelected(conversationId)
  }, [conversationId, setMode, clearSelected])

  const handleCancelSelect = useCallback(() => {
    setMode(conversationId, 'view')
    clearSelected(conversationId)
  }, [conversationId, setMode, clearSelected])

  const handleToggleExpanded = useCallback(() => {
    // Don't open if there are no messages and it's currently closed
    if (count === 0 && !expanded) return
    setExpanded(conversationId, !expanded)
  }, [conversationId, expanded, setExpanded, count])

  if (count === 0) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
      <button
        type="button"
        onClick={handleToggleExpanded}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <span>Queued</span>
        <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </button>

      <div className="flex-1" />

      {mode === 'select' ? (
        <>
          <span className="text-xs text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCancelSelect}
            className="h-6 px-2 text-xs"
          >
            <X className="size-3 mr-1" />
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="xs"
          onClick={handleSelectClick}
          className="h-6 px-2 text-xs"
          disabled={count === 0}
        >
          <Edit2 className="size-3 mr-1" />
          Select
        </Button>
      )}
    </div>
  )
}
