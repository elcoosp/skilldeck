// src/store/queue.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QueueMode = 'view' | 'select' | 'edit'

interface QueueUIState {
  // Keyed by conversationId
  expanded: Record<string, boolean>
  mode: Record<string, QueueMode>
  selectedIds: Record<string, string[]> // stored as array for stable references
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
    (set, _get) => ({
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
          const current = state.selectedIds[conversationId] || []
          const index = current.indexOf(id)
          let newArray
          if (index === -1) {
            newArray = [...current, id]
          } else {
            newArray = [...current.slice(0, index), ...current.slice(index + 1)]
          }
          return {
            selectedIds: { ...state.selectedIds, [conversationId]: newArray }
          }
        }),

      clearSelected: (conversationId) =>
        set((state) => ({
          selectedIds: { ...state.selectedIds, [conversationId]: [] }
        })),

      selectAll: (conversationId, ids) =>
        set((state) => ({
          selectedIds: { ...state.selectedIds, [conversationId]: [...ids] }
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
      // No custom serialize/deserialize needed – arrays are JSON-serializable
      partialize: (state) => ({
        expanded: state.expanded,
        mode: state.mode
        // selectedIds, editingId, isDragging are ephemeral
      })
    }
  )
)
