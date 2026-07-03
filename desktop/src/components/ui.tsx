import { X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-panel border border-edge rounded-2xl p-5 ${className}`}>{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-accent hover:bg-accent-soft text-white',
    ghost: 'bg-panel2 hover:bg-edge text-zinc-200 border border-edge',
    danger: 'bg-transparent hover:bg-accent/10 text-accent border border-accent/50',
  };
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

const badgeTones: Record<string, string> = {
  green: 'bg-ok/15 text-ok',
  amber: 'bg-warn/15 text-warn',
  red: 'bg-accent/15 text-accent-soft',
  gray: 'bg-zinc-500/15 text-zinc-400',
  blue: 'bg-sky-500/15 text-sky-400',
};

export function Badge({ tone, children }: { tone: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  switch (status) {
    case 'PAID':
    case 'PRESENT':
    case 'PROCESSED_ATTENDANCE':
      return 'green';
    case 'PENDING':
    case 'LATE':
    case 'UNRESOLVED_CLASS':
    case 'RECEIVED':
      return 'amber';
    case 'OVERDUE':
    case 'ABSENT':
    case 'UNRESOLVED_MEMBER':
    case 'FAILED':
      return 'red';
    case 'PROCESSED_GYM_VISIT':
      return 'blue';
    default:
      return 'gray';
  }
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-zinc-500 mt-1">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-accent-soft mt-2">{children}</p>;
}

export function Modal({
  title,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-panel border border-edge rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'}
          max-h-[90vh] overflow-y-auto shadow-2xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <h2 className="font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-10">
      <p className="font-semibold text-zinc-300">{title}</p>
      {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">
      Carregando…
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  detail,
  accent = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="flex items-start gap-4">
      <div
        className={`p-2.5 rounded-xl ${accent ? 'bg-accent/15 text-accent-soft' : 'bg-panel2 text-zinc-300'}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-white mt-0.5 truncate">{value}</p>
        {detail && <div className="text-xs text-zinc-500 mt-1">{detail}</div>}
      </div>
    </Card>
  );
}

export function BeltChip({
  belt,
}: {
  belt: { namePt?: string | null; colorHex?: string | null; stripes?: number } | null;
}) {
  if (!belt) return <span className="text-zinc-500 text-sm">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        className="w-3.5 h-3.5 rounded-full border border-white/20"
        style={{ backgroundColor: belt.colorHex ?? '#666' }}
      />
      {belt.namePt ?? 'Faixa'}
      {belt.stripes ? <span className="text-zinc-500 text-xs">{belt.stripes} grau(s)</span> : null}
    </span>
  );
}
