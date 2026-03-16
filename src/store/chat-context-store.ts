import { create } from 'zustand'
import type {
  AttachedItem,
  AttachedFile,
  AttachedFolder,
  AttachedSkill
} from '@/types/chat-context'
import type { LintWarning, RegistrySkillData } from '@/lib/bindings'

interface ChatContextState {
  items: AttachedItem[]
  addSkill: (skill: RegistrySkillData) => void
  addFile: (file: AttachedFile['data']) => void
  addFolder: (folder: AttachedFolder['data']) => void
  removeItem: (id: string) => void
  clearItems: () => void
  updateSkillLintResults: (skillId: string, warnings: LintWarning[]) => void
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  items: [],

  addSkill: (skill) =>
    set((state) => {
      if (state.items.some((item) => item.type === 'skill' && item.data.id === skill.id))
        return state
      // Remove the original lintWarnings (JsonValue[]) and store our own (initially undefined)
      const { lintWarnings: _ignored, ...rest } = skill
      const newItem: AttachedSkill = {
        type: 'skill',
        data: { ...rest, lintWarnings: undefined }
      }
      return { items: [...state.items, newItem] }
    }),

  addFile: (file) =>
    set((state) => {
      if (state.items.some((item) => item.type === 'file' && item.data.id === file.id))
        return state
      return { items: [...state.items, { type: 'file', data: file }] }
    }),

  addFolder: (folder) =>
    set((state) => {
      if (state.items.some((item) => item.type === 'folder' && item.data.id === folder.id))
        return state
      return { items: [...state.items, { type: 'folder', data: folder }] }
    }),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.data.id !== id)
    })),

  clearItems: () => set({ items: [] }),

  updateSkillLintResults: (skillId, warnings) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.type === 'skill' && item.data.id === skillId) {
          return {
            ...item,
            data: { ...item.data, lintWarnings: warnings }
          }
        }
        return item
      })
    }))
}))
