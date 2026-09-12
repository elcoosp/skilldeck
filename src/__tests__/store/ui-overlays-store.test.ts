import { beforeEach, describe, expect, it } from 'vitest'
import { useUIOverlaysStore } from '@/store/ui-overlays'

const initialState = useUIOverlaysStore.getState()

beforeEach(() => {
  useUIOverlaysStore.setState(initialState, true)
})

describe('useUIOverlaysStore', () => {
  it('defaults both overlays closed', () => {
    const s = useUIOverlaysStore.getState()
    expect(s.commandPaletteOpen).toBe(false)
    expect(s.globalSearchOpen).toBe(false)
  })

  it('setCommandPaletteOpen opens and closes', () => {
    useUIOverlaysStore.getState().setCommandPaletteOpen(true)
    expect(useUIOverlaysStore.getState().commandPaletteOpen).toBe(true)
    useUIOverlaysStore.getState().setCommandPaletteOpen(false)
    expect(useUIOverlaysStore.getState().commandPaletteOpen).toBe(false)
  })

  it('setGlobalSearchOpen opens and closes', () => {
    useUIOverlaysStore.getState().setGlobalSearchOpen(true)
    expect(useUIOverlaysStore.getState().globalSearchOpen).toBe(true)
    useUIOverlaysStore.getState().setGlobalSearchOpen(false)
    expect(useUIOverlaysStore.getState().globalSearchOpen).toBe(false)
  })

  it('toggling one overlay does not affect the other', () => {
    useUIOverlaysStore.getState().setCommandPaletteOpen(true)
    expect(useUIOverlaysStore.getState().globalSearchOpen).toBe(false)
  })
})
