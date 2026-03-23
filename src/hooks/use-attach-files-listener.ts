import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useChatContextStore } from '@/store/chat-context-store'

export function useAttachFilesListener() {
  const addFile = useChatContextStore((s) => s.addFile)

  useEffect(() => {
    let unlistenFn: (() => void) | undefined

    const setup = async () => {
      unlistenFn = await listen<{ conversation_id: string; paths: string[] }>(
        'skilldeck:attach-files',
        (event) => {
          const { conversation_id, paths } = event.payload
          for (const path of paths) {
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
  }, [addFile])
}
