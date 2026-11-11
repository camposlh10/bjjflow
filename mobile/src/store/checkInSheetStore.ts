import { create } from 'zustand';

/** Lets any screen open the "Registrar treino" sheet that lives on the tab bar. */
export const useCheckInSheet = create<{ visible: boolean; open: () => void; close: () => void }>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));
