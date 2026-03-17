// src/store/queue.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QueueMode = 'view' | 'select' | 'edit'

interface QueueUIState {
  // Keyed by conversationId
  expanded: Record<string, boolean>
  mode: Record<string, QueueMode>
  selectedIds: Record<string, Set<string>> // Set not serializable – will convert to array for storage
  editingId: Record<string, string | null>
  isDragging: Record<string, boolean>

  // Actions
  setExpanded: (conversationId: string, expanded: boolean) => void
  setMode: (conversationId: string, mode: QueueMode) => void
  toggleSelected: (conversationId: string, id: string) => void
  clearSelected: (conversationId: string) => void
  selectAll: (conversationId: string, ids: string[]) => void
  setEditingId: (conversationId: string, id: string | null) => void
  setIsDragging: (conversationId: string, dragging: boolean) => void
  resetQueueUI: (conversationId: string) => void
}

export const useQueueStore = create<QueueUIState>()(
  persist(
    (set, get) => ({
      expanded: {},
      mode: {},
      selectedIds: {},
      editingId: {},
      isDragging: {},

      setExpanded: (conversationId, expanded) =>
        set((state) => ({
          expanded: { ...state.expanded, [conversationId]: expanded }
        })),

      setMode: (conversationId, mode) =>
        set((state) => ({
          mode: { ...state.mode, [conversationId]: mode }
        })),

      toggleSelected: (conversationId, id) =>
        set((state) => {
          const currentSet = state.selectedIds[conversationId] || new Set()
          const newSet = new Set(currentSet)
          if (newSet.has(id)) {
            newSet.delete(id)
          } else {
            newSet.add(id)
          }
          return {
            selectedIds: { ...state.selectedIds, [conversationId]: newSet }
          }
        }),

      clearSelected: (conversationId) =>
        set((state) => ({
          selectedIds: { ...state.selectedIds, [conversationId]: new Set() }
        })),

      selectAll: (conversationId, ids) =>
        set((state) => ({
          selectedIds: { ...state.selectedIds, [conversationId]: new Set(ids) }
        })),

      setEditingId: (conversationId, id) =>
        set((state) => ({
          editingId: { ...state.editingId, [conversationId]: id }
        })),

      setIsDragging: (conversationId, dragging) =>
        set((state) => ({
          isDragging: { ...state.isDragging, [conversationId]: dragging }
        })),

      resetQueueUI: (conversationId) =>
        set((state) => {
          const { [conversationId]: _, ...restExpanded } = state.expanded
          const { [conversationId]: __, ...restMode } = state.mode
          const { [conversationId]: ___, ...restSelected } = state.selectedIds
          const { [conversationId]: ____, ...restEditing } = state.editingId
          const { [conversationId]: _____, ...restDragging } = state.isDragging
          return {
            expanded: restExpanded,
            mode: restMode,
            selectedIds: restSelected,
            editingId: restEditing,
            isDragging: restDragging
          }
        })
    }),
    {
      name: 'skilldeck-queue-ui',
      // Convert Sets to arrays for storage
      serialize: (state) => {
        const serialized: any = { ...state }
        serialized.selectedIds = Object.fromEntries(
          Object.entries(state.selectedIds).map(([key, set]) => [
            key,
            Array.from(set)
          ])
        )
        return JSON.stringify(serialized)
      },
      deserialize: (str) => {
        const parsed = JSON.parse(str)
        // Convert arrays back to Sets
        if (parsed.selectedIds) {
          parsed.selectedIds = Object.fromEntries(
            Object.entries(parsed.selectedIds).map(([key, arr]) => [
              key,
              new Set(arr as string[])
            ])
          )
        }
        return parsed
      },
      partialize: (state) => ({
        // Only persist expanded and mode? selectedIds probably shouldn't persist across sessions.
        expanded: state.expanded,
        mode: state.mode
        // selectedIds, editingId, isDragging are ephemeral
      })
    }
  )
)
