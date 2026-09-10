// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { toast } from '@/components/ui/toast'
import {
  useAddQueuedMessage,
  useDeleteQueuedMessage,
  useMergeQueuedMessages,
  useQueuedMessages,
  useQueueEvents,
  useReorderQueuedMessages,
  useUpdateQueuedMessage
} from '@/hooks/use-queued-messages'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const commands = vi.hoisted(
  () =>
    ({
      listQueuedMessages: vi.fn(),
      addQueuedMessage: vi.fn(),
      updateQueuedMessage: vi.fn(),
      deleteQueuedMessage: vi.fn(),
      reorderQueuedMessages: vi.fn(),
      mergeQueuedMessages: vi.fn()
    }) as Record<string, ReturnType<typeof vi.fn>>
)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

const onQueueEvent = vi.hoisted(() => vi.fn())
vi.mock('@/lib/events', () => ({ onQueueEvent }))

const C = 'aaaaaaaa-0000-1111-2222-333333333333'

function queued(id: string) {
  return {
    id,
    conversation_id: C,
    content: 'hello',
    position: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01'
  }
}

afterEach(cleanup)

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
  onQueueEvent.mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('useQueuedMessages', () => {
  it('lists queued messages for the conversation', async () => {
    commands.listQueuedMessages.mockResolvedValue({
      status: 'ok',
      data: [queued('q1')]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useQueuedMessages(C), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual([queued('q1')]))
    expect(commands.listQueuedMessages).toHaveBeenCalledWith(C)
  })

  it('stays idle without a conversation id', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useQueuedMessages(null), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(commands.listQueuedMessages).not.toHaveBeenCalled()
  })
})

describe('useAddQueuedMessage', () => {
  it('queues a message, invalidates, and toasts', async () => {
    commands.addQueuedMessage.mockResolvedValue({
      status: 'ok',
      data: queued('q1')
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAddQueuedMessage(C), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ content: 'hello' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.addQueuedMessage).toHaveBeenCalledWith({
      conversation_id: C,
      content: 'hello',
      context_items: null
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['queued-messages', C]
    })
    expect(toast.success).toHaveBeenCalledWith('Message queued')
  })

  it('passes context items through', async () => {
    commands.addQueuedMessage.mockResolvedValue({
      status: 'ok',
      data: queued('q1')
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useAddQueuedMessage(C), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ content: 'hi', contextItems: [{ id: 'i1' }] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.addQueuedMessage).toHaveBeenCalledWith({
      conversation_id: C,
      content: 'hi',
      context_items: [{ id: 'i1' }]
    })
  })

  it('toasts an error when it fails', async () => {
    commands.addQueuedMessage.mockResolvedValue({
      status: 'error',
      error: 'busy'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useAddQueuedMessage(C), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ content: 'hello' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('Failed to queue message: busy')
  })
})

describe('queued message mutations', () => {
  it('updates and invalidates', async () => {
    commands.updateQueuedMessage.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateQueuedMessage(C), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ id: 'q1', content: 'updated' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.updateQueuedMessage).toHaveBeenCalledWith('q1', 'updated')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['queued-messages', C]
    })
  })

  it('deletes and invalidates', async () => {
    commands.deleteQueuedMessage.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteQueuedMessage(C), {
      wrapper: wrapper(client)
    })
    result.current.mutate('q1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.deleteQueuedMessage).toHaveBeenCalledWith('q1')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['queued-messages', C]
    })
  })

  it('reorders and invalidates', async () => {
    commands.reorderQueuedMessages.mockResolvedValue({
      status: 'ok',
      data: null
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useReorderQueuedMessages(C), {
      wrapper: wrapper(client)
    })
    result.current.mutate(['q2', 'q1'])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.reorderQueuedMessages).toHaveBeenCalledWith(C, ['q2', 'q1'])
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['queued-messages', C]
    })
  })

  it('merges and invalidates', async () => {
    commands.mergeQueuedMessages.mockResolvedValue({
      status: 'ok',
      data: queued('q1')
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useMergeQueuedMessages(C), {
      wrapper: wrapper(client)
    })
    result.current.mutate(['q1', 'q2'])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.mergeQueuedMessages).toHaveBeenCalledWith(['q1', 'q2'])
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['queued-messages', C]
    })
  })
})

describe('useQueueEvents', () => {
  it('invalidates on message_sent and cleans up on unmount', async () => {
    let unlisten: (() => void) | null = null
    let handleEvent: ((event: unknown) => void) | null = null
    onQueueEvent.mockImplementation((handler) => {
      handleEvent = handler
      unlisten = vi.fn()
      return Promise.resolve(unlisten)
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { unmount } = renderHook(() => useQueueEvents(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(handleEvent).toBeDefined())
    handleEvent!({ type: 'message_sent', conversation_id: C })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['queued-messages', C]
    })
    handleEvent!({ type: 'something_else' })
    unmount()
    expect(unlisten).toHaveBeenCalled()
  })
})
