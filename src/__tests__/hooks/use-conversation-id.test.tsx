// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useConversationIdFromUrl } from '@/hooks/use-conversation-id'

const router = vi.hoisted(() => ({ useMatch: vi.fn() }))
vi.mock('@tanstack/react-router', () => router)

afterEach(cleanup)

describe('useConversationIdFromUrl', () => {
  it('returns the conversation id from the route params', () => {
    router.useMatch.mockReturnValue({ params: { conversationId: 'c42' } })
    const { result } = renderHook(() => useConversationIdFromUrl())
    expect(result.current).toBe('c42')
  })

  it('returns null when no match resolves', () => {
    router.useMatch.mockReturnValue(undefined)
    const { result } = renderHook(() => useConversationIdFromUrl())
    expect(result.current).toBeNull()
  })

  it('returns null when the param is missing', () => {
    router.useMatch.mockReturnValue({ params: {} })
    const { result } = renderHook(() => useConversationIdFromUrl())
    expect(result.current).toBeNull()
  })
})