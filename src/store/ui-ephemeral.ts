// src/store/ui-ephemeral.ts
import { create } from 'zustand'
import type { NodeDocument } from '@/lib/bindings'

interface UIState {
  drafts: Record<string, string>
  setDraft: (conversationId: string, content: string) => void
  clearDraft: (conversationId: string) => void
  streamingText: Record<string, string>
  appendStreamingText: (conversationId: string, delta: string) => void
  clearStreamingText: (conversationId: string) => void
  streamingMessages: Record<string, NodeDocument | null>
  setStreamingMessage: (
    conversationId: string,
    message: NodeDocument | null
  ) => void
  agentRunning: Record<string, boolean>
  setAgentRunning: (conversationId: string, running: boolean) => void
  streamingError: Record<string, boolean>
  setStreamingError: (conversationId: string, error: boolean) => void
  conversationSearchQuery: string
  setConversationSearchQuery: (query: string) => void
  // Concierge UI new fields
  suggestedPromptsDismissed: Record<string, boolean>
  setSuggestedPromptsDismissed: (id: string, dismissed: boolean) => void
  gitInitDismissed: Record<string, boolean>
  setGitInitDismissed: (path: string, dismissed: boolean) => void
  editingMessageId: string | null
  setEditingMessageId: (id: string | null) => void
}

export const useUIEphemeralStore = create<UIState>((set) => ({
  drafts: {},
  setDraft: (conversationId, content) =>
    set((state) => ({
      drafts: { ...state.drafts, [conversationId]: content }
    })),
  clearDraft: (conversationId) =>
    set((state) => {
      const { [conversationId]: _, ...rest } = state.drafts
      return { drafts: rest }
    }),
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
  streamingMessages: {},
  setStreamingMessage: (conversationId, message) =>
    set((state) => {
      if (message === null) {
        const { [conversationId]: _, ...rest } = state.streamingMessages
        return { streamingMessages: rest }
      }
      return {
        streamingMessages: {
          ...state.streamingMessages,
          [conversationId]: message
        }
      }
    }),
  agentRunning: {},
  setAgentRunning: (conversationId, running) =>
    set((state) => ({
      agentRunning: { ...state.agentRunning, [conversationId]: running }
    })),
  streamingError: {},
  setStreamingError: (conversationId, error) =>
    set((state) => ({
      streamingError: { ...state.streamingError, [conversationId]: error }
    })),
  conversationSearchQuery: '',
  setConversationSearchQuery: (query) => set({ conversationSearchQuery: query }),
  // Concierge UI new fields
  suggestedPromptsDismissed: {},
  setSuggestedPromptsDismissed: (id, dismissed) =>
    set((state) => ({
      suggestedPromptsDismissed: { ...state.suggestedPromptsDismissed, [id]: dismissed }
    })),
  gitInitDismissed: {},
  setGitInitDismissed: (path, dismissed) =>
    set((state) => ({
      gitInitDismissed: { ...state.gitInitDismissed, [path]: dismissed }
    })),
  editingMessageId: null,
  setEditingMessageId: (id) => set({ editingMessageId: id })
}))
