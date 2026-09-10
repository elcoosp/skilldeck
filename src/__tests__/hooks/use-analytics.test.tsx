// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useAnalytics } from '@/hooks/use-analytics'

const commands = vi.hoisted(
  () =>
    ({
      getAnalytics: vi.fn()
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

const rawAnalytics = {
  total_conversations: '3',
  total_messages: '10',
  messages_per_day: [{ date: '2026-01-01', count: '2' }],
  skills_used: [{ name: 'solo', count: '5' }],
  token_usage: {
    input_tokens: '1',
    output_tokens: '2',
    total_tokens: '3'
  }
}

describe('useAnalytics', () => {
  it('coerces counts and durations to numbers', async () => {
    commands.getAnalytics.mockResolvedValue({
      status: 'ok',
      data: {
        ...rawAnalytics,
        conversations_per_day: [{ date: '2026-01-02', count: '1' }]
      }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useAnalytics(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(result.current.data).toEqual({
      total_conversations: 3,
      total_messages: 10,
      messages_per_day: [{ date: '2026-01-01', count: 2 }],
      conversations_per_day: [{ date: '2026-01-02', count: 1 }],
      skills_used: [{ name: 'solo', count: 5 }],
      token_usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 }
    })
  })

  it('defaults missing conversations_per_day to an empty array', async () => {
    commands.getAnalytics.mockResolvedValue({
      status: 'ok',
      data: rawAnalytics
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useAnalytics(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(result.current.data?.conversations_per_day).toEqual([])
  })

  it('surfaces errors from the backend', async () => {
    commands.getAnalytics.mockResolvedValue({
      status: 'error',
      error: 'nope'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useAnalytics(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
