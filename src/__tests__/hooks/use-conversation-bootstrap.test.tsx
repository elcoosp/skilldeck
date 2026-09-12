// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useConversationBootstrap } from '@/hooks/use-conversation-bootstrap'

const commands = vi.hoisted(
  () =>
    ({
      getConversationBootstrap: vi.fn()
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

const C = 'aaaaaaaa-0000-1111-2222-333333333333'

const bootstrap = {
  messages: [],
  branches: [],
  draft: null,
  queued: [],
  headings: []
}

describe('useConversationBootstrap', () => {
  it('fetches the conversation bootstrap', async () => {
    commands.getConversationBootstrap.mockResolvedValue({
      status: 'ok',
      data: bootstrap
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useConversationBootstrap(C), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual(bootstrap))
    expect(commands.getConversationBootstrap).toHaveBeenCalledWith(C)
  })

  it('stays idle without a conversation id', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useConversationBootstrap(null), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(commands.getConversationBootstrap).not.toHaveBeenCalled()
  })

  it('surfaces an error', async () => {
    commands.getConversationBootstrap.mockResolvedValue({
      status: 'error',
      error: 'nope'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useConversationBootstrap(C), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
