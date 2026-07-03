// Catalog of the major BJJ competitions a gym can showcase medals from.
// Each entry drives the branded medal illustration (shape, accent, ribbon,
// emblem) rendered by MedalVisual, and the selectable grid in EditGymScreen.

export type MedalShape = 'square' | 'circle' | 'shield';

export type Competition = {
  key: string;
  /** stored as gym medal `competition` */
  label: string;
  /** caption under the medal */
  full: string;
  /** medal body / emblem stroke colour */
  accent: string;
  /** two-tone ribbon colours */
  ribbon: [string, string];
  shape: MedalShape;
  /** short text shown inside the medal body (use \n for two lines) */
  emblem: string;
};

export const COMPETITIONS: Competition[] = [
  {
    key: 'IBJJF',
    label: 'IBJJF',
    full: 'Int. Brazilian Jiu-Jitsu Federation',
    accent: '#EAB308',
    ribbon: ['#2563EB', '#1D4ED8'],
    shape: 'square',
    emblem: 'IBJJF',
  },
  {
    key: 'WORLD_PRO',
    label: 'World Pro',
    full: 'IBJJF World Professional',
    accent: '#22C55E',
    ribbon: ['#16A34A', '#E5E7EB'],
    shape: 'circle',
    emblem: 'WORLD\nPRO',
  },
  {
    key: 'ADCC',
    label: 'ADCC',
    full: 'Abu Dhabi Combat Club',
    accent: '#EF4444',
    ribbon: ['#DC2626', '#E5E7EB'],
    shape: 'circle',
    emblem: 'ADCC',
  },
  {
    key: 'MUNDIAL',
    label: 'Mundial',
    full: 'IBJJF Mundial / Worlds',
    accent: '#EAB308',
    ribbon: ['#2563EB', '#FACC15'],
    shape: 'circle',
    emblem: 'WORLDS',
  },
  {
    key: 'PAN',
    label: 'Pan',
    full: 'Pan Jiu-Jitsu Championship',
    accent: '#3B82F6',
    ribbon: ['#2563EB', '#1D4ED8'],
    shape: 'shield',
    emblem: 'PAN',
  },
  {
    key: 'EUROPEU',
    label: 'Europeu',
    full: 'IBJJF European Open',
    accent: '#EAB308',
    ribbon: ['#2563EB', '#1D4ED8'],
    shape: 'square',
    emblem: 'EURO',
  },
  {
    key: 'BRASILEIRO',
    label: 'Brasileiro',
    full: 'Campeonato Brasileiro de JJ',
    accent: '#22C55E',
    ribbon: ['#16A34A', '#FACC15'],
    shape: 'shield',
    emblem: 'BR',
  },
  {
    key: 'CBJJ',
    label: 'CBJJ',
    full: 'Confederação Brasileira de JJ',
    accent: '#EAB308',
    ribbon: ['#16A34A', '#FACC15'],
    shape: 'shield',
    emblem: 'CBJJ',
  },
  {
    key: 'OPEN',
    label: 'Open',
    full: 'IBJJF Open',
    accent: '#F59E0B',
    ribbon: ['#F59E0B', '#92560A'],
    shape: 'circle',
    emblem: 'OPEN',
  },
];

const MATCHERS: { re: RegExp; key: string }[] = [
  { re: /ibjjf/i, key: 'IBJJF' },
  { re: /world\s*pro|worldpro/i, key: 'WORLD_PRO' },
  { re: /adcc/i, key: 'ADCC' },
  { re: /cbjj|confeder/i, key: 'CBJJ' },
  { re: /\bpan/i, key: 'PAN' },
  { re: /bras|brazil|nacional/i, key: 'BRASILEIRO' },
  { re: /europ|euro/i, key: 'EUROPEU' },
  { re: /mundial|world/i, key: 'MUNDIAL' },
  { re: /open/i, key: 'OPEN' },
];

const DEFAULT_COMPETITION: Competition = {
  key: 'OTHER',
  label: 'Outro',
  full: 'Competição',
  accent: '#9CA3AF',
  ribbon: ['#E63946', '#9B1B27'],
  shape: 'circle',
  emblem: '',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Resolve a stored competition label to its medal style (branded or generic). */
export function competitionStyle(name: string): Competition {
  const byKey = COMPETITIONS.find((c) => c.key === name || c.label.toLowerCase() === name.toLowerCase());
  if (byKey) return byKey;
  const matched = MATCHERS.find((m) => m.re.test(name));
  if (matched) return COMPETITIONS.find((c) => c.key === matched.key)!;
  return { ...DEFAULT_COMPETITION, label: name, full: name, emblem: initials(name) };
}
