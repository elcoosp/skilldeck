// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { toast } from '@/components/ui/toast'
import {
  useActiveConversationWorkspaceId,
  useAutoNameConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  usePinConversation,
  useRenameConversation,
  useUnpinConversation
} from '@/hooks/use-conversations'
import { useConversationStore } from '@/store/conversation'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const commands = vi.hoisted(
  () =>
    ({
      listConversations: vi.fn(),
      createConversation: vi.fn(),
      deleteConversation: vi.fn(),
      renameConversation: vi.fn(),
      pinConversation: vi.fn(),
      unpinConversation: vi.fn(),
      listProfiles: vi.fn()
    }) as Record<string, ReturnType<typeof vi.fn>>
)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

const initialConversation = useConversationStore.getState()

afterEach(() => {
  cleanup()
  useConversationStore.setState(initialConversation, true)
})

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
  commands.listProfiles.mockResolvedValue({
    status: 'ok',
    data: [{ id: 'p1', is_default: true }]
  })
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

const conv = { id: 'c1', title: 'Chat', profile_id: 'p1' }

describe('useConversations', () => {
  it('returns the conversation list for the profile', async () => {
    commands.listConversations.mockResolvedValue({ status: 'ok', data: [conv] })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useConversations('p1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual([conv]))
    expect(commands.listConversations).toHaveBeenCalledWith('p1', 50)
  })

  it('surfaces an error', async () => {
    commands.listConversations.mockResolvedValue({
      status: 'error',
      error: 'x'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useConversations(null), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 6000
    })
  })
})

describe('useCreateConversation', () => {
  it('creates a conversation and activates it', async () => {
    commands.createConversation.mockResolvedValue({ status: 'ok', data: 'c9' })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useCreateConversation('p1'), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ title: 'New chat' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.createConversation).toHaveBeenCalledWith(
      'p1',
      'New chat',
      null
    )
    await waitFor(() =>
      expect(useConversationStore.getState().activeConversationId).toBe('c9')
    )
    expect(toast.success).toHaveBeenCalledWith('Conversation created')
  })

  it('throws without a selected profile', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useCreateConversation(undefined), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ title: 'x' })
    await waitFor(() =>
      expect(result.current.error).toEqual(new Error('No profile selected'))
    )
  })
})

describe('useDeleteConversation', () => {
  it('clears the active conversation when it is deleted', async () => {
    commands.deleteConversation.mockResolvedValue({ status: 'ok', data: null })
    useConversationStore.getState().setActiveConversation('c1')
    const client = createTestQueryClient()
    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('c1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(useConversationStore.getState().activeConversationId).toBeNull()
    expect(toast.success).toHaveBeenCalledWith('Conversation deleted')
  })

  it('keeps the active conversation when another is deleted', async () => {
    commands.deleteConversation.mockResolvedValue({ status: 'ok', data: null })
    useConversationStore.getState().setActiveConversation('c1')
    const client = createTestQueryClient()
    const { result } = renderHook(() => useDeleteConversation(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('c2')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(useConversationStore.getState().activeConversationId).toBe('c1')
  })
})

describe('useRenameConversation', () => {
  it('renames and invalidates the list', async () => {
    commands.renameConversation.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRenameConversation(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ id: 'c1', title: 'Renamed' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.renameConversation).toHaveBeenCalledWith('c1', 'Renamed')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] })
    expect(toast.success).toHaveBeenCalledWith('Conversation renamed')
  })
})

describe('useAutoNameConversation', () => {
  it('trims, slices, and capitalizes the first message', async () => {
    commands.renameConversation.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useAutoNameConversation(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ id: 'c1', firstMessage: '  hello world  ' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.renameConversation).toHaveBeenCalledWith(
      'c1',
      'Hello world'
    )
  })
})

describe('pin and unpin', () => {
  it('pins a conversation', async () => {
    commands.pinConversation.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const { result } = renderHook(() => usePinConversation(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('c1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.pinConversation).toHaveBeenCalledWith('c1')
    expect(toast.success).toHaveBeenCalledWith('Conversation pinned')
  })

  it('unpins a conversation', async () => {
    commands.unpinConversation.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useUnpinConversation(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('c1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.unpinConversation).toHaveBeenCalledWith('c1')
    expect(toast.success).toHaveBeenCalledWith('Conversation unpinned')
  })
})

describe('useActiveConversationWorkspaceId', () => {
  it('looks up the default profile conversation workspace', async () => {
    commands.listConversations.mockResolvedValue({
      status: 'ok',
      data: [{ id: 'c1', workspace_id: 'w9' }]
    })
    useConversationStore.getState().setActiveConversation('c1')
    const client = createTestQueryClient()
    client.setQueryData(
      ['conversations', 'p1'],
      [{ id: 'c1', workspace_id: 'w9' }]
    )
    const { result } = renderHook(() => useActiveConversationWorkspaceId(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current).toBe('w9'))
  })

  it('returns null when the conversation has no workspace', async () => {
    useConversationStore.getState().setActiveConversation('nope')
    const client = createTestQueryClient()
    client.setQueryData(
      ['conversations', 'p1'],
      [{ id: 'c1', workspace_id: null }]
    )
    const { result } = renderHook(() => useActiveConversationWorkspaceId(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current).toBeNull())
  })
})
