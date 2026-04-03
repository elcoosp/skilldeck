import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UILayoutState {
  panelSizesPx: { left: number; right: number }
  setPanelSizesPx: (sizes: { left: number; right: number }) => void
  leftTab: 'conversations' | 'skills' | 'community'
  setLeftTab: (tab: 'conversations' | 'skills' | 'community') => void
  rightTab:
    | 'session'
    | 'skills'
    | 'mcp'
    | 'workflow'
    | 'analytics'
    | 'artifacts'
  setRightTab: (
    tab: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics'
  ) => void
}

export const useUILayoutStore = create<UILayoutState>()(
  persist(
    (set) => ({
      panelSizesPx: { left: 0, right: 0 },
      setPanelSizesPx: (sizes) => set({ panelSizesPx: { ...sizes } }),
      leftTab: 'conversations',
      setLeftTab: (tab) => set({ leftTab: tab }),
      rightTab: 'session',
      setRightTab: (tab) => set({ rightTab: tab })
    }),
    {
      name: 'skilldeck-ui-layout',
      partialize: (state) => ({
        leftTab: state.leftTab,
        rightTab: state.rightTab
      })
    }
  )
)
