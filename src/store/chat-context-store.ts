import { create } from 'zustand'
import type { LintWarning, RegistrySkillData } from '@/lib/bindings'
import type {
  AttachedFile,
  AttachedFolder,
  AttachedItem,
  AttachedSkill
} from '@/types/chat-context'

interface ChatContextState {
  items: Record<string, AttachedItem[]> // keyed by conversationId
  addSkill: (conversationId: string, skill: RegistrySkillData) => void
  addFile: (conversationId: string, file: AttachedFile['data']) => void
  addFolder: (conversationId: string, folder: AttachedFolder['data']) => void
  removeItem: (conversationId: string, id: string) => void
  clearItems: (conversationId: string) => void
  updateSkillLintResults: (
    conversationId: string,
    skillId: string,
    warnings: LintWarning[]
  ) => void
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  items: {},

  addSkill: (conversationId, skill) =>
    set((state) => {
      const current = state.items[conversationId] || []
      if (
        current.some(
          (item) => item.type === 'skill' && item.data.id === skill.id
        )
      )
        return state
      const { lintWarnings: _ignored, ...rest } = skill
      const newItem: AttachedSkill = {
        type: 'skill',
        data: { ...rest, lintWarnings: undefined }
      }
      return {
        items: {
          ...state.items,
          [conversationId]: [...current, newItem]
        }
      }
    }),

  addFile: (conversationId, file) =>
    set((state) => {
      const current = state.items[conversationId] || []
      if (
        current.some((item) => item.type === 'file' && item.data.id === file.id)
      )
        return state
      return {
        items: {
          ...state.items,
          [conversationId]: [...current, { type: 'file', data: file }]
        }
      }
    }),

  addFolder: (conversationId, folder) =>
    set((state) => {
      const current = state.items[conversationId] || []
      if (
        current.some(
          (item) => item.type === 'folder' && item.data.id === folder.id
        )
      )
        return state
      return {
        items: {
          ...state.items,
          [conversationId]: [...current, { type: 'folder', data: folder }]
        }
      }
    }),

  removeItem: (conversationId, id) =>
    set((state) => {
      const current = state.items[conversationId] || []
      return {
        items: {
          ...state.items,
          [conversationId]: current.filter((item) => item.data.id !== id)
        }
      }
    }),

  clearItems: (conversationId) =>
    set((state) => {
      const { [conversationId]: _, ...rest } = state.items
      return { items: rest }
    }),

  updateSkillLintResults: (conversationId, skillId, warnings) =>
    set((state) => {
      const current = state.items[conversationId] || []
      return {
        items: {
          ...state.items,
          [conversationId]: current.map((item) => {
            if (item.type === 'skill' && item.data.id === skillId) {
              return {
                ...item,
                data: { ...item.data, lintWarnings: warnings }
              }
            }
            return item
          })
        }
      }
    })
}))
