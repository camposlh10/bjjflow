import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import {
  ACCESS_EVENT_STATUS,
  ATTENDANCE_STATUS,
  dateTime,
  isoDayOfWeek,
  shortDate,
  todayIso,
} from '../lib/format';
import { useClasses, useMembers } from '../lib/hooks';
import type { AccessEventReviewResponse, AttendanceResponse } from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Modal,
  PageHeader,
  statusTone,
} from '../components/ui';

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const classes = useClasses();
  const members = useMembers();
  const [markModal, setMarkModal] = useState(false);

  const today = useQuery<AttendanceResponse[], ApiError>({
    queryKey: ['attendance-today'],
    queryFn: () => api<AttendanceResponse[]>('/crm/attendance/today'),
  });

  const unresolved = useQuery<AccessEventReviewResponse[], ApiError>({
    queryKey: ['unresolved-events'],
    queryFn: () => api<AccessEventReviewResponse[]>('/crm/attendance/unresolved-access-events'),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] }),
      queryClient.invalidateQueries({ queryKey: ['unresolved-events'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);

  if (today.isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Frequência"
        subtitle="Presenças de hoje e eventos da catraca que precisam de revisão."
        actions={
          <Button onClick={() => setMarkModal(true)}>
            <span className="inline-flex items-center gap-2">
              <ClipboardCheck size={15} />
              Marcar presença
            </span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-bold text-white mb-4">Presenças de hoje</h2>
          {(today.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma presença hoje"
              description="As presenças aparecem aqui quando o aluno passa na catraca ou é marcado manualmente."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-edge">
                  <th className="py-2 font-semibold">Aluno</th>
                  <th className="py-2 font-semibold">Turma</th>
                  <th className="py-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {(today.data ?? []).map((entry) => (
                  <tr key={entry.id} className="border-b border-edge/60 last:border-0">
                    <td className="py-2.5 text-white">{entry.displayName}</td>
                    <td className="py-2.5 text-zinc-400">{entry.className}</td>
                    <td className="py-2.5 text-right">
                      <Badge tone={statusTone(entry.status)}>
                        {ATTENDANCE_STATUS[entry.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-white mb-1">Fila de revisão da catraca</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Escaneadas que o sistema não conseguiu processar sozinho.
          </p>
          {(unresolved.data ?? []).length === 0 ? (
            <EmptyState
              title="Tudo em dia ✔"
              description="Nenhum evento de acesso pendente de revisão."
            />
          ) : (
            <ul className="space-y-3">
              {(unresolved.data ?? []).map((event) => (
                <UnresolvedEventRow key={event.id} event={event} onChanged={refresh} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <MarkAttendanceModal
        open={markModal}
        onClose={() => setMarkModal(false)}
        onSaved={async () => {
          await refresh();
          setMarkModal(false);
        }}
        classes={(classes.data ?? []).filter((gymClass) => gymClass.active)}
        members={members.data ?? []}
      />
    </div>
  );
}

function UnresolvedEventRow({
  event,
  onChanged,
}: {
  event: AccessEventReviewResponse;
  onChanged: () => Promise<unknown>;
}) {
  const classes = useClasses();
  const members = useMembers();
  const [memberId, setMemberId] = useState('');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState('');

  async function act(path: string) {
    setError('');
    try {
      await api(path, { method: 'PUT' });
      await onChanged();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao processar.');
    }
  }

  return (
    <li className="bg-panel2 border border-edge rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">
            {event.displayName ?? event.externalMemberId ?? 'Desconhecido'}
          </p>
          <p className="text-xs text-zinc-500">
            {event.deviceName ?? `Dispositivo ${event.deviceId}`} · {dateTime(event.eventTime)}
          </p>
        </div>
        <Badge tone={statusTone(event.status)}>
          {ACCESS_EVENT_STATUS[event.status] ?? event.status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        {event.status === 'UNRESOLVED_MEMBER' && (
          <>
            <select
              className="!w-48 !py-1.5 text-xs"
              value={memberId}
              onChange={(changeEvent) => setMemberId(changeEvent.target.value)}
            >
              <option value="">Vincular a um aluno…</option>
              {(members.data ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              className="!py-1.5 !px-3 text-xs"
              disabled={!memberId}
              onClick={() =>
                act(`/crm/attendance/access-events/${event.id}/link-member/${memberId}`)
              }
            >
              Vincular
            </Button>
          </>
        )}
        {event.status === 'UNRESOLVED_CLASS' && (
          <>
            <select
              className="!w-48 !py-1.5 text-xs"
              value={classId}
              onChange={(changeEvent) => setClassId(changeEvent.target.value)}
            >
              <option value="">Atribuir a uma turma…</option>
              {(classes.data ?? [])
                .filter((gymClass) => gymClass.active)
                .map((gymClass) => (
                  <option key={gymClass.id} value={gymClass.id}>
                    {gymClass.name} ({gymClass.startTime})
                  </option>
                ))}
            </select>
            <Button
              variant="ghost"
              className="!py-1.5 !px-3 text-xs"
              disabled={!classId}
              onClick={() =>
                act(`/crm/attendance/access-events/${event.id}/assign-class/${classId}`)
              }
            >
              Atribuir
            </Button>
          </>
        )}
        <button
          className="text-xs font-semibold text-zinc-400 hover:text-accent-soft ml-auto"
          onClick={() => act(`/crm/attendance/access-events/${event.id}/mark-ignored`)}
        >
          Ignorar
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
    </li>
  );
}

function MarkAttendanceModal({
  open,
  onClose,
  onSaved,
  classes,
  members,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  classes: { id: number; name: string; startTime: string; dayOfWeek: number }[];
  members: { userId: number; displayName: string }[];
}) {
  const [classId, setClassId] = useState('');
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState('PRESENT');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const todayDay = isoDayOfWeek();
  const sorted = [...classes].sort(
    (a, b) =>
      Math.abs(a.dayOfWeek - todayDay) - Math.abs(b.dayOfWeek - todayDay) ||
      a.startTime.localeCompare(b.startTime),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/crm/attendance', {
        method: 'POST',
        body: { classId: Number(classId), userId: Number(userId), date, status },
      });
      await onSaved();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao marcar presença.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Marcar presença" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Turma">
          <select required value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Selecione…</option>
            {sorted.map((gymClass) => (
              <option key={gymClass.id} value={gymClass.id}>
                {gymClass.name} ({gymClass.startTime})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aluno">
          <select required value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Selecione…</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {Object.entries(ATTENDANCE_STATUS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Marcando…' : 'Marcar presença'}
        </Button>
        <p className="text-xs text-zinc-500">
          Presenças de {shortDate(date)} contam para o progresso de graduação do aluno.
        </p>
      </form>
    </Modal>
  );
}
