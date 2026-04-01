// src/components/chat/global-drop-zone.tsx
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useChatContextStore } from '@/store/chat-context-store'
import { useConversationStore } from '@/store/conversation'
import { useUILayoutStore } from '@/store/ui-layout'

type DragDropPayload =
  | { type: 'enter'; paths: string[]; position: { x: number; y: number } }
  | { type: 'over'; paths: string[]; position: { x: number; y: number } }
  | { type: 'drop'; paths: string[]; position: { x: number; y: number } }
  | { type: 'leave' }

export function GlobalDropZone() {
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  )
  const leftPx = useUILayoutStore((s) => s.panelSizesPx?.left ?? 0)
  const rightPx = useUILayoutStore((s) => s.panelSizesPx?.right ?? 0)

  const [isDragging, setIsDragging] = useState(false)

  const pendingPathsRef = useRef<string[]>([])
  const activeConversationIdRef = useRef(activeConversationId)
  const leftWidthPxRef = useRef(leftPx)
  const rightWidthPxRef = useRef(rightPx)

  // Get current context items for the active conversation (to check duplicates)
  const itemsMap = useChatContextStore((s) => s.items)
  const _activeItems = itemsMap[activeConversationId ?? ''] ?? []

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

        // Hit‑test to find the conversation element under the cursor
        let targetConversationId: string | null = null
        if ('position' in payload && payload.position) {
          const { x, y } = payload.position
          const hit = document.elementFromPoint(x, y)
          targetConversationId =
            hit
              ?.closest('[data-conversation-id]')
              ?.getAttribute('data-conversation-id') ?? null

          console.log(`[GlobalDropZone] ${payload.type}`, {
            physX: x,
            physY: y,
            leftWidth: leftWidthPxRef.current,
            rightWidth: rightWidthPxRef.current,
            windowInnerWidth: window.innerWidth,
            hitElement: {
              tag: hit?.tagName,
              id: hit?.id,
              class: hit?.className,
              dataConvId: hit?.getAttribute('data-conversation-id')
            },
            targetConversationId
          })
        } else {
          console.log(`[GlobalDropZone] ${payload.type} (no position)`)
        }

        // Broadcast the event with the resolved target ID (for conversation-item to handle activation)
        window.dispatchEvent(
          new CustomEvent('skilldeck:drag-drop', {
            detail: {
              type: payload.type,
              paths: 'paths' in payload ? payload.paths : [],
              position:
                'position' in payload ? payload.position : { x: -1, y: -1 },
              targetConversationId
            }
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
            const paths = payload.paths?.length
              ? payload.paths
              : pendingPathsRef.current
            pendingPathsRef.current = []

            if (!paths.length || !payload.position) return

            const dropX = payload.position.x
            const rightPanelStart = window.innerWidth - rightWidth

            // Ignore drops on left or right panels
            if (dropX <= leftWidth || dropX >= rightPanelStart) return

            // Use the target conversation if we found one, otherwise fall back to active
            const targetId =
              targetConversationId ?? activeConversationIdRef.current
            if (!targetId) {
              toast.error('No conversation target found')
              return
            }

            // Check for already attached files in the target conversation
            const targetItems = itemsMap[targetId] ?? []
            const existingPaths = new Set(
              targetItems
                .filter((item) => item.type === 'file')
                .map((item) => (item as any).data?.path)
                .filter((p): p is string => !!p)
            )

            const newPaths = paths.filter((p) => !existingPaths.has(p))
            if (newPaths.length < paths.length) {
              const duplicates = paths.filter((p) => existingPaths.has(p))
              toast.warning(`Already attached: ${duplicates.join(', ')}`)
            }

            if (newPaths.length === 0) return

            commands
              .attachFilesToConversation(targetId, newPaths)
              .then((res) => {
                if (res.status === 'error') toast.error(res.error)
                // Toast already shown in use-attach-files-listener, so we don't show another
              })
              .catch(() => toast.error('Failed to attach files'))

            // If we dropped onto a different conversation, activate it
            if (
              targetConversationId &&
              targetConversationId !== activeConversationIdRef.current
            ) {
              useConversationStore
                .getState()
                .setActiveConversation(targetConversationId)
            }
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
  }, [itemsMap]) // Add itemsMap as dependency to capture latest context items

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
        right: 0
      }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-sm select-none">
          Drop files to attach to conversation
        </p>
      </div>
    </div>
  )
}
