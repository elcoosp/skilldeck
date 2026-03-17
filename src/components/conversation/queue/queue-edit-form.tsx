// src/components/conversation/queue/queue-edit-form.tsx

import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateQueuedMessage } from '@/hooks/use-queued-messages'
import { useQueueStore } from '@/store/queue'

interface QueueEditFormProps {
  conversationId: string
  messageId: string
  initialContent: string
  onCancel: () => void
}

export function QueueEditForm({
  conversationId,
  messageId,
  initialContent,
  onCancel
}: QueueEditFormProps) {
  const [content, setContent] = useState(initialContent)
  const updateMutation = useUpdateQueuedMessage(conversationId)
  const setEditingId = useQueueStore((s) => s.setEditingId)

  const handleSave = () => {
    if (!content.trim()) return
    updateMutation.mutate(
      { id: messageId, content },
      {
        onSuccess: () => {
          setEditingId(conversationId, null)
          onCancel()
        }
      }
    )
  }

  const handleCancel = () => {
    setEditingId(conversationId, null)
    onCancel()
  }

  return (
    <div className="p-2 space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[60px] text-sm"
        autoFocus
      />
      <div className="flex justify-end gap-1">
        <Button size="xs" variant="ghost" onClick={handleCancel}>
          <X className="size-3 mr-1" />
          Cancel
        </Button>
        <Button
          size="xs"
          onClick={handleSave}
          disabled={!content.trim() || updateMutation.isPending}
        >
          <Check className="size-3 mr-1" />
          Save
        </Button>
      </div>
    </div>
  )
}
