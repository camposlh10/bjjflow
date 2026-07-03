import brazilData from '../data/brazil.json';
import countriesData from '../data/countries.json';

export type Country = { code: string; name: string; flag: string; enName: string };
export type BrState = { uf: string; name: string };

const brazil = brazilData as { states: BrState[]; cities: Record<string, string[]> };

/** All countries (pt-BR names + emoji flag), Brazil pinned first. */
export const COUNTRIES: Country[] = countriesData as Country[];
/** Brazil's 27 federative units, alphabetical by name. */
export const BRAZIL_STATES: BrState[] = brazil.states;

export const BRAZIL_CODE = 'BR';

export function isBrazil(code?: string | null): boolean {
  return code === BRAZIL_CODE;
}

export function countryByCode(code?: string | null): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** Display name for a country code (falls back to the code itself). */
export function countryName(code?: string | null): string {
  return countryByCode(code)?.name ?? code ?? '';
}

/** English country name (used to query the geo API, which keys on English names). */
export function countryEnName(code?: string | null): string {
  return countryByCode(code)?.enName ?? countryByCode(code)?.name ?? code ?? '';
}

/** Resolve a stored country display name (pt or en) back to its code. */
export function countryCodeByName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === n || c.enName.toLowerCase() === n)?.code;
}

/** Emoji flag for a stored country display name (pt or en); '' if unknown. */
export function countryFlag(name?: string | null): string {
  if (!name) return '';
  const n = name.trim().toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === n || c.enName.toLowerCase() === n)?.flag ?? '';
}

/** Cities of a Brazilian state (UF sigla); empty for unknown UFs. */
export function citiesForUf(uf?: string | null): string[] {
  return (uf && brazil.cities[uf]) || [];
}

/** Full name of a Brazilian state from its UF sigla (falls back to the sigla). */
export function brStateName(uf?: string | null): string {
  return BRAZIL_STATES.find((s) => s.uf === uf)?.name ?? uf ?? '';
}
