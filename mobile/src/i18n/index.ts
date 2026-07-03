import { en } from './en';
import { pt, TranslationKey } from './pt';

export type Locale = 'pt' | 'en';

const DICTS = { pt, en };

// The active dictionary. Switched by the locale store; screens re-read it on the
// next render (the app remounts the navigation tree on locale change).
let active: Locale = 'pt';

export function setActiveLocale(locale: Locale): void {
  active = locale;
}

export function getActiveLocale(): Locale {
  return active;
}

export function t(key: TranslationKey): string {
  return DICTS[active][key] ?? pt[key] ?? key;
}

/** t() with placeholders: tf('motivation.milestone.text', { n: 3, m: 50 }) */
export function tf(key: TranslationKey, vars: Record<string, string | number>): string {
  let text: string = DICTS[active][key] ?? pt[key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export type { TranslationKey };
