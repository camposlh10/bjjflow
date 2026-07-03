// Catalog of finishes shown on the radar axes, the check-in picker, and the
// ranked list. Keys are stored on the backend; labels are pt-BR.

export type Submission = { key: string; label: string; color: string };

export const SUBMISSIONS: Submission[] = [
  { key: 'REAR_NAKED_CHOKE', label: 'Mata-leão', color: '#E5484D' },
  { key: 'GUILLOTINE', label: 'Guilhotina', color: '#F76808' },
  { key: 'TRIANGLE', label: 'Triângulo', color: '#E0A82E' },
  { key: 'ARMBAR', label: 'Armbar', color: '#46A758' },
  { key: 'KIMURA', label: 'Kimura', color: '#12A594' },
  { key: 'AMERICANA', label: 'Americana', color: '#2DD4BF' },
  { key: 'OMOPLATA', label: 'Omoplata', color: '#3E63DD' },
  { key: 'BOW_AND_ARROW', label: 'Arco e flecha', color: '#8E4EC6' },
  { key: 'HEEL_HOOK', label: 'Chave de calcanhar', color: '#E93D82' },
];

const DEFAULT: Submission = { key: 'OTHER', label: 'Outra', color: '#9CA3AF' };

export function submissionStyle(key: string): Submission {
  return SUBMISSIONS.find((s) => s.key === key) ?? { ...DEFAULT, label: key };
}
