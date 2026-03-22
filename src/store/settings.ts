// src/store/settings.ts
/**
 * Application settings — persisted Zustand store.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ToolApprovalSettings {
  autoApproveReads: boolean
  autoApproveWrites: boolean
  autoApproveSelects: boolean
  autoApproveMutations: boolean
  autoApproveHttpRequests: boolean
  autoApproveShell: boolean
}

interface SettingsState {
  // Theme
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  // Tool approvals
  toolApprovals: ToolApprovalSettings
  setToolApprovals: (settings: Partial<ToolApprovalSettings>) => void

  // Telemetry
  telemetryEnabled: boolean
  setTelemetryEnabled: (enabled: boolean) => void

  // Notifications
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void

  // Default model (used when no profile exists or as fallback)
  defaultModelId: string
  defaultProvider: string
  setDefaultModelId: (id: string) => void
  setDefaultProvider: (provider: string) => void

  // Language
  language: string
  setLanguage: (lang: string) => void

  // Code block max height (px)
  codeBlockMaxHeight: number
  setCodeBlockMaxHeight: (px: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Tool approvals — all off by default (ASR-SEC-002)
      toolApprovals: {
        autoApproveReads: false,
        autoApproveWrites: false,
        autoApproveSelects: false,
        autoApproveMutations: false,
        autoApproveHttpRequests: false,
        autoApproveShell: false
      },
      setToolApprovals: (settings) =>
        set((state) => ({
          toolApprovals: { ...state.toolApprovals, ...settings }
        })),

      // Telemetry
      telemetryEnabled: false,
      setTelemetryEnabled: (enabled) => set({ telemetryEnabled: enabled }),

      // Notifications
      notificationsEnabled: true,
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),

      // Default model
      defaultModelId: 'glm-5:cloud',
      defaultProvider: 'ollama',
      setDefaultModelId: (id) => set({ defaultModelId: id }),
      setDefaultProvider: (provider) => set({ defaultProvider: provider }),

      // Language
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),

      // Code block max height
      codeBlockMaxHeight: 384,
      setCodeBlockMaxHeight: (px) => set({ codeBlockMaxHeight: px })
    }),
    {
      name: 'skilldeck-settings',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Add new field with default 384
          const migrated = { ...persistedState }
          migrated.codeBlockMaxHeight = 384
          return migrated
        }
        return persistedState
      }
    }
  )
)
