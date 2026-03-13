/**
 * MCP server data hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listMcpServers,
  connectMcpServer,
  disconnectMcpServer
} from '@/lib/invoke'
import type { UUID } from '@/lib/types'

export function useMcpServers() {
  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: listMcpServers,
    staleTime: 15_000,
    refetchInterval: 30_000
  })
}

export function useConnectMcpServer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: UUID) => connectMcpServer(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
  })
}

export function useDisconnectMcpServer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: UUID) => disconnectMcpServer(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
  })
}
