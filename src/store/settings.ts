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

  // Concierge UI new fields
  inputModelId: string | null
  setInputModelId: (id: string | null) => void
  thinkingEnabled: boolean
  setThinkingEnabled: (enabled: boolean) => void
  conversationSort: 'updated' | 'created'
  setConversationSort: (sort: 'updated' | 'created') => void
  uiFontSize: 'sm' | 'md' | 'lg'
  setUiFontSize: (size: 'sm' | 'md' | 'lg') => void
  preferredEditor: 'vscode' | 'cursor' | 'system'
  setPreferredEditor: (editor: 'vscode' | 'cursor' | 'system') => void
  audioEnabled: boolean
  setAudioEnabled: (enabled: boolean) => void
  audioVolume: number
  setAudioVolume: (volume: number) => void
  autoCompactionEnabled: boolean
  setAutoCompactionEnabled: (enabled: boolean) => void
  compactionTokenThreshold: number
  setCompactionTokenThreshold: (threshold: number) => void
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
      defaultModelId: '', // <-- changed from 'glm-5:cloud'
      defaultProvider: 'ollama',
      setDefaultModelId: (id) => set({ defaultModelId: id }),
      setDefaultProvider: (provider) => set({ defaultProvider: provider }),

      // Language
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),

      // Code block max height
      codeBlockMaxHeight: 384,
      setCodeBlockMaxHeight: (px) => set({ codeBlockMaxHeight: px }),

      // Concierge UI new fields
      inputModelId: null,
      setInputModelId: (id) => set({ inputModelId: id }),
      thinkingEnabled: false,
      setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),
      conversationSort: 'updated',
      setConversationSort: (sort) => set({ conversationSort: sort }),
      uiFontSize: 'md',
      setUiFontSize: (size) => set({ uiFontSize: size }),
      preferredEditor: 'system',
      setPreferredEditor: (editor) => set({ preferredEditor: editor }),
      audioEnabled: false,
      setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
      audioVolume: 0.5,
      setAudioVolume: (volume) =>
        set({ audioVolume: Math.min(1, Math.max(0, volume)) }),
      autoCompactionEnabled: false,
      setAutoCompactionEnabled: (enabled) =>
        set({ autoCompactionEnabled: enabled }),
      compactionTokenThreshold: 80000,
      setCompactionTokenThreshold: (threshold) =>
        set({ compactionTokenThreshold: threshold })
    }),
    {
      name: 'skilldeck-settings',
      version: 3
    }
  )
)
