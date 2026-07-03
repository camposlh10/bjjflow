// Deve espelhar os seeds de belt_ranks no backend (V1__belt_systems.sql).
export type BeltOption = {
  slug: string;
  namePt: string;
  color: string;
  /** cor do texto sobre a faixa, para faixas claras */
  darkText?: boolean;
};

export const ADULT_BELTS: BeltOption[] = [
  { slug: 'adult-white', namePt: 'Branca', color: '#FFFFFF', darkText: true },
  { slug: 'adult-blue', namePt: 'Azul', color: '#1D4ED8' },
  { slug: 'adult-purple', namePt: 'Roxa', color: '#7C3AED' },
  { slug: 'adult-brown', namePt: 'Marrom', color: '#78350F' },
  { slug: 'adult-black', namePt: 'Preta', color: '#18181B' },
];

export const KIDS_BELTS: BeltOption[] = [
  { slug: 'kids-white', namePt: 'Branca', color: '#FFFFFF', darkText: true },
  { slug: 'kids-grey', namePt: 'Cinza', color: '#9CA3AF', darkText: true },
  { slug: 'kids-yellow', namePt: 'Amarela', color: '#FACC15', darkText: true },
  { slug: 'kids-orange', namePt: 'Laranja', color: '#F97316' },
  { slug: 'kids-green', namePt: 'Verde', color: '#16A34A' },
];

// IBJJF: faixas infantis até 15 anos
export const beltOptionsForAge = (age: number): BeltOption[] =>
  age < 16 ? KIDS_BELTS : ADULT_BELTS;

// Ponteira preta nas faixas coloridas; vermelha na faixa preta
export const rankBarColorFor = (slug: string): string =>
  slug === 'adult-black' ? '#B91C1C' : '#18181B';

export const beltBySlug = (slug: string): BeltOption | undefined =>
  [...ADULT_BELTS, ...KIDS_BELTS].find((b) => b.slug === slug);

// Deve espelhar belt_ranks.max_stripes do backend (preta vai até 6 graus)
export const maxStripesFor = (slug: string): number => (slug === 'adult-black' ? 6 : 4);
