import { api } from './client';

export type TechniqueCategory =
  | 'GUARD'
  | 'PASSING'
  | 'SUBMISSION'
  | 'SWEEP'
  | 'ESCAPE'
  | 'TAKEDOWN'
  | 'CONTROL';

export type Technique = {
  id: number;
  slug: string;
  category: TechniqueCategory;
  name: string;
  position: string | null;
  description: string | null;
  difficulty: 'FUNDAMENTAL' | 'INTERMEDIATE' | 'ADVANCED';
  beltSlug: string | null;
  videoUrl: string | null;
  favorite: boolean;
};

export type TechniqueCategoryCount = { category: TechniqueCategory; count: number };

export type TechniqueList = { categories: TechniqueCategoryCount[]; items: Technique[] };

export type PersonalTechnique = {
  id: number;
  name: string;
  category: string | null;
  notes: string | null;
  videoUrl: string | null;
  color: string | null;
  mediaKey: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

export type PersonalTechniqueInput = {
  name: string;
  category?: string | null;
  notes?: string | null;
  videoUrl?: string | null;
  color?: string | null;
  mediaKey?: string | null;
};

export async function getTechniques(params?: { category?: string; q?: string }): Promise<TechniqueList> {
  const { data } = await api.get<TechniqueList>('/techniques', { params });
  return data;
}

export async function getTechnique(id: number): Promise<Technique> {
  const { data } = await api.get<Technique>(`/techniques/${id}`);
  return data;
}

export async function toggleTechniqueFavorite(id: number): Promise<{ favorite: boolean }> {
  const { data } = await api.post<{ favorite: boolean }>(`/techniques/${id}/favorite`);
  return data;
}

export async function getFavoriteTechniques(): Promise<Technique[]> {
  const { data } = await api.get<Technique[]>('/users/me/favorite-techniques');
  return data;
}

export async function getPersonalTechniques(): Promise<PersonalTechnique[]> {
  const { data } = await api.get<PersonalTechnique[]>('/users/me/techniques');
  return data;
}

export async function createPersonalTechnique(body: PersonalTechniqueInput): Promise<PersonalTechnique> {
  const { data } = await api.post<PersonalTechnique>('/users/me/techniques', body);
  return data;
}

export async function updatePersonalTechnique(
  id: number,
  body: PersonalTechniqueInput,
): Promise<PersonalTechnique> {
  const { data } = await api.put<PersonalTechnique>(`/users/me/techniques/${id}`, body);
  return data;
}

export async function deletePersonalTechnique(id: number): Promise<void> {
  await api.delete(`/users/me/techniques/${id}`);
}
