// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import {
  useCloseWorkspace,
  useOpenWorkspace,
  useUpdateWorkspace,
  useWorkspaces
} from '@/hooks/use-workspaces'

const commands = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  openWorkspace: vi.fn(),
  closeWorkspace: vi.fn(),
  updateWorkspace: vi.fn()
}) as Record<string, ReturnType<typeof vi.fn>>)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

afterEach(cleanup)

const ws = { id: 'w1', name: 'workspace' }

describe('useWorkspaces', () => {
  it('returns the workspace list on success', async () => {
    commands.listWorkspaces.mockResolvedValue({ status: 'ok', data: [ws] })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useWorkspaces(), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.data).toEqual([ws]))
  })

  it('surfaces an error when the command fails', async () => {
    commands.listWorkspaces.mockResolvedValue({ status: 'error', error: 'boom' })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useWorkspaces(), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(new Error('boom'))
  })
})

describe('useOpenWorkspace', () => {
  it('opens a workspace and invalidates the list', async () => {
    commands.openWorkspace.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useOpenWorkspace(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('/path')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.openWorkspace).toHaveBeenCalledWith('/path')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
  })

  it('throws on an error response', async () => {
    commands.openWorkspace.mockResolvedValue({ status: 'error', error: 'nope' })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useOpenWorkspace(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('/path')
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCloseWorkspace', () => {
  it('closes a workspace and invalidates the list', async () => {
    commands.closeWorkspace.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCloseWorkspace(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('w1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.closeWorkspace).toHaveBeenCalledWith('w1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
  })
})

describe('useUpdateWorkspace', () => {
  it('optimistically updates the cache and settles with a refetch', async () => {
    const updated = { ...ws, avatar_style: 'b' }
    commands.updateWorkspace.mockResolvedValue({ status: 'ok', data: updated })
    commands.listWorkspaces.mockResolvedValue({ status: 'ok', data: [ws] })
    const client = createTestQueryClient()
    client.setQueryData(['workspaces'], [ws])
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateWorkspace(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ id: 'w1', avatar_style: 'b' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.updateWorkspace).toHaveBeenCalledWith('w1', 'b')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['workspaces'] })
  })

  it('rolls back the optimistic update on error', async () => {
    commands.updateWorkspace.mockResolvedValue({ status: 'error', error: 'x' })
    const client = createTestQueryClient()
    client.setQueryData(['workspaces'], [ws])
    const { result } = renderHook(() => useUpdateWorkspace(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ id: 'w1', avatar_style: 'b' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    await waitFor(() =>
      expect(client.getQueryData(['workspaces'])).toEqual([ws])
    )
  })
})