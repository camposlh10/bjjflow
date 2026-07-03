import { api } from './client';

export type ActivityType =
  | 'BELT_PROMOTION'
  | 'NEW_MEMBER'
  | 'ACADEMY_JOINED'
  | 'FIRST_TRAINING'
  | 'TRAINING_MILESTONE'
  | 'STREAK_MILESTONE'
  | 'COMPETITION_RESULT';

/** One row in the academy community feed. */
export type ActivityItem = {
  type: ActivityType;
  userId: number;
  userName: string;
  beltSlug: string | null;
  value: number | null;
  text: string | null;
  occurredAt: string;
};

/** One entry in the personal journey timeline. */
export type TimelineItem = {
  type: ActivityType;
  value: number | null;
  text: string | null;
  beltSlug: string | null;
  occurredAt: string;
};

export type BeltProgress = {
  slug: string;
  namePt: string;
  colorHex: string;
  stripes: number;
  beltSince: string | null;
  trainingsSinceBelt: number;
};

export type Journey = { timeline: TimelineItem[]; belt: BeltProgress | null };

export async function getAcademyActivity(): Promise<ActivityItem[]> {
  const { data } = await api.get<ActivityItem[]>('/gyms/me/activity');
  return data;
}

export async function getJourney(): Promise<Journey> {
  const { data } = await api.get<Journey>('/users/me/journey');
  return data;
}

export async function logCompetition(payload: {
  name: string;
  placement?: number;
  date: string;
}): Promise<Journey> {
  const { data } = await api.post<Journey>('/users/me/competitions', payload);
  return data;
}
