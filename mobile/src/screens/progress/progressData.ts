import type { CheckInEntry } from '../../api/checkins';
import { t, tf } from '../../i18n';
import type { TranslationKey } from '../../i18n/pt';

/** Local calendar dates as 'YYYY-MM-DD' (the server stores check-ins by local date). */
export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Monday of the week containing `d` (weeks run Monday to Sunday, like the server). */
export function mondayOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -day);
}

export const weekdayInitials = () => t('progress.weekdays').split(',');
export const monthName = (m: number) => t('progress.months').split(',')[m];
export const monthShort = (m: number) => t('progress.monthsShort').split(',')[m];

/** "12 nov. 2026" */
export function longDate(d: Date): string {
  return `${d.getDate()} ${monthShort(d.getMonth())} ${d.getFullYear()}`;
}

/** "16–22 nov.", or "28 out.–3 nov." across months (no year). */
export function shortRange(from: Date, to: Date): string {
  if (from.getMonth() === to.getMonth()) return `${from.getDate()}–${to.getDate()} ${monthShort(to.getMonth())}`;
  return `${from.getDate()} ${monthShort(from.getMonth())}–${to.getDate()} ${monthShort(to.getMonth())}`;
}

/** "09–15 nov. 2026", or "28 out.–03 nov. 2026" across months. */
export function rangeLabel(from: Date, to: Date): string {
  const dd = (d: Date) => String(d.getDate()).padStart(2, '0');
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${dd(from)}–${dd(to)} ${monthShort(to.getMonth())} ${to.getFullYear()}`;
  }
  return `${dd(from)} ${monthShort(from.getMonth())}–${dd(to)} ${monthShort(to.getMonth())} ${to.getFullYear()}`;
}

export function hours(minutes: number): string {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** "Hoje", "Ontem", or "12 nov." */
export function relativeDay(date: string, today: Date): string {
  const diff = Math.round((parseIso(iso(today)).getTime() - parseIso(date).getTime()) / 86_400_000);
  if (diff === 0) return t('progress.day.today');
  if (diff === 1) return t('progress.day.yesterday');
  const d = parseIso(date);
  return `${d.getDate()} ${monthShort(d.getMonth())}`;
}

export type Summary = { sessions: number; days: number; minutes: number; dates: Set<string> };

export function summarize(entries: CheckInEntry[], from: string, to: string): Summary {
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);
  return {
    sessions: inRange.length,
    days: new Set(inRange.map((e) => e.date)).size,
    minutes: inRange.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0),
    dates: new Set(inRange.map((e) => e.date)),
  };
}

/** Training days in each of the last `weeks` weeks, oldest first (last = this week). */
export function weeklyDays(entries: CheckInEntry[], today: Date, weeks: number): { start: Date; days: number }[] {
  const thisMonday = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisMonday, -7 * (weeks - 1 - i));
    const s = summarize(entries, iso(start), iso(addDays(start, 6)));
    return { start, days: s.days };
  });
}

/** Month grid, Monday first: null for the blanks before day 1. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => new Date(year, month, i + 1)),
  ];
}

/** Sessions per kind (GI / NOGI / other). */
export function kinds(entries: CheckInEntry[]): { gi: number; nogi: number } {
  let gi = 0;
  let nogi = 0;
  for (const e of entries) {
    if (e.sessionType === 'GI') gi++;
    else if (e.sessionType === 'NOGI') nogi++;
  }
  return { gi, nogi };
}

export function sessionLabel(type: string | null): string {
  if (type === 'GI' || type === 'NOGI' || type === 'OPEN_MAT') return t(`checkin.type.${type}` as const);
  return t('checkin.type.GI');
}

export function plural(n: number, one: TranslationKey, many: TranslationKey, vars: Record<string, string | number> = {}) {
  return n === 1 ? tf(one, { n, ...vars }) : tf(many, { n, ...vars });
}
