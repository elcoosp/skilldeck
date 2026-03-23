// src/store/tool-approvals.ts
import { create } from 'zustand'
import type { ToolCallInfo } from '@/lib/events'

interface ToolApprovalState {
  pending: Map<string, ToolCallInfo>
  addPending: (toolCallId: string, info: ToolCallInfo) => void
  removePending: (toolCallId: string) => void
  clearAll: () => void
}

export const useToolApprovalStore = create<ToolApprovalState>((set) => ({
  pending: new Map(),
  addPending: (toolCallId, info) =>
    set((state) => {
      const next = new Map(state.pending)
      next.set(toolCallId, info)
      return { pending: next }
    }),
  removePending: (toolCallId) =>
    set((state) => {
      const next = new Map(state.pending)
      next.delete(toolCallId)
      return { pending: next }
    }),
  clearAll: () => set({ pending: new Map() }),
}))
