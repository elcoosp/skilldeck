import { create } from 'zustand';
import type { HtmlMessage } from '@/components/html-renderer/html-renderer';

interface UIState {
  drafts: Record<string, string>;
  setDraft: (conversationId: string, content: string) => void;
  clearDraft: (conversationId: string) => void;
  streamingText: Record<string, string>;
  appendStreamingText: (conversationId: string, delta: string) => void;
  clearStreamingText: (conversationId: string) => void;
  streamingMessages: Record<string, HtmlMessage | null>;
  setStreamingMessage: (conversationId: string, message: HtmlMessage | null) => void;
  agentRunning: Record<string, boolean>;
  setAgentRunning: (conversationId: string, running: boolean) => void;
  streamingError: Record<string, boolean>;
  setStreamingError: (conversationId: string, error: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  conversationSearchQuery: string;
  setConversationSearchQuery: (query: string) => void;
}

export const useUIEphemeralStore = create<UIState>((set) => ({
  drafts: {},
  setDraft: (conversationId, content) =>
    set((state) => ({ drafts: { ...state.drafts, [conversationId]: content } })),
  clearDraft: (conversationId) =>
    set((state) => {
      const { [conversationId]: _, ...rest } = state.drafts;
      return { drafts: rest };
    }),
  streamingText: {},
  appendStreamingText: (conversationId, delta) =>
    set((state) => ({
      streamingText: {
        ...state.streamingText,
        [conversationId]: (state.streamingText[conversationId] ?? '') + delta,
      },
    })),
  clearStreamingText: (conversationId) =>
    set((state) => {
      const { [conversationId]: _, ...rest } = state.streamingText;
      return { streamingText: rest };
    }),
  streamingMessages: {},
  setStreamingMessage: (conversationId, message) =>
    set((state) => {
      if (message === null) {
        const { [conversationId]: _, ...rest } = state.streamingMessages;
        return { streamingMessages: rest };
      }
      return { streamingMessages: { ...state.streamingMessages, [conversationId]: message } };
    }),
  agentRunning: {},
  setAgentRunning: (conversationId, running) =>
    set((state) => ({ agentRunning: { ...state.agentRunning, [conversationId]: running } })),
  streamingError: {},
  setStreamingError: (conversationId, error) =>
    set((state) => ({ streamingError: { ...state.streamingError, [conversationId]: error } })),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  conversationSearchQuery: '',
  setConversationSearchQuery: (query) => set({ conversationSearchQuery: query }),
}));
