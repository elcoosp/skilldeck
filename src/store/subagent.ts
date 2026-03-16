// src/store/subagent.ts
import { create } from 'zustand';

export interface SubagentState {
  id: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

interface SubagentStore {
  subagents: Record<string, SubagentState>;
  updateSubagentStatus: (id: string, status: SubagentState['status']) => void;
  setSubagentResult: (id: string, result: string) => void;
  setSubagentError: (id: string, error: string) => void;
  removeSubagent: (id: string) => void;
}

export const useSubagentStore = create<SubagentStore>((set) => ({
  subagents: {},
  updateSubagentStatus: (id, status) =>
    set((state) => ({
      subagents: {
        ...state.subagents,
        [id]: { ...state.subagents[id], status },
      },
    })),
  setSubagentResult: (id, result) =>
    set((state) => ({
      subagents: {
        ...state.subagents,
        [id]: { ...state.subagents[id], result, status: 'completed' },
      },
    })),
  setSubagentError: (id, error) =>
    set((state) => ({
      subagents: {
        ...state.subagents,
        [id]: { ...state.subagents[id], error, status: 'failed' },
      },
    })),
  removeSubagent: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.subagents;
      return { subagents: rest };
    }),
}));
