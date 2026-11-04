// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScrollToMessage } from '@/hooks/use-scroll-to-message'

const router = vi.hoisted(() => ({ useMatch: vi.fn() }))
vi.mock('@tanstack/react-router', () => router)

afterEach(cleanup)

describe('useScrollToMessage', () => {
  it('returns the messageId from the search params', () => {
    router.useMatch.mockReturnValue({ search: { messageId: 'm1' } })
    const { result } = renderHook(() => useScrollToMessage())
    expect(result.current).toBe('m1')
  })

  it('clears the messageId after 500ms', async () => {
    router.useMatch.mockReturnValue({ search: { messageId: 'm1' } })
    const { result } = renderHook(() => useScrollToMessage())
    expect(result.current).toBe('m1')
    await waitFor(() => expect(result.current).toBeNull(), { timeout: 1500 })
  })

  it('returns null with no messageId in the search', () => {
    router.useMatch.mockReturnValue({ search: {} })
    const { result } = renderHook(() => useScrollToMessage())
    expect(result.current).toBeNull()
  })
})
