// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { toast } from '@/components/ui/toast'
import {
  useMessages,
  useMessagesWithStream,
  useSendMessage
} from '@/hooks/use-messages'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const commands = vi.hoisted(
  () =>
    ({
      listMessages: vi.fn(),
      sendMessage: vi.fn(),
      listAchievements: vi.fn(),
      unlockAchievement: vi.fn()
    }) as Record<string, ReturnType<typeof vi.fn>>
)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

function message(
  overrides: Partial<MessageDataFixture> = {}
): MessageDataFixture {
  return {
    id: 'm1',
    conversation_id: 'c1',
    role: 'user',
    content: 'hi',
    created_at: '2026-01-01',
    context_items: null,
    metadata: null,
    seen: true,
    input_tokens: null,
    output_tokens: null,
    node_document: null,
    status: 'completed',
    ...overrides
  }
}
type MessageDataFixture = {
  id: string
  conversation_id: string
  role: string
  content: string
  created_at: string
  context_items: unknown
  metadata: unknown
  seen: boolean
  input_tokens: number | null
  output_tokens: number | null
  node_document: unknown
  status: string
}

const initialUIEphemeral = useUIEphemeralStore.getState()

afterEach(() => {
  cleanup()
  useUIEphemeralStore.setState(initialUIEphemeral, true)
})

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
  commands.listAchievements.mockResolvedValue({ status: 'ok', data: [] })
  commands.unlockAchievement.mockResolvedValue({ status: 'ok' })
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('useMessages', () => {
  it('returns messages for the conversation branch', async () => {
    commands.listMessages.mockResolvedValue({ status: 'ok', data: [message()] })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useMessages('c1', 'b1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual([message()]))
    expect(commands.listMessages).toHaveBeenCalledWith('c1', 'b1')
  })

  it('defaults the branch to null', async () => {
    commands.listMessages.mockResolvedValue({ status: 'ok', data: [] })
    const client = createTestQueryClient()
    renderHook(() => useMessages('c1'), { wrapper: wrapper(client) })
    await waitFor(() =>
      expect(commands.listMessages).toHaveBeenCalledWith('c1', null)
    )
  })

  it('stays disabled with no conversation id', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useMessages(null), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isFetched).toBe(false))
    expect(commands.listMessages).not.toHaveBeenCalled()
  })
})

describe('useSendMessage', () => {
  it('sends a message and invalidates the caches', async () => {
    commands.sendMessage.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSendMessage('c1'), {
      wrapper: wrapper(client)
    })
    result.current.mutate({
      thinking: false,
      content: 'hello',
      contextItems: []
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.sendMessage).toHaveBeenCalledWith({
      thinking: false,
      conversation_id: 'c1',
      content: 'hello',
      branch_id: null,
      context_items: []
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['messages', 'c1']
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] })
  })

  it('context items default to null', async () => {
    commands.sendMessage.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSendMessage('c1'), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ thinking: true, content: 'x' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.sendMessage).toHaveBeenCalledWith({
      thinking: true,
      conversation_id: 'c1',
      content: 'x',
      branch_id: null,
      context_items: null
    })
  })

  it('unlocks the first message achievement for a single user message', async () => {
    commands.sendMessage.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    client.setQueryData(
      ['messages', 'c1'],
      [message({ role: 'user', id: 'u1' })]
    )
    const { result } = renderHook(() => useSendMessage('c1'), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ thinking: false, content: 'hello' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await waitFor(() =>
      expect(commands.unlockAchievement).toHaveBeenCalledWith('first-message')
    )
  })
})

describe('useMessagesWithStream', () => {
  it('appends a streaming bubble while the agent is running', async () => {
    commands.listMessages.mockResolvedValue({
      status: 'ok',
      data: [message({ role: 'user', id: 'u1', content: 'hello' })]
    })
    useUIEphemeralStore.setState({
      agentRunning: { c1: true },
      streamingText: { c1: 'streaming reply' }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useMessagesWithStream('c1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => {
      expect(result.current[result.current.length - 1]).toMatchObject({
        id: '__streaming__',
        role: 'assistant',
        content: 'streaming reply'
      })
    })
  })

  it('returns pure messages when there is nothing streaming', async () => {
    commands.listMessages.mockResolvedValue({
      status: 'ok',
      data: [message({ role: 'assistant', id: 'a1' })]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useMessagesWithStream('c1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0].id).toBe('a1')
  })

  it('skips the bubble on errors', async () => {
    commands.listMessages.mockResolvedValue({
      status: 'ok',
      data: [message({ role: 'user', id: 'u1' })]
    })
    useUIEphemeralStore.setState({
      streamingError: { c1: true }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useMessagesWithStream('c1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0].id).toBe('u1')
  })
})
