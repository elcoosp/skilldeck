// src/components/conversation/queue/queue-selection-toolbar.tsx
import { CheckSquare, Combine, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useDeleteQueuedMessage,
  useMergeQueuedMessages
} from '@/hooks/use-queued-messages'
import { useQueueStore } from '@/store/queue'

interface QueueSelectionToolbarProps {
  conversationId: string
  messageIds: string[]
}

export function QueueSelectionToolbar({
  conversationId,
  messageIds
}: QueueSelectionToolbarProps) {
  const selectedIds = useQueueStore(
    (s) => s.selectedIds[conversationId] ?? new Set()
  )
  const selectAll = useQueueStore((s) => s.selectAll)
  const clearSelected = useQueueStore((s) => s.clearSelected)
  const setMode = useQueueStore((s) => s.setMode)

  const deleteMutation = useDeleteQueuedMessage(conversationId)
  const mergeMutation = useMergeQueuedMessages(conversationId)

  const allSelected =
    messageIds.length > 0 && selectedIds.size === messageIds.length
  const someSelected = selectedIds.size > 0

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelected(conversationId)
    } else {
      selectAll(conversationId, messageIds)
    }
  }

  const handleDelete = () => {
    if (!someSelected) return
    // Confirm? Could add a dialog.
    Array.from(selectedIds).forEach((id) => {
      deleteMutation.mutate(id)
    })
    clearSelected(conversationId)
  }

  const handleMerge = () => {
    if (selectedIds.size < 2) return
    mergeMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        clearSelected(conversationId)
        setMode(conversationId, 'view')
      }
    })
  }

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
        {allSelected ? 'Deselect all' : 'Select all'}
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
        disabled={selectedIds.size < 2}
        className="h-6 px-2 text-xs"
      >
        <Combine className="size-3 mr-1" />
        Merge
      </Button>
    </div>
  )
}
