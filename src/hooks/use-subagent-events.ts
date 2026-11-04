// src/hooks/use-subagent-events.ts

import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'
import { type SubagentState, useSubagentStore } from '@/store/subagent'

export function useSubagentEvents() {
  const updateStatus = useSubagentStore((s) => s.updateSubagentStatus)
  const setResult = useSubagentStore((s) => s.setSubagentResult)

  useEffect(() => {
    let unlistenStatus: (() => void) | undefined
    let unlistenArtifact: (() => void) | undefined

    const setup = async () => {
      unlistenStatus = await listen<{
        subagentId: string
        status: SubagentState['status']
      }>('subagent-status', (event) => {
        updateStatus(event.payload.subagentId, event.payload.status)
      })
      unlistenArtifact = await listen<{
        subagentId: string
        artifact: unknown
      }>('subagent-artifact', (event) => {
        // For now, treat artifacts as final result (simplified)
        setResult(
          event.payload.subagentId,
          JSON.stringify(event.payload.artifact)
        )
      })
    }

    setup()

    return () => {
      unlistenStatus?.()
      unlistenArtifact?.()
    }
  }, [updateStatus, setResult])
}
