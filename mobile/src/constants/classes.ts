import { SessionType } from '../api/classes';

// Tag colors per session type (dark bg + light text), matching the design.
export const SESSION_TAG: Record<SessionType, { bg: string; fg: string }> = {
  GI: { bg: '#16233F', fg: '#85B7EB' },
  NOGI: { bg: '#2A1F3D', fg: '#AFA9EC' },
  OPEN_MAT: { bg: '#3A2A12', fg: '#FAC775' },
};

/** Adds n days to a YYYY-MM-DD string, returning YYYY-MM-DD (local). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
