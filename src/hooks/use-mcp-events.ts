// src/hooks/use-mcp-events.ts
/**
 * useMcpEvents — subscribe to Tauri mcp-event channel and keep mcp-servers
 * query fresh whenever a server connects, disconnects, or discovers a tool.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { McpEvent } from '@/lib/events'
import { onMcpEvent } from '@/lib/events'

export function useMcpEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null

    const handleEvent = (event: McpEvent) => {
      switch (event.type) {
        case 'server_connected':
        case 'server_disconnected':
        case 'tool_discovered':
          // Any MCP state change → refresh the server list.
          queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
          break
      }
    }

    onMcpEvent(handleEvent).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [queryClient])
}
