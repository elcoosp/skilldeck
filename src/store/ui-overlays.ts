import { create } from 'zustand'

interface UIOverlaysState {
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  globalSearchOpen: boolean
  setGlobalSearchOpen: (open: boolean) => void
}

export const useUIOverlaysStore = create<UIOverlaysState>((set) => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  globalSearchOpen: false,
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open })
}))
