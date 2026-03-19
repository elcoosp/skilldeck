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

// Right panel tabs from right-panel.tsx
export type RightTab = 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics'

// Left panel tabs (currently only conversations, but could expand)
export type LeftTab = 'conversations'

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

  // ── Sidebar search ────────────────────────────────────────────────────
  searchQuery: string
  setSearchQuery: (query: string) => void

  // ── Overlays ──────────────────────────────────────────────────────────
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  // ── Settings tab (ephemeral, not persisted) ───────────────────────────
  settingsTab: SettingsTab
  setSettingsTab: (tab: SettingsTab) => void

  // ── Sidebar tabs (persisted) ──────────────────────────────────────────
  leftTab: LeftTab
  setLeftTab: (tab: LeftTab) => void

  rightTab: RightTab
  setRightTab: (tab: RightTab) => void

  // ── Progressive unlock stage (persisted) ──────────────────────────────
  unlockStage: number
  setUnlockStage: (stage: number) => void

  // ── Onboarding completion (manually persisted to localStorage) ────────
  /** Whether the user has completed the first‑run onboarding wizard */
  onboardingComplete: boolean
  setOnboardingComplete: (complete: boolean) => void

  // ── Platform features flag (manually persisted to localStorage) ────────
  /** Whether platform features (community skills, nudges, referrals) are enabled */
  platformFeaturesEnabled: boolean
  setPlatformFeaturesEnabled: (enabled: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Onboarding – read from localStorage so the wizard only shows once
      onboardingComplete: (() => {
        try {
          return (
            localStorage.getItem('skilldeck-onboarding-complete') === 'true'
          )
        } catch {
          return false
        }
      })(),
      setOnboardingComplete: (complete) => {
        try {
          localStorage.setItem(
            'skilldeck-onboarding-complete',
            String(complete)
          )
        } catch {
          // ignore
        }
        set({ onboardingComplete: complete })
      },

      // Platform features – default to true, but can be disabled by onboarding skip
      platformFeaturesEnabled: (() => {
        try {
          const stored = localStorage.getItem(
            'skilldeck-platform-features-enabled'
          )
          return stored !== 'false'
        } catch {
          return true
        }
      })(),
      setPlatformFeaturesEnabled: (enabled) => {
        try {
          localStorage.setItem(
            'skilldeck-platform-features-enabled',
            String(enabled)
          )
        } catch {
          // ignore
        }
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
        set((state) => ({
          drafts: { ...state.drafts, [conversationId]: content }
        })),
      clearDraft: (conversationId) =>
        set((state) => {
          const { [conversationId]: _removed, ...rest } = state.drafts
          return { drafts: rest }
        }),

      // Streaming text
      streamingText: {},
      appendStreamingText: (conversationId, delta) =>
        set((state) => ({
          streamingText: {
            ...state.streamingText,
            [conversationId]:
              (state.streamingText[conversationId] ?? '') + delta
          }
        })),
      clearStreamingText: (conversationId) =>
        set((state) => {
          const { [conversationId]: _removed, ...rest } = state.streamingText
          return { streamingText: rest }
        }),

      // Agent running
      agentRunning: {},
      setAgentRunning: (conversationId, running) =>
        set((state) => ({
          agentRunning: { ...state.agentRunning, [conversationId]: running }
        })),

      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

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
      rightTab: 'session', // default to session tab
      setRightTab: (tab) => set({ rightTab: tab }),

      // Unlock stage
      unlockStage: 0,
      setUnlockStage: (stage) => set({ unlockStage: stage })
    }),
    {
      name: 'skilldeck-ui',
      // Only persist layout preferences and unlock stage – never transient UI state.
      partialize: (state) => ({
        panelSizes: state.panelSizes,
        unlockStage: state.unlockStage,
        leftTab: state.leftTab,
        rightTab: state.rightTab
      })
    }
  )
)
