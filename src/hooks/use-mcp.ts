/**
 * MCP server data hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { AddMcpServerPayload } from '@/lib/bindings'
import type { UUID } from '@/lib/types'

export function useMcpServers() {
  return useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      const res = await commands.listMcpServers()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 15_000,
    refetchInterval: 30_000
  })
}

export function useConnectMcpServer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.connectMcpServer(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
  })
}

export function useDisconnectMcpServer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.disconnectMcpServer(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
  })
}

export function useAddMcpServer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: AddMcpServerPayload) => {
      const res = await commands.addMcpServer(params)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
  })
}

export function useRemoveMcpServer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.removeMcpServer(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
  })
}
