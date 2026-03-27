import { create } from 'zustand';

export type SettingsTab =
  | 'apikeys'
  | 'profiles'
  | 'approvals'
  | 'appearance'
  | 'preferences'
  | 'referral'
  | 'platform'
  | 'lint'
  | 'sources'
  | 'achievements';

interface UIOverlaysState {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
}

export const useUIOverlaysStore = create<UIOverlaysState>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  globalSearchOpen: false,
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
  settingsTab: 'apikeys',
  setSettingsTab: (tab) => set({ settingsTab: tab }),
}));
