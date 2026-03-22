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
    console.log(`[Store] setHeadings for message ${messageId.slice(0, 8)}:`, headings.map(h => ({ idx: h.tocIndex, text: h.text.slice(0, 20) })))
    set((state) => ({
      headingsMap: { ...state.headingsMap, [messageId]: headings },
    }))
  },
  clearHeadings: (messageId) => {
    console.log(`[Store] clearHeadings for message ${messageId.slice(0, 8)}`)
    set((state) => {
      const { [messageId]: _, ...rest } = state.headingsMap
      return { headingsMap: rest }
    })
  },
}))
