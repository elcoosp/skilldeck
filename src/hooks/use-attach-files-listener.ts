// src/hooks/use-attach-files-listener.ts
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
          const { paths } = event.payload
          for (const path of paths) {
            const name = path.split('/').pop() || path
            addFile({ id: path, name, path, size: undefined })
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
