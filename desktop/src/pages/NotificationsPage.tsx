import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Zap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { dateTime } from '../lib/format';
import { useGym, useMembers } from '../lib/hooks';
import type {
  AnnouncementResponse,
  AutomationEventResponse,
  AutomationEventType,
  RunAutomationsResponse,
} from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  PageHeader,
} from '../components/ui';

const EVENT_LABELS: Record<AutomationEventType, string> = {
  PAYMENT_REMINDER: 'Lembrete de pagamento',
  PAYMENT_OVERDUE: 'Fatura em atraso',
  PAYMENT_CONFIRMED: 'Pagamento confirmado',
  DELINQUENT_FLAG: 'Inadimplência',
  ENGAGEMENT_NUDGE: 'Incentivo de treino',
  COACH_FOLLOW_UP: 'Acompanhamento',
  RETENTION_ALERT: 'Risco de evasão',
  CLASS_REMINDER: 'Lembrete de aula',
  CLASS_CANCELLED: 'Aula cancelada',
  ANNOUNCEMENT: 'Comunicado',
};

function eventTone(type: AutomationEventType): 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  switch (type) {
    case 'ANNOUNCEMENT':
      return 'blue';
    case 'PAYMENT_REMINDER':
    case 'CLASS_REMINDER':
    case 'ENGAGEMENT_NUDGE':
      return 'amber';
    case 'PAYMENT_OVERDUE':
    case 'DELINQUENT_FLAG':
    case 'RETENTION_ALERT':
      return 'red';
    case 'COACH_FOLLOW_UP':
    case 'PAYMENT_CONFIRMED':
      return 'green';
    default:
      return 'gray';
  }
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const gym = useGym();
  const members = useMembers();
  const isOwner = gym.data?.role === 'OWNER';

  const events = useQuery<AutomationEventResponse[], ApiError>({
    queryKey: ['automation-events'],
    queryFn: () => api<AutomationEventResponse[]>('/crm/notifications/events'),
  });

  const [memberUserId, setMemberUserId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const runAutomations = useMutation({
    mutationFn: () =>
      api<RunAutomationsResponse>('/crm/notifications/run-automations', { method: 'POST' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['automation-events'] });
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      setFeedback(
        result.createdEvents === 0
          ? 'Automações executadas — nada novo a notificar.'
          : `Automações executadas — ${result.createdEvents} notificação(ões) enviada(s).`,
      );
    },
  });

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    setError('');
    setFeedback('');
    setBusy(true);
    try {
      const result = await api<AnnouncementResponse>('/crm/notifications/announcements', {
        method: 'POST',
        body: {
          memberUserId: memberUserId ? Number(memberUserId) : undefined,
          title,
          message,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['automation-events'] });
      setFeedback(`Comunicado enviado para ${result.recipientCount} aluno(s).`);
      setTitle('');
      setMessage('');
      setMemberUserId('');
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao enviar comunicado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notificações"
        subtitle="Comunicados manuais e automações — os alunos recebem tudo no aplicativo BJJ Flow."
        actions={
          isOwner && (
            <Button
              variant="ghost"
              onClick={() => runAutomations.mutate()}
              disabled={runAutomations.isPending}
            >
              <span className="inline-flex items-center gap-2">
                <Zap size={15} />
                {runAutomations.isPending ? 'Executando…' : 'Executar automações agora'}
              </span>
            </Button>
          )
        }
      />

      {feedback && (
        <p className="mb-4 text-sm text-ok bg-ok/10 border border-ok/30 rounded-lg px-3 py-2">
          {feedback}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="p-2 rounded-lg bg-accent/15 text-accent-soft">
              <Megaphone size={16} />
            </span>
            <h2 className="font-bold text-white">Enviar comunicado</h2>
          </div>
          <form onSubmit={handleSend} className="space-y-4">
            <Field label="Destinatário">
              <select
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
              >
                <option value="">Todos os alunos</option>
                {(members.data ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Título">
              <input
                required
                maxLength={150}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Aviso de feriado"
              />
            </Field>
            <Field label="Mensagem">
              <textarea
                required
                rows={4}
                maxLength={500}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escreva o comunicado…"
              />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy} className="w-full">
              <span className="inline-flex items-center gap-2 justify-center">
                <Send size={15} />
                {busy ? 'Enviando…' : 'Enviar'}
              </span>
            </Button>
          </form>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="font-bold text-white mb-1">Atividade recente</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Lembretes de pagamento, alertas de frequência e lembretes de aula rodam
            automaticamente todos os dias — cada notificação é enviada uma única vez.
          </p>
          {events.isLoading ? (
            <Loading />
          ) : (events.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma notificação ainda"
              description="Envie um comunicado ou aguarde as automações diárias entrarem em ação."
            />
          ) : (
            <ul className="space-y-2">
              {(events.data ?? []).map((event) => (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-3 bg-panel2 border border-edge rounded-xl px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={eventTone(event.type)}>
                        {EVENT_LABELS[event.type] ?? event.type}
                      </Badge>
                      {event.memberName && (
                        <span className="text-xs text-zinc-400">{event.memberName}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white mt-1">{event.title}</p>
                    {event.body && (
                      <p className="text-xs text-zinc-500 mt-0.5 break-words">{event.body}</p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 whitespace-nowrap shrink-0">
                    {dateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
