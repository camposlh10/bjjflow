// Frases de motivação (fallback do cartão de motivação na home).
export const QUOTES = [
  'A faixa preta é uma faixa branca que nunca desistiu.',
  'Perder não existe: ou você ganha, ou você aprende.',
  'O tatame não mente.',
  'Disciplina vence talento quando o talento não treina.',
  'Um dia de cada vez, um treino de cada vez.',
];

export function quoteOfTheDay(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return QUOTES[dayOfYear % QUOTES.length];
}
