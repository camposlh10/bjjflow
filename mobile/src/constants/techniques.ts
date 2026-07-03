import type { TechniqueCategory } from '../api/techniques';

export const CATEGORY_LABELS: Record<TechniqueCategory, string> = {
  GUARD: 'Guarda',
  PASSING: 'Passagem',
  SUBMISSION: 'Finalização',
  SWEEP: 'Raspagem',
  ESCAPE: 'Saída',
  TAKEDOWN: 'Queda',
  CONTROL: 'Controle',
};

export const CATEGORY_ICONS: Record<TechniqueCategory, string> = {
  GUARD: 'shield-half-full',
  PASSING: 'arrow-right-bold',
  SUBMISSION: 'hand-back-left',
  SWEEP: 'rotate-3d-variant',
  ESCAPE: 'run-fast',
  TAKEDOWN: 'arrow-down-bold',
  CONTROL: 'gesture-tap-hold',
};

export const CATEGORY_COLORS: Record<TechniqueCategory, string> = {
  GUARD: '#3E63DD',
  PASSING: '#E0A82E',
  SUBMISSION: '#E63946',
  SWEEP: '#2DB6A3',
  ESCAPE: '#8E4EC6',
  TAKEDOWN: '#F76808',
  CONTROL: '#4A9EED',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  FUNDAMENTAL: 'Fundamental',
  INTERMEDIATE: 'Intermediária',
  ADVANCED: 'Avançada',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as TechniqueCategory] ?? category;
}
