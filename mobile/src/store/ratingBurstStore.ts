import { create } from 'zustand';

/**
 * The "+5" moment after a check-in. The outbox calls show() when a check-in
 * earned rating; RatingBurst (on the tab bar) draws it.
 */
export const useRatingBurst = create<{
  visible: boolean;
  points: number;
  /** Changes on every show(), so a second burst replays the animation. */
  key: number;
  show: (points: number) => void;
  hide: () => void;
}>((set) => ({
  visible: false,
  points: 0,
  key: 0,
  show: (points) => set((s) => ({ visible: true, points, key: s.key + 1 })),
  hide: () => set({ visible: false }),
}));
