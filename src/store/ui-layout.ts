import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UILayoutState {
  panelSizesPx: { left: number; right: number };
  setPanelSizesPx: (sizes: { left: number; right: number }) => void;
  leftTab: 'conversations' | 'skills' | 'community';
  setLeftTab: (tab: 'conversations' | 'skills' | 'community') => void;
  rightTab: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics' | 'artifacts';
  setRightTab: (tab: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics') => void;
  collapsedDateGroups: Record<string, boolean>;
  toggleDateGroup: (key: string) => void;
  setDateGroupCollapsed: (key: string, collapsed: boolean) => void;
}

export const useUILayoutStore = create<UILayoutState>()(
  persist(
    (set) => ({
      panelSizesPx: { left: 0, right: 0 },
      setPanelSizesPx: (sizes) => set({ panelSizesPx: { ...sizes } }),
      leftTab: 'conversations',
      setLeftTab: (tab) => set({ leftTab: tab }),
      rightTab: 'session',
      setRightTab: (tab) => set({ rightTab: tab }),
      collapsedDateGroups: {},
      toggleDateGroup: (key) =>
        set((state) => ({
          collapsedDateGroups: {
            ...state.collapsedDateGroups,
            [key]: !state.collapsedDateGroups[key],
          },
        })),
      setDateGroupCollapsed: (key, collapsed) =>
        set((state) => ({
          collapsedDateGroups: {
            ...state.collapsedDateGroups,
            [key]: collapsed,
          },
        })),
    }),
    {
      name: 'skilldeck-ui-layout',
      partialize: (state) => ({
        leftTab: state.leftTab,
        rightTab: state.rightTab,
        collapsedDateGroups: state.collapsedDateGroups,
      }),
    }
  )
);
