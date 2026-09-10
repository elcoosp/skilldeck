// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import {
  useAddMcpServer,
  useConnectMcpServer,
  useDisconnectMcpServer,
  useMcpServers,
  useRemoveMcpServer
} from '@/hooks/use-mcp'

const commands = vi.hoisted(
  () =>
    ({
      listMcpServers: vi.fn(),
      connectMcpServer: vi.fn(),
      disconnectMcpServer: vi.fn(),
      addMcpServer: vi.fn(),
      removeMcpServer: vi.fn()
    }) as Record<string, ReturnType<typeof vi.fn>>
)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

afterEach(cleanup)

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
})

const UUID = '11111111-2222-3333-4444-555555555555'

function server(id: string) {
  return {
    id,
    name: 'server',
    enabled: true,
    command: 'npx',
    args: ['-y', 'server'],
    env: null
  }
}

describe('useMcpServers', () => {
  it('lists the configured MCP servers', async () => {
    commands.listMcpServers.mockResolvedValue({
      status: 'ok',
      data: [server(UUID)]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useMcpServers(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual([server(UUID)]))
    expect(commands.listMcpServers).toHaveBeenCalled()
  })
})

describe('MCP server mutations', () => {
  it('connects and invalidates the server list', async () => {
    commands.connectMcpServer.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useConnectMcpServer(), {
      wrapper: wrapper(client)
    })
    result.current.mutate(UUID)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.connectMcpServer).toHaveBeenCalledWith(UUID)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['mcp-servers'] })
  })

  it('disconnects and invalidates the server list', async () => {
    commands.disconnectMcpServer.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDisconnectMcpServer(), {
      wrapper: wrapper(client)
    })
    result.current.mutate(UUID)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.disconnectMcpServer).toHaveBeenCalledWith(UUID)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['mcp-servers'] })
  })

  it('adds a server with the given payload', async () => {
    commands.addMcpServer.mockResolvedValue({
      status: 'ok',
      data: server(UUID)
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAddMcpServer(), {
      wrapper: wrapper(client)
    })
    const payload = {
      name: 'server',
      command: 'npx',
      args: ['-y', 'server'],
      env: null,
      enabled: true
    }
    result.current.mutate(payload)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.addMcpServer).toHaveBeenCalledWith(payload)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['mcp-servers'] })
  })

  it('removes a server and invalidates the list', async () => {
    commands.removeMcpServer.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRemoveMcpServer(), {
      wrapper: wrapper(client)
    })
    result.current.mutate(UUID)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.removeMcpServer).toHaveBeenCalledWith(UUID)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['mcp-servers'] })
  })

  it('surfaces an error on a failed connect', async () => {
    commands.connectMcpServer.mockResolvedValue({
      status: 'error',
      error: 'down'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useConnectMcpServer(), {
      wrapper: wrapper(client)
    })
    result.current.mutate(UUID)
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
