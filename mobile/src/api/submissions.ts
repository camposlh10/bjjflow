import { api } from './client';

export type SubmissionDirection = 'HIT' | 'CONCEDED';

export type SubmissionCount = { submission: string; count: number; percentage: number };

export type SubmissionStats = {
  direction: SubmissionDirection;
  month: string;
  total: number;
  items: SubmissionCount[];
};

export async function getUserSubmissions(
  id: number,
  month: string,
  direction: SubmissionDirection,
): Promise<SubmissionStats> {
  const { data } = await api.get<SubmissionStats>(`/users/${id}/submissions`, {
    params: { month, direction },
  });
  return data;
}
