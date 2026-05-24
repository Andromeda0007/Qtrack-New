import { create } from 'zustand';

interface NotifState {
  count: number;
  setCount: (n: number) => void;
  decrement: (by?: number) => void;
}

export const useNotifStore = create<NotifState>((set) => ({
  count: 0,
  setCount: (n) => set({ count: Math.max(0, n) }),
  decrement: (by = 1) => set((s) => ({ count: Math.max(0, s.count - by) })),
}));
