// store/assistant-messages.ts
import { create } from 'zustand'
import { TocItem } from '@/lib/markdown-toc'

interface AssistantMessageStore {
  headingsMap: Record<string, TocItem[]>
  setHeadings: (messageId: string, headings: TocItem[]) => void
  clearHeadings: (messageId: string) => void
}

export const useAssistantMessageStore = create<AssistantMessageStore>((set) => ({
  headingsMap: {},
  setHeadings: (messageId, headings) => {
    set((state) => ({
      headingsMap: { ...state.headingsMap, [messageId]: headings },
    }))
  },
  clearHeadings: (messageId) => {
    set((state) => {
      const { [messageId]: _, ...rest } = state.headingsMap
      return { headingsMap: rest }
    })
  },
}))
