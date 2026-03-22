// src/store/ui.ts
/**
 * UI state — Zustand store with selective persistence.
 *
 * Persisted across sessions:
 * - panelSizes (left/right panel widths)
 * - unlockStage (progressive feature unlock)
 * - leftTab (active left sidebar tab)
 * - rightTab (active right sidebar tab)
 *
 * All other state (active conversation, drafts, streaming, etc.) is ephemeral
 * and resets on app restart.
 *
 * Scroll positions are NOT stored here — see scrollPositionCache in center-panel.tsx.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PanelSizes {
  left: number
  right: number
}

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
  | 'achievements'

interface UIState {
  // ── Active workspace ──────────────────────────────────────────────────
  activeWorkspaceId: string | null
  setActiveWorkspace: (id: string | null) => void

  // ── Active conversation ───────────────────────────────────────────────
  activeConversationId: string | null
  setActiveConversation: (id: string | null) => void

  // ── Branch navigation ─────────────────────────────────────────────────
  activeBranchId: string | null
  setActiveBranch: (id: string | null) => void

  // ── Panel sizes (persisted) ───────────────────────────────────────────
  panelSizes: PanelSizes
  setPanelSizes: (sizes: Partial<PanelSizes>) => void

  // ── Draft messages (per conversation) ─────────────────────────────────
  drafts: Record<string, string>
  setDraft: (conversationId: string, content: string) => void
  clearDraft: (conversationId: string) => void

  // ── Streaming token buffer (per conversation) ─────────────────────────
  streamingText: Record<string, string>
  appendStreamingText: (conversationId: string, delta: string) => void
  clearStreamingText: (conversationId: string) => void

  // ── Agent running state (per conversation) ────────────────────────────
  agentRunning: Record<string, boolean>
  setAgentRunning: (conversationId: string, running: boolean) => void

  // ── Streaming error state (per conversation) ──────────────────────────
  streamingError: Record<string, boolean>
  setStreamingError: (conversationId: string, error: boolean) => void

  // ── Sidebar search ────────────────────────────────────────────────────
  searchQuery: string
  setSearchQuery: (query: string) => void

  // ── Within‑conversation search ────────────────────────────────────────
  conversationSearchQuery: string
  setConversationSearchQuery: (query: string) => void

  // ── Global search modal ───────────────────────────────────────────────
  globalSearchOpen: boolean
  setGlobalSearchOpen: (open: boolean) => void

  // ── Scroll target for global search ───────────────────────────────────
  scrollToMessageId: string | null
  setScrollToMessageId: (id: string | null) => void

  // ── Overlays ──────────────────────────────────────────────────────────
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  // ── Settings tab (ephemeral, not persisted) ───────────────────────────
  settingsTab: SettingsTab
  setSettingsTab: (tab: SettingsTab) => void

  // ── Sidebar tabs (persisted) ──────────────────────────────────────────
  leftTab: 'conversations' | 'skills' | 'community'
  setLeftTab: (tab: 'conversations' | 'skills' | 'community') => void

  rightTab: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics'
  setRightTab: (tab: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics') => void

  // ── Progressive unlock stage (persisted) ──────────────────────────────
  unlockStage: number
  setUnlockStage: (stage: number) => void

  // ── Onboarding completion (manually persisted to localStorage) ────────
  onboardingComplete: boolean
  setOnboardingComplete: (complete: boolean) => void

  // ── Platform features flag (manually persisted to localStorage) ────────
  platformFeaturesEnabled: boolean
  setPlatformFeaturesEnabled: (enabled: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Onboarding
      onboardingComplete: (() => {
        try {
          return localStorage.getItem('skilldeck-onboarding-complete') === 'true'
        } catch {
          return false
        }
      })(),
      setOnboardingComplete: (complete) => {
        try {
          localStorage.setItem('skilldeck-onboarding-complete', String(complete))
        } catch { }
        set({ onboardingComplete: complete })
      },

      // Platform features
      platformFeaturesEnabled: (() => {
        try {
          const stored = localStorage.getItem('skilldeck-platform-features-enabled')
          return stored !== 'false'
        } catch {
          return true
        }
      })(),
      setPlatformFeaturesEnabled: (enabled) => {
        try {
          localStorage.setItem('skilldeck-platform-features-enabled', String(enabled))
        } catch { }
        set({ platformFeaturesEnabled: enabled })
      },

      // Workspace
      activeWorkspaceId: null,
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      // Conversation
      activeConversationId: null,
      setActiveConversation: (id) => set({ activeConversationId: id }),

      // Branch
      activeBranchId: null,
      setActiveBranch: (id) => set({ activeBranchId: id }),

      // Panel sizes
      panelSizes: { left: 280, right: 320 },
      setPanelSizes: (sizes) =>
        set((state) => ({ panelSizes: { ...state.panelSizes, ...sizes } })),

      // Drafts
      drafts: {},
      setDraft: (conversationId, content) =>
        set((state) => ({ drafts: { ...state.drafts, [conversationId]: content } })),
      clearDraft: (conversationId) =>
        set((state) => {
          const { [conversationId]: _, ...rest } = state.drafts
          return { drafts: rest }
        }),

      // Streaming text
      streamingText: {},
      appendStreamingText: (conversationId, delta) =>
        set((state) => ({
          streamingText: {
            ...state.streamingText,
            [conversationId]: (state.streamingText[conversationId] ?? '') + delta
          }
        })),
      clearStreamingText: (conversationId) =>
        set((state) => {
          const { [conversationId]: _, ...rest } = state.streamingText
          return { streamingText: rest }
        }),

      // Agent running
      agentRunning: {},
      setAgentRunning: (conversationId, running) =>
        set((state) => ({ agentRunning: { ...state.agentRunning, [conversationId]: running } })),

      // Streaming error
      streamingError: {},
      setStreamingError: (conversationId, error) =>
        set((state) => ({ streamingError: { ...state.streamingError, [conversationId]: error } })),

      // Sidebar search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Within-conversation search
      conversationSearchQuery: '',
      setConversationSearchQuery: (query) => set({ conversationSearchQuery: query }),

      // Global search modal
      globalSearchOpen: false,
      setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),

      // Scroll target
      scrollToMessageId: null,
      setScrollToMessageId: (id) => set({ scrollToMessageId: id }),

      // Overlays
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      // Settings tab
      settingsTab: 'apikeys',
      setSettingsTab: (tab) => set({ settingsTab: tab }),

      // Sidebar tabs
      leftTab: 'conversations',
      setLeftTab: (tab) => set({ leftTab: tab }),
      rightTab: 'session',
      setRightTab: (tab) => set({ rightTab: tab }),

      // Unlock stage
      unlockStage: 0,
      setUnlockStage: (stage) => set({ unlockStage: stage })
    }),
    {
      name: 'skilldeck-ui',
      partialize: (state) => ({
        panelSizes: state.panelSizes,
        unlockStage: state.unlockStage,
        leftTab: state.leftTab,
        rightTab: state.rightTab
      })
    }
  )
)
