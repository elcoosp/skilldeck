// src/components/chat/global-drop-zone.tsx
//
// OS-level drag-and-drop for the active conversation.
//
// WHY NOT document.body listeners?
// Tauri v2's webview intercepts dragover/drop from the OS *before* they reach
// JS.  document.body listeners see nothing when dragging from Finder/Explorer.
// The fix is tauri-plugin-drag-drop: it captures the OS events in Rust, emits
// them as Tauri events, and we listen with `onDragDropEvent` here.
//
// File.path is also undefined in webviews (Electron-ism); paths come from the
// plugin payload only.

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
  const leftPanelWidth = useUIStore((s) => s.panelSizes.left)
  const [isDragging, setIsDragging] = useState(false)
  // Track pending paths so the drop handler can use the last-seen paths even
  // if the `drop` payload is somehow empty (defensive).
  const pendingPathsRef = useRef<string[]>([])

  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setup = async () => {
      const webview = getCurrentWebviewWindow()
      unlisten = await webview.onDragDropEvent((event) => {
        const payload = event.payload as DragDropPayload

        // Always broadcast to per-item listeners in the left panel.
        window.dispatchEvent(
          new CustomEvent('skilldeck:drag-drop', { detail: payload })
        )

        switch (payload.type) {
          case 'enter':
          case 'over':
            if (payload.paths.length > 0) {
              pendingPathsRef.current = payload.paths
            }
            setIsDragging(true)
            break

          case 'drop': {
            setIsDragging(false)
            const paths = payload.paths.length > 0
              ? payload.paths
              : pendingPathsRef.current
            pendingPathsRef.current = []

            if (paths.length === 0) return

            // If drop landed in the left panel, let ConversationItem handle it.
            // Left panel occupies x = 0 .. leftPanelWidth.
            const x = payload.position.x
            if (x <= leftPanelWidth) return

            if (!activeConversationId) {
              toast.error('No active conversation to attach to')
              return
            }

            commands
              .attachFilesToConversation(activeConversationId, paths)
              .then((res) => {
                if (res.status === 'error') {
                  toast.error(res.error)
                } else {
                  toast.success(`Attached ${paths.length} file(s)`)
                }
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
    // Re-subscribe when the active conversation changes so the closure is fresh.
  }, [activeConversationId, leftPanelWidth])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 pointer-events-none transition-opacity duration-200',
        isDragging ? 'opacity-100' : 'opacity-0'
      )}
      // Exclude the left panel from the visual overlay.
      style={{ marginLeft: leftPanelWidth }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-sm select-none">
          Drop files to attach to current conversation
        </p>
      </div>
    </div>
  )
}
