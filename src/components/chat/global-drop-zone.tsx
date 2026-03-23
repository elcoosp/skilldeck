// src/components/chat/global-drop-zone.tsx
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { commands } from '@/lib/bindings'
import { useUIStore } from '@/store/ui'
import { toast } from 'sonner'

export function GlobalDropZone() {
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const leftPanelWidth = useUIStore((s) => s.panelSizes.left)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(true)
    }

    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const onDragLeave = (e: DragEvent) => {
      if (e.target === document.body) setIsDragging(false)
    }

    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer?.files || [])
      if (files.length === 0) return

      if (!activeConversationId) {
        toast.error('No active conversation to attach to')
        return
      }

      const paths = files.map(f => f.path)
      const res = await commands.attachFilesToConversation(activeConversationId, paths)
      if (res.status === 'error') {
        toast.error(res.error)
      } else {
        toast.success(`Attached ${files.length} file(s)`)
      }
    }

    document.body.addEventListener('dragenter', onDragEnter)
    document.body.addEventListener('dragover', onDragOver)
    document.body.addEventListener('dragleave', onDragLeave)
    document.body.addEventListener('drop', onDrop)

    return () => {
      document.body.removeEventListener('dragenter', onDragEnter)
      document.body.removeEventListener('dragover', onDragOver)
      document.body.removeEventListener('dragleave', onDragLeave)
      document.body.removeEventListener('drop', onDrop)
    }
  }, [activeConversationId])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 pointer-events-none transition-opacity duration-200',
        isDragging && 'pointer-events-auto'
      )}
      style={{ marginLeft: leftPanelWidth }}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Drop files to attach to current conversation
          </p>
        </div>
      )}
    </div>
  )
}
