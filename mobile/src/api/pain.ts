import { api } from './client';

export type PainEntry = {
  region: string;
  intensity: number;
  note: string | null;
  occurredAt: string;
};

export type PainMap = { regions: PainEntry[] };

export type PainHistoryItem = {
  id: number;
  region: string;
  intensity: number;
  note: string | null;
  occurredAt: string;
};

export type MonthlyRegion = { region: string; intensity: number; days: number };
export type PainMonthly = { month: string; regions: MonthlyRegion[] };

export async function getPainMap(): Promise<PainMap> {
  const { data } = await api.get<PainMap>('/users/me/pain');
  return data;
}

/** A single day's pain (latest reading per region that day). */
export async function getPainDaily(date?: string): Promise<PainMap> {
  const { data } = await api.get<PainMap>('/users/me/pain/daily', { params: { date } });
  return data;
}

/** A month's aggregate per region (peak intensity + days it hurt). */
export async function getPainMonthly(month?: string): Promise<PainMonthly> {
  const { data } = await api.get<PainMonthly>('/users/me/pain/monthly', { params: { month } });
  return data;
}

export async function logPain(body: { region: string; intensity: number; note?: string | null }): Promise<PainMap> {
  const { data } = await api.post<PainMap>('/users/me/pain', body);
  return data;
}

export async function getPainHistory(limit?: number): Promise<PainHistoryItem[]> {
  const { data } = await api.get<PainHistoryItem[]>('/users/me/pain/history', { params: { limit } });
  return data;
}

// --- Pain assessments (the "Mapa Corporal" pain journal) ---

export type AssessmentArea = {
  region: string;
  painType: string | null;
  intensity: number;
  note: string | null;
};

export type PainAssessment = {
  id: number;
  assessedOn: string;
  onsetDate: string | null;
  trend: string | null;
  frequency: string | null;
  relieves: string | null;
  worsens: string | null;
  notes: string | null;
  areas: AssessmentArea[];
  avgIntensity: number;
  predominantType: string | null;
};

export type AssessmentSummary = {
  id: number;
  assessedOn: string;
  areaCount: number;
  avgIntensity: number;
  trend: string | null;
  predominantType: string | null;
};

export type CreateAssessmentBody = {
  onsetDate?: string | null;
  trend?: string | null;
  frequency?: string | null;
  relieves?: string | null;
  worsens?: string | null;
  notes?: string | null;
  areas: { region: string; painType?: string | null; intensity: number; note?: string | null }[];
};

export async function createAssessment(body: CreateAssessmentBody): Promise<PainAssessment> {
  const { data } = await api.post<PainAssessment>('/users/me/pain/assessments', body);
  return data;
}

export async function listAssessments(limit?: number): Promise<AssessmentSummary[]> {
  const { data } = await api.get<AssessmentSummary[]>('/users/me/pain/assessments', { params: { limit } });
  return data;
}

export async function getAssessment(id: number): Promise<PainAssessment> {
  const { data } = await api.get<PainAssessment>(`/users/me/pain/assessments/${id}`);
  return data;
}

export async function getLatestAssessment(): Promise<PainAssessment | null> {
  const { data } = await api.get<PainAssessment | null>('/users/me/pain/assessments/latest');
  return data ?? null;
}

export async function deleteAssessment(id: number): Promise<void> {
  await api.delete(`/users/me/pain/assessments/${id}`);
}
