// Geo lookups for countries OTHER than Brazil (Brazil ships bundled in src/data).
// CountriesNow is a free, key-less API that keys on ENGLISH country/state names.
// Uses the GET query endpoints (the POST forms 301-redirect and drop the body).
const BASE = 'https://countriesnow.space/api/v0.1';

/** State/province names for a country (English country name). Empty on error/none. */
export async function fetchStates(countryEn: string): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/countries/states/q?country=${encodeURIComponent(countryEn)}`);
    const json = (await res.json()) as { error?: boolean; data?: { states?: { name: string }[] } };
    if (json.error) return [];
    return (json.data?.states ?? []).map((s) => s.name);
  } catch {
    return [];
  }
}

/** City names for a country + exact state name (as returned by fetchStates). Empty on error/none. */
export async function fetchCities(countryEn: string, state: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${BASE}/countries/state/cities/q?country=${encodeURIComponent(countryEn)}&state=${encodeURIComponent(state)}`,
    );
    const json = (await res.json()) as { error?: boolean; data?: string[] };
    if (json.error) return [];
    return json.data ?? [];
  } catch {
    return [];
  }
}
