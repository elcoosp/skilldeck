// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useBookmarks, useToggleBookmark } from '@/hooks/use-bookmarks'

const commands = vi.hoisted(() => ({
  listBookmarks: vi.fn(),
  toggleBookmark: vi.fn()
}) as Record<string, ReturnType<typeof vi.fn>>)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

afterEach(cleanup)

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
})

const bookmark = { id: 'bm1', message_id: 'm1', heading_anchor: null, label: 'L' }

describe('useBookmarks', () => {
  it('returns the bookmarks for the conversation', async () => {
    commands.listBookmarks.mockResolvedValue({ status: 'ok', data: [bookmark] })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useBookmarks('c1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual([bookmark]))
    expect(commands.listBookmarks).toHaveBeenCalledWith('c1')
  })

  it('stays disabled with no conversation id', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useBookmarks(null), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isFetched).toBe(false))
    expect(commands.listBookmarks).not.toHaveBeenCalled()
  })

  it('surfaces the command error', async () => {
    commands.listBookmarks.mockResolvedValue({ status: 'error', error: 'boom' })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useBookmarks('c1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useToggleBookmark', () => {
  it('toggles a bookmark and invalidates that conversation', async () => {
    commands.toggleBookmark.mockResolvedValue({ status: 'ok', data: bookmark })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useToggleBookmark('c1'), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ messageId: 'm1', headingAnchor: 'h', label: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.toggleBookmark).toHaveBeenCalledWith('c1', 'm1', 'h', null)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookmarks', 'c1'] })
  })

  it('defaults optional args to null', async () => {
    commands.toggleBookmark.mockResolvedValue({ status: 'ok', data: bookmark })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useToggleBookmark('c1'), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ messageId: 'm1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.toggleBookmark).toHaveBeenCalledWith('c1', 'm1', null, null)
  })

  it('throws without a conversation id', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useToggleBookmark(null), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ messageId: 'm1' })
    await waitFor(() =>
      expect(result.current.error).toEqual(new Error('No conversation ID'))
    )
  })
})