const MONTHS_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/** Data/hora absoluta estilo Twitter: "07:32 · 11 de jun de 2026". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} · ${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Data curta para o feed: "11 jun, 07:32" (ano só quando diferente do atual). */
export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const year = sameYear ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]}${year}, ${hh}:${mm}`;
}

const MONTHS_FULL_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Mês e ano por extenso: "outubro de 2026". */
export function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_FULL_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Cabeçalho de dia na agenda: "Hoje · Qua, 11 jun", "Amanhã · ...", "Qui, 12 jun". */
export function dayHeader(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_PT[d.getMonth()]}`;
  if (diff === 0) return `Hoje · ${base}`;
  if (diff === 1) return `Amanhã · ${base}`;
  return base;
}

/** Tempo relativo curto em pt-BR: "agora", "5min", "3h", "2d", "4sem". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}sem`;
}
