// src/components/chat/global-drop-zone.tsx

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
  const leftPx = useUIStore((s) => {
    const val = s.panelSizesPx?.left ?? 0
    return val
  })
  const rightPx = useUIStore((s) => {
    const val = s.panelSizesPx?.right ?? 0
    return val
  })

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

        const safeDetail = {
          type: payload.type,
          paths: 'paths' in payload ? payload.paths : [],
          position: 'position' in payload ? payload.position : { x: -1, y: -1 },
        }
        window.dispatchEvent(new CustomEvent('skilldeck:drag-drop', { detail: safeDetail }))

        const leftWidth = leftWidthPxRef.current
        const rightWidth = rightWidthPxRef.current
        console.log('[DropZone] Drag event:', payload.type, 'leftWidthRef:', leftWidth, 'rightWidthRef:', rightWidth)

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
            console.log('[DropZone] Drop at x:', dropX, 'leftBoundary:', leftWidth, 'rightBoundary:', rightPanelStart)

            if (dropX <= leftWidth) {
              console.log('[DropZone] Dropped on left panel – ignoring')
              return
            }
            if (dropX >= rightPanelStart) {
              console.log('[DropZone] Dropped on right panel – ignoring')
              return
            }

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

  // Log the style being applied
  console.log('[DropZone] Rendering with leftPx:', leftPx)

  return (
    <div
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
