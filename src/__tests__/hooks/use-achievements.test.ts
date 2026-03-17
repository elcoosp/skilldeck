import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAchievements } from '@/hooks/use-achievements'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn()
  }
}))

describe('useAchievements', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('unlocks a new achievement and stores it', () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.unlock('firstMessage')
    })

    expect(result.current.isUnlocked('firstMessage')).toBe(true)
    expect(localStorage.getItem('skilldeck-achievements')).toBe(
      JSON.stringify(['first-message'])
    )
  })

  it('does not unlock the same achievement twice', () => {
    const { result } = renderHook(() => useAchievements())

    act(() => {
      result.current.unlock('firstMessage')
      result.current.unlock('firstMessage')
    })

    const stored = JSON.parse(localStorage.getItem('skilldeck-achievements')!)
    expect(stored).toHaveLength(1)
  })

  it('returns false for an unlocked achievement', () => {
    const { result } = renderHook(() => useAchievements())

    expect(result.current.isUnlocked('firstMessage')).toBe(false)
  })

  it('loads previously unlocked achievements from localStorage', () => {
    localStorage.setItem(
      'skilldeck-achievements',
      JSON.stringify(['first-message'])
    )

    const { result } = renderHook(() => useAchievements())

    expect(result.current.isUnlocked('firstMessage')).toBe(true)
  })
})
