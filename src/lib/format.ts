const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function money(value: number | null | undefined): string {
  return brl.format(value ?? 0);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** ISO day of week: 1 = Monday … 7 = Sunday (matches the backend). */
export function isoDayOfWeek(date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export const WEEKDAYS: Record<number, string> = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
  7: 'Domingo',
};

export const WEEKDAYS_SHORT: Record<number, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
  7: 'Dom',
};

export const SESSION_TYPES: Record<string, string> = {
  GI: 'Gi (Kimono)',
  NOGI: 'No-Gi',
  OPEN_MAT: 'Open Mat',
};

export const BILLING_CYCLES: Record<string, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

export const PAYMENT_STATUS: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

export const PAYMENT_PROVIDERS: Record<string, string> = {
  MANUAL: 'Manual',
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão',
  BANK_TRANSFER: 'Transferência',
  OTHER: 'Outro',
};

export const CREDENTIAL_TYPES: Record<string, string> = {
  CARD: 'Cartão / Tag',
  FINGERPRINT: 'Digital',
  QR: 'QR Code',
  PIN: 'PIN',
  OTHER: 'Outro',
};

export const ATTENDANCE_STATUS: Record<string, string> = {
  PRESENT: 'Presente',
  LATE: 'Atrasado',
  ABSENT: 'Ausente',
};

export const ACCESS_EVENT_STATUS: Record<string, string> = {
  RECEIVED: 'Recebido',
  PROCESSED_ATTENDANCE: 'Presença registrada',
  PROCESSED_GYM_VISIT: 'Visita à academia',
  UNRESOLVED_MEMBER: 'Aluno não identificado',
  UNRESOLVED_CLASS: 'Turma não identificada',
  DUPLICATE: 'Duplicado',
  FAILED: 'Falhou',
  IGNORED: 'Ignorado',
};

export const GYM_ROLES: Record<string, string> = {
  OWNER: 'Proprietário',
  INSTRUCTOR: 'Professor',
  MEMBER: 'Aluno',
};

export const BELTS: { slug: string; label: string }[] = [
  { slug: 'adult-white', label: 'Branca' },
  { slug: 'adult-blue', label: 'Azul' },
  { slug: 'adult-purple', label: 'Roxa' },
  { slug: 'adult-brown', label: 'Marrom' },
  { slug: 'adult-black', label: 'Preta' },
];
