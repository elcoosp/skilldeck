// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useBranches, useCreateBranch } from '@/hooks/use-branches'

const commands = vi.hoisted(() => ({
  createBranch: vi.fn(),
  listBranches: vi.fn()
}) as Record<string, ReturnType<typeof vi.fn>>)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

afterEach(cleanup)

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
})

const branch = { id: 'b1', name: 'main', parent_message_id: 'm1', created_at: 't', message_count: 1 }

describe('useCreateBranch', () => {
  it('creates a branch and invalidates the branch list', async () => {
    commands.createBranch.mockResolvedValue({ status: 'ok', data: branch })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateBranch(), {
      wrapper: wrapper(client)
    })
    const req = { conversation_id: 'c1', parent_message_id: 'm1', content: 'hi' }
    result.current.mutate(req as never)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.createBranch).toHaveBeenCalledWith(req)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['branches'] })
  })

  it('throws when the command returns an error', async () => {
    commands.createBranch.mockResolvedValue({ status: 'error', error: 'x' })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useCreateBranch(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({} as never)
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useBranches', () => {
  it('returns branches for the conversation', async () => {
    commands.listBranches.mockResolvedValue({ status: 'ok', data: [branch] })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useBranches('c1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual([branch]))
    expect(commands.listBranches).toHaveBeenCalledWith('c1')
  })

  it('stays disabled with no conversation id', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useBranches(null), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isFetched).toBe(false))
    expect(commands.listBranches).not.toHaveBeenCalled()
  })

  it('surfaces the command error', async () => {
    commands.listBranches.mockResolvedValue({ status: 'error', error: 'boom' })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useBranches('c1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})