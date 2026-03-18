// src/components/conversation/queue/queue-selection-toolbar.tsx

import { CheckSquare, Combine, Square, Trash2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  useDeleteQueuedMessage,
  useMergeQueuedMessages
} from '@/hooks/use-queued-messages'
import { useQueueStore } from '@/store/queue'

const EMPTY_ARRAY: string[] = []

interface QueueSelectionToolbarProps {
  conversationId: string
  messageIds: string[]
}

export function QueueSelectionToolbar({
  conversationId,
  messageIds
}: QueueSelectionToolbarProps) {
  const selectedIdsArray = useQueueStore(
    (s) => s.selectedIds[conversationId] ?? EMPTY_ARRAY
  )
  const selectAll = useQueueStore((s) => s.selectAll)
  const clearSelected = useQueueStore((s) => s.clearSelected)
  const setMode = useQueueStore((s) => s.setMode)

  const deleteMutation = useDeleteQueuedMessage(conversationId)
  const mergeMutation = useMergeQueuedMessages(conversationId)

  const selectedSet = useMemo(
    () => new Set(selectedIdsArray),
    [selectedIdsArray]
  )
  const allSelected =
    messageIds.length > 0 && selectedSet.size === messageIds.length
  const someSelected = selectedSet.size > 0

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelected(conversationId)
    } else {
      selectAll(conversationId, messageIds)
    }
  }, [allSelected, conversationId, clearSelected, selectAll, messageIds])

  const handleDelete = useCallback(() => {
    if (!someSelected) return
    Array.from(selectedSet).forEach((id) => {
      deleteMutation.mutate(id)
    })
    clearSelected(conversationId)
  }, [someSelected, selectedSet, deleteMutation, clearSelected, conversationId])

  const handleMerge = useCallback(() => {
    if (selectedSet.size < 2) return
    mergeMutation.mutate(Array.from(selectedSet), {
      onSuccess: () => {
        clearSelected(conversationId)
        setMode(conversationId, 'view')
      }
    })
  }, [selectedSet, mergeMutation, clearSelected, setMode, conversationId])

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-t border-border">
      <Button
        variant="ghost"
        size="xs"
        onClick={handleSelectAll}
        className="h-6 px-2 text-xs"
      >
        {allSelected ? (
          <CheckSquare className="size-3 mr-1" />
        ) : (
          <Square className="size-3 mr-1" />
        )}
        Select all
      </Button>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="xs"
        onClick={handleDelete}
        disabled={!someSelected}
        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
      >
        <Trash2 className="size-3 mr-1" />
        Delete
      </Button>

      <Button
        variant="ghost"
        size="xs"
        onClick={handleMerge}
        disabled={selectedSet.size < 2}
        className="h-6 px-2 text-xs"
      >
        <Combine className="size-3 mr-1" />
        Merge
      </Button>
    </div>
  )
}
