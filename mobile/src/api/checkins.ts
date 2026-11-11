import { api } from './client';

export type Stats = {
  currentStreak: number;
  longestStreak: number;
  totalCheckIns: number;
  totalHours: number;
  weeklyGoal: number;
  weeklyProgress: number;
  checkedInToday: boolean;
  /** segunda → domingo */
  weekDays: boolean[];
  /** semanas distintas com ao menos um treino */
  activeWeeks: number;
  /** carga de treino: minutos nesta semana e na semana passada */
  weeklyMinutes: number;
  lastWeekMinutes: number;
  /** calorias estimadas na semana (null se não houver peso cadastrado) */
  weeklyCalories: number | null;
};

/** Data local do aparelho em YYYY-MM-DD (sem efeitos de fuso do servidor). */
export function todayLocalDate(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export async function getStats(): Promise<Stats> {
  const { data } = await api.get<Stats>('/users/me/stats');
  return data;
}

export type CheckInSubmission = { submission: string; direction: 'HIT' | 'CONCEDED'; count: number };

export type Visibility = 'PUBLIC' | 'PRIVATE';

export type CreateCheckInPayload = {
  date: string;
  sessionType?: string;
  durationMinutes?: number;
  notes?: string;
  /** PUBLIC shares the session to the global Comunidade feed; PRIVATE keeps it to the user. */
  visibility?: Visibility;
  /** Storage key of an uploaded training photo (from uploadMedia). */
  photoKey?: string;
  submissions?: CheckInSubmission[];
  /** The app's own id: resending the same check-in never records it twice. */
  clientId?: string;
};

/** Detailed check-in (session type, duration, submissions landed/conceded, notes). */
export async function createCheckIn(payload: CreateCheckInPayload): Promise<void> {
  await api.post('/checkins', payload);
}
