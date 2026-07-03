import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { SESSION_TYPES, WEEKDAYS } from '../lib/format';
import { useClasses, useMembers } from '../lib/hooks';
import type { ClassResponse } from '../lib/types';
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
} from '../components/ui';

export default function ClassesPage() {
  const classes = useClasses();
  const members = useMembers();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ClassResponse | 'new' | null>(null);

  const staff = useMemo(
    () => (members.data ?? []).filter((member) => member.role !== 'MEMBER'),
    [members.data],
  );

  const instructorNames = useMemo(() => {
    const map = new Map<number, string>();
    (members.data ?? []).forEach((member) => map.set(member.userId, member.displayName));
    return map;
  }, [members.data]);

  const removeClass = useMutation({
    mutationFn: (classId: number) => api(`/crm/classes/${classId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
  });

  if (classes.isLoading) return <Loading />;

  const byDay = new Map<number, ClassResponse[]>();
  (classes.data ?? []).forEach((gymClass) => {
    const list = byDay.get(gymClass.dayOfWeek) ?? [];
    list.push(gymClass);
    byDay.set(gymClass.dayOfWeek, list);
  });

  return (
    <div>
      <PageHeader
        title="Turmas"
        subtitle="Grade semanal de aulas — usada pela catraca para casar presenças automaticamente."
        actions={
          <Button onClick={() => setModal('new')}>
            <span className="inline-flex items-center gap-2">
              <CalendarPlus size={15} />
              Nova turma
            </span>
          </Button>
        }
      />

      {(classes.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma turma cadastrada"
            description="Cadastre a grade de horários para controlar presenças e check-ins."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const dayClasses = (byDay.get(day) ?? []).sort((a, b) =>
              a.startTime.localeCompare(b.startTime),
            );
            if (dayClasses.length === 0) return null;
            return (
              <div key={day}>
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-2">
                  {WEEKDAYS[day]}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {dayClasses.map((gymClass) => (
                    <Card key={gymClass.id} className="!p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-white">{gymClass.name}</p>
                          <p className="text-sm text-accent-soft font-semibold mt-0.5">
                            {gymClass.startTime} – {gymClass.endTime}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {SESSION_TYPES[gymClass.sessionType]}
                            {gymClass.instructorUserId
                              ? ` · Prof. ${instructorNames.get(gymClass.instructorUserId) ?? '—'}`
                              : ''}
                          </p>
                        </div>
                        <Badge tone={gymClass.active ? 'green' : 'gray'}>
                          {gymClass.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      <div className="flex gap-3 mt-3">
                        <button
                          className="text-xs font-semibold text-accent-soft hover:underline"
                          onClick={() => setModal(gymClass)}
                        >
                          Editar
                        </button>
                        {gymClass.active && (
                          <button
                            className="text-xs font-semibold text-zinc-400 hover:text-accent-soft"
                            onClick={() => {
                              if (window.confirm('Desativar esta turma?')) {
                                removeClass.mutate(gymClass.id);
                              }
                            }}
                          >
                            Desativar
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClassModal
        value={modal}
        staff={staff}
        onClose={() => setModal(null)}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ['classes'] });
          setModal(null);
        }}
      />
    </div>
  );
}

function ClassModal({
  value,
  staff,
  onClose,
  onSaved,
}: {
  value: ClassResponse | 'new' | null;
  staff: { userId: number; displayName: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const editing = value !== null && value !== 'new' ? value : null;
  const [name, setName] = useState('');
  const [sessionType, setSessionType] = useState('GI');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [instructorUserId, setInstructorUserId] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedId, setLoadedId] = useState<number | 'new' | null>(null);

  const currentId = value === 'new' ? 'new' : value?.id ?? null;
  if (value !== null && currentId !== loadedId) {
    setLoadedId(currentId);
    setError('');
    if (editing) {
      setName(editing.name);
      setSessionType(editing.sessionType);
      setDayOfWeek(String(editing.dayOfWeek));
      setStartTime(editing.startTime);
      setEndTime(editing.endTime);
      setInstructorUserId(editing.instructorUserId ? String(editing.instructorUserId) : '');
      setActive(editing.active);
    } else {
      setName('');
      setSessionType('GI');
      setDayOfWeek('1');
      setStartTime('18:00');
      setEndTime('19:00');
      setInstructorUserId('');
      setActive(true);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = {
        name,
        sessionType,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        instructorUserId: instructorUserId ? Number(instructorUserId) : undefined,
        ...(editing ? { active } : {}),
      };
      if (editing) {
        await api(`/crm/classes/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/crm/classes', { method: 'POST', body });
      }
      await onSaved();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar turma.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar turma — ${editing.name}` : 'Nova turma'}
      open={value !== null}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Fundamentos Gi"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modalidade">
            <select value={sessionType} onChange={(event) => setSessionType(event.target.value)}>
              {Object.entries(SESSION_TYPES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dia da semana">
            <select value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)}>
              {Object.entries(WEEKDAYS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início">
            <input
              type="time"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </Field>
          <Field label="Fim">
            <input
              type="time"
              required
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Professor">
          <select
            value={instructorUserId}
            onChange={(event) => setInstructorUserId(event.target.value)}
          >
            <option value="">Sem professor definido</option>
            {staff.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.displayName}
              </option>
            ))}
          </select>
        </Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="!w-4 h-4 accent-[#f4372f]"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Turma ativa
          </label>
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar turma'}
        </Button>
      </form>
    </Modal>
  );
}
