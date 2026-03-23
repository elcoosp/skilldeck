// src/hooks/use-tool-approvals.ts
import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useToolApprovalStore } from '@/store/tool-approvals'
import type { ToolCallInfo } from '@/lib/events'

interface ApprovalEventPayload {
  toolCallId: string
  toolName: string
  arguments: Record<string, unknown>
  conversationId: string
}

export function useToolApprovals(conversationId: string | null) {
  const addPending = useToolApprovalStore((s) => s.addPending)

  useEffect(() => {
    if (!conversationId) return

    let unlisten: (() => void) | undefined

    const setup = async () => {
      const unlistenFn = await listen<ApprovalEventPayload>(
        'tool-approval-requested',
        (event) => {
          if (event.payload.conversationId !== conversationId) return
          addPending(event.payload.toolCallId, {
            name: event.payload.toolName,
            arguments: event.payload.arguments,
          })
        }
      )
      unlisten = unlistenFn
    }

    setup()

    return () => {
      if (unlisten) unlisten()
    }
  }, [conversationId, addPending])
}
