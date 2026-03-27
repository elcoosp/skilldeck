import { create } from 'zustand';

interface ConversationState {
  activeConversationId: string | null;
  activeBranchId: string | null;
  scrollToMessageId: string | null;
  setActiveConversation: (id: string | null) => void;
  setActiveBranch: (id: string | null) => void;
  setScrollToMessageId: (id: string | null) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  activeConversationId: null,
  activeBranchId: null,
  scrollToMessageId: null,
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setActiveBranch: (id) => set({ activeBranchId: id }),
  setScrollToMessageId: (id) => set({ scrollToMessageId: id }),
}));
