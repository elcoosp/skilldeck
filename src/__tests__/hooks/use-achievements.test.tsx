// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAchievements } from '@/hooks/use-achievements'
import * as bindings from '@/lib/bindings'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn()
  }
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

describe('useAchievements', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.spyOn(bindings.commands, 'listAchievements').mockResolvedValue({
      status: 'ok',
      data: []
    })
    vi.spyOn(bindings.commands, 'unlockAchievement').mockResolvedValue({
      status: 'ok',
      data: null
    })
  })

  it('unlocks a new achievement and stores it', async () => {
    const { result } = renderHook(() => useAchievements(), { wrapper })

    act(() => {
      result.current.unlock('firstMessage')
    })

    await waitFor(() => {
      expect(result.current.isUnlocked('firstMessage')).toBe(true)
    })
    expect(bindings.commands.unlockAchievement).toHaveBeenCalledWith(
      'first-message'
    )
  })

  it('does not unlock the same achievement twice', async () => {
    const { result } = renderHook(() => useAchievements(), { wrapper })

    act(() => {
      result.current.unlock('firstMessage')
    })
    await waitFor(() => {
      expect(result.current.isUnlocked('firstMessage')).toBe(true)
    })

    act(() => {
      result.current.unlock('firstMessage')
    })

    expect(bindings.commands.unlockAchievement).toHaveBeenCalledTimes(1)
  })

  it('returns false for a locked achievement', async () => {
    const { result } = renderHook(() => useAchievements(), { wrapper })

    await waitFor(() => {
      expect(result.current.isUnlocked('firstMessage')).toBe(false)
    })
  })

  it('loads previously unlocked achievements from the backend', async () => {
    vi.spyOn(bindings.commands, 'listAchievements').mockResolvedValue({
      status: 'ok',
      data: [{ id: 'first-message', unlocked_at: '2024-01-01' }]
    })

    const { result } = renderHook(() => useAchievements(), { wrapper })

    await waitFor(() => {
      expect(result.current.isUnlocked('firstMessage')).toBe(true)
    })
  })
})
