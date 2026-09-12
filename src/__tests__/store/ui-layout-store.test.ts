import { beforeEach, describe, expect, it } from 'vitest'
import { useUILayoutStore } from '@/store/ui-layout'

const initialState = useUILayoutStore.getState()

beforeEach(() => {
  useUILayoutStore.setState(initialState, true)
  localStorage.removeItem('skilldeck-ui-layout')
})

describe('useUILayoutStore', () => {
  it('defaults to zero panel sizes and default tabs', () => {
    const s = useUILayoutStore.getState()
    expect(s.panelSizesPx).toEqual({ left: 0, center: 0, right: 0 })
    expect(s.leftTab).toBe('conversations')
    expect(s.rightTab).toBe('session')
  })

  it('setPanelSizesPx merges partial sizes', () => {
    useUILayoutStore.getState().setPanelSizesPx({ left: 300 })
    expect(useUILayoutStore.getState().panelSizesPx).toEqual({
      left: 300,
      center: 0,
      right: 0
    })
    useUILayoutStore.getState().setPanelSizesPx({ center: 600 })
    expect(useUILayoutStore.getState().panelSizesPx).toEqual({
      left: 300,
      center: 600,
      right: 0
    })
  })

  it('setLeftTab updates the left tab', () => {
    useUILayoutStore.getState().setLeftTab('skills')
    expect(useUILayoutStore.getState().leftTab).toBe('skills')
  })

  it('setRightTab updates the right tab', () => {
    useUILayoutStore.getState().setRightTab('mcp')
    expect(useUILayoutStore.getState().rightTab).toBe('mcp')
  })

  it('persists the chosen slice (tabs) to localStorage', () => {
    useUILayoutStore.getState().setLeftTab('community')
    useUILayoutStore.getState().setRightTab('workflow')
    const raw = localStorage.getItem('skilldeck-ui-layout')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string).state as {
      leftTab: string
      rightTab: string
    }
    expect(parsed.leftTab).toBe('community')
    expect(parsed.rightTab).toBe('workflow')
    expect('panelSizesPx' in parsed).toBe(false)
  })
})
