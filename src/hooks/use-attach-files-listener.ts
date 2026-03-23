import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'sonner'
import { useChatContextStore } from '@/store/chat-context-store'

export function useAttachFilesListener() {
  const addFile = useChatContextStore((s) => s.addFile)
  const itemsMap = useChatContextStore((s) => s.items)

  useEffect(() => {
    let unlistenFn: (() => void) | undefined

    const setup = async () => {
      unlistenFn = await listen<{ conversation_id: string; paths: string[] }>(
        'skilldeck:attach-files',
        (event) => {
          const { conversation_id, paths } = event.payload

          // Get current items for this conversation to check duplicates
          const currentItems = itemsMap[conversation_id] ?? []
          const existingPaths = new Set(
            currentItems
              .filter((item) => item.type === 'file')
              .map((item) => (item as any).data?.path)
              .filter((p): p is string => !!p)
          )

          const newPaths = paths.filter((p) => !existingPaths.has(p))
          if (newPaths.length < paths.length) {
            const duplicates = paths.filter((p) => existingPaths.has(p))
            toast.warning(`Already attached: ${duplicates.join(', ')}`)
          }

          for (const path of newPaths) {
            const name = path.split('/').pop() || path
            addFile(conversation_id, { id: path, name, path, size: undefined })
          }
        }
      )
    }

    setup()

    return () => {
      unlistenFn?.()
    }
  }, [addFile, itemsMap])
}
