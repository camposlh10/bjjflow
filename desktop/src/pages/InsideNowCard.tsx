import { useQuery } from '@tanstack/react-query';
import { DoorOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { PresenceResponse } from '../lib/types';
import { Badge, Card } from '../components/ui';

/** Who is in the gym right now, from today's passages at the devices. */
export default function InsideNowCard() {
  const presence = useQuery<PresenceResponse, ApiError>({
    queryKey: ['presence'],
    queryFn: () => api<PresenceResponse>('/crm/presence'),
    refetchInterval: 15000,
  });
  const data = presence.data;
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-panel2 text-zinc-400">
            <DoorOpen size={15} />
          </span>
          <h2 className="font-bold text-white whitespace-nowrap">Na academia agora</h2>
          <span className="text-2xl font-bold text-white tabular-nums">{data?.count ?? '—'}</span>
        </div>
        <span className="text-xs text-zinc-500">
          {data?.exitsTracked
            ? 'Pelas entradas e saídas da catraca de hoje.'
            : 'Pelas entradas de hoje; cada uma vale por 3 horas.'}
        </span>
      </div>
      {(data?.members ?? []).length === 0 ? (
        <p className="text-sm text-zinc-500">Ninguém passou pelos aparelhos nas últimas horas.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {data!.members.map((member) => (
            <li key={member.userId}>
              <Link
                to={`/alunos/${member.userId}`}
                className="flex items-center gap-2 bg-panel2 border border-edge rounded-xl px-3 py-1.5 hover:border-zinc-600"
                title={member.deviceName ? `Entrou por ${member.deviceName}` : undefined}
              >
                <span className="text-sm text-white">{member.displayName ?? `Aluno ${member.userId}`}</span>
                <span className="text-xs text-zinc-500 tabular-nums">{time(member.enteredAt)}</span>
                {member.overdue && <Badge tone="amber">Mensalidade atrasada</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
