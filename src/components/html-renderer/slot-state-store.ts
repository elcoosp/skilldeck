import { create } from 'zustand';

interface SlotStateStore {
  states: Record<string, unknown>;
  setState: (slotId: string, value: unknown) => void;
  getState: (slotId: string) => unknown;
}

export const useSlotStateStore = create<SlotStateStore>((set, get) => ({
  states: {},
  setState: (slotId, value) => set(prev => ({ states: { ...prev.states, [slotId]: value } })),
  getState: (slotId) => get().states[slotId],
}));

export function useSlotState<T>(slotId: string, initialState: T): [T, (next: T) => void] {
  const raw = useSlotStateStore(s => s.states[slotId]);
  const set = useSlotStateStore(s => s.setState);
  const value = (raw as T) ?? initialState;
  return [value, (next: T) => set(slotId, next)];
}
