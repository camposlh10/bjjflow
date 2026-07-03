// Milestone ladders for the Home "Progress Overview" — progression over totals.

export const TRAINING_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500, 1000];
export const STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365];
export const WEEK_MILESTONES = [4, 12, 26, 52, 104, 208];

/** Next ladder rung above `value`, or null once the top rung is passed. */
export function nextMilestone(value: number, ladder: number[]): number | null {
  return ladder.find((m) => m > value) ?? null;
}

/** Previous rung at/below `value` (the floor of the current segment). */
export function prevMilestone(value: number, ladder: number[]): number {
  let prev = 0;
  for (const m of ladder) {
    if (m <= value) prev = m;
    else break;
  }
  return prev;
}

/** 0..1 progress within the current segment toward the next rung. */
export function milestoneProgress(value: number, ladder: number[]): number {
  const next = nextMilestone(value, ladder);
  if (next === null) return 1;
  const floor = prevMilestone(value, ladder);
  return Math.max(0, Math.min(1, (value - floor) / (next - floor)));
}
