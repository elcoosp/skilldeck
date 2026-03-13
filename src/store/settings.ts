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

  // Default model
  defaultModelId: string
  setDefaultModelId: (id: string) => void

  // Language
  language: string
  setLanguage: (lang: string) => void
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
      defaultModelId: 'claude-sonnet-4-5',
      setDefaultModelId: (id) => set({ defaultModelId: id }),

      // Language
      language: 'en',
      setLanguage: (lang) => set({ language: lang })
    }),
    { name: 'skilldeck-settings' }
  )
)
