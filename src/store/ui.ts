/**
 * UI state — Zustand store with selective persistence.
 *
 * Only layout preferences and unlock stage are persisted across sessions.
 * Transient state (active conversation, streaming text, drafts) always
 * resets on restart.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PanelSizes {
  left: number
  right: number
}

interface UIState {
  // ── Active workspace ──────────────────────────────────────────────────
  activeWorkspaceId: string | null
  setActiveWorkspace: (id: string | null) => void

  // ── Active conversation ──────────────────────────────────────────────────
  activeConversationId: string | null
  setActiveConversation: (id: string | null) => void

  // ── Branch navigation ────────────────────────────────────────────────────
  activeBranchId: string | null
  setActiveBranch: (id: string | null) => void

  // ── Panel sizes (persisted) ──────────────────────────────────────────────
  panelSizes: PanelSizes
  setPanelSizes: (sizes: Partial<PanelSizes>) => void

  // ── Draft messages (per conversation) ───────────────────────────────────
  drafts: Record<string, string>
  setDraft: (conversationId: string, content: string) => void
  clearDraft: (conversationId: string) => void

  // ── Streaming token buffer (per conversation) ────────────────────────────
  streamingText: Record<string, string>
  appendStreamingText: (conversationId: string, delta: string) => void
  clearStreamingText: (conversationId: string) => void

  // ── Agent running state (per conversation) ───────────────────────────────
  agentRunning: Record<string, boolean>
  setAgentRunning: (conversationId: string, running: boolean) => void

  // ── Sidebar search ───────────────────────────────────────────────────────
  searchQuery: string
  setSearchQuery: (query: string) => void

  // ── Overlays ─────────────────────────────────────────────────────────────
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  // ── Progressive unlock stage (persisted) ─────────────────────────────────
  unlockStage: number
  setUnlockStage: (stage: number) => void

  /** Whether the user has completed the first-run onboarding wizard */
  onboardingComplete: boolean
  setOnboardingComplete: (complete: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      onboardingComplete: (() => {
        // Initialise from localStorage so the wizard only shows once.
        try {
          return localStorage.getItem('skilldeck-onboarding-complete') === 'true'
        } catch {
          return false
        }
      })(),
      setOnboardingComplete: (complete) => {
        try {
          localStorage.setItem('skilldeck-onboarding-complete', String(complete))
        } catch {
          // ignore
        }
        set({ onboardingComplete: complete })
      },

      // Active workspace
      activeWorkspaceId: null,
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      // Active conversation
      activeConversationId: null,
      setActiveConversation: (id) => set({ activeConversationId: id }),

      // Branch navigation
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

      // Unlock
      unlockStage: 0,
      setUnlockStage: (stage) => set({ unlockStage: stage })
    }),
    {
      name: 'skilldeck-ui',
      // Only persist layout preferences — never transient state.
      partialize: (state) => ({
        panelSizes: state.panelSizes,
        unlockStage: state.unlockStage
      })
    }
  )
)
