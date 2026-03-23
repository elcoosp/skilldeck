import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { commands } from '@/lib/bindings'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'

type DragDropPayload =
  | { type: 'enter'; paths: string[]; position: { x: number; y: number } }
  | { type: 'over'; paths: string[]; position: { x: number; y: number } }
  | { type: 'drop'; paths: string[]; position: { x: number; y: number } }
  | { type: 'leave' }

export function GlobalDropZone() {
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const leftPx = useUIStore((s) => s.panelSizesPx?.left ?? 0)
  const rightPx = useUIStore((s) => s.panelSizesPx?.right ?? 0)

  const [isDragging, setIsDragging] = useState(false)

  const pendingPathsRef = useRef<string[]>([])
  const activeConversationIdRef = useRef(activeConversationId)
  const leftWidthPxRef = useRef(leftPx)
  const rightWidthPxRef = useRef(rightPx)

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    leftWidthPxRef.current = leftPx
    rightWidthPxRef.current = rightPx
  }, [leftPx, rightPx])

  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setup = async () => {
      const webview = getCurrentWebviewWindow()
      unlisten = await webview.onDragDropEvent((event) => {
        const payload = event.payload as DragDropPayload

        // Always hit‑test. The overlay starts at leftPx, so:
        // - For x < leftPx, we hit the actual DOM (conversation items)
        // - For x >= leftPx, we hit the overlay (which has no data-conversation-id)
        let targetConversationId: string | null = null
        if ('position' in payload && payload.position) {
          const { x, y } = payload.position
          const hit = document.elementFromPoint(x, y)
          const elementInfo = {
            tag: hit?.tagName,
            id: hit?.id,
            class: hit?.className,
            dataConvId: hit?.getAttribute('data-conversation-id'),
          }
          targetConversationId =
            hit?.closest('[data-conversation-id]')?.getAttribute('data-conversation-id') ?? null

          console.log(`[GlobalDropZone] ${payload.type}`, {
            physX: x,
            physY: y,
            leftWidth: leftWidthPxRef.current,
            rightWidth: rightWidthPxRef.current,
            windowInnerWidth: window.innerWidth,
            hitElement: elementInfo,
            targetConversationId,
          })
        } else {
          console.log(`[GlobalDropZone] ${payload.type} (no position)`)
        }

        // Broadcast the event with the resolved target ID
        window.dispatchEvent(
          new CustomEvent('skilldeck:drag-drop', {
            detail: {
              type: payload.type,
              paths: 'paths' in payload ? payload.paths : [],
              position: 'position' in payload ? payload.position : { x: -1, y: -1 },
              targetConversationId,
            },
          })
        )

        const leftWidth = leftWidthPxRef.current
        const rightWidth = rightWidthPxRef.current

        switch (payload.type) {
          case 'enter':
          case 'over':
            if (payload.paths?.length) pendingPathsRef.current = payload.paths
            setIsDragging(true)
            break

          case 'drop': {
            setIsDragging(false)
            const paths = payload.paths?.length ? payload.paths : pendingPathsRef.current
            pendingPathsRef.current = []

            if (!paths.length || !payload.position) return

            const dropX = payload.position.x
            const rightPanelStart = window.innerWidth - rightWidth

            // Ignore drops on left or right panels (still attach only to the active conversation)
            if (dropX <= leftWidth || dropX >= rightPanelStart) return

            const currentActiveId = activeConversationIdRef.current
            if (!currentActiveId) {
              toast.error('No active conversation to attach to')
              return
            }

            commands
              .attachFilesToConversation(currentActiveId, paths)
              .then((res) => {
                if (res.status === 'error') toast.error(res.error)
                else toast.success(`Attached ${paths.length} file(s)`)
              })
            break
          }

          case 'leave':
            setIsDragging(false)
            pendingPathsRef.current = []
            break
        }
      })
    }

    setup().catch(console.error)
    return () => unlisten?.()
  }, [])

  // Guard: don't render overlay until panel sizes are known (avoids covering left panel)
  if (leftPx === 0) return null

  return (
    <div
      data-drag-overlay
      className={cn(
        'fixed top-0 bottom-0 z-50 pointer-events-none transition-opacity duration-200',
        isDragging ? 'opacity-100' : 'opacity-0'
      )}
      style={{
        left: `${leftPx}px`,
        right: 0,
      }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-sm select-none">
          Drop files to attach to current conversation
        </p>
      </div>
    </div>
  )
}
