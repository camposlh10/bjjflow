import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import {
  ATTENDANCE_STATUS,
  BELTS,
  CREDENTIAL_TYPES,
  GYM_ROLES,
  money,
  PAYMENT_STATUS,
  shortDate,
} from '../lib/format';
import { useGym } from '../lib/hooks';
import type {
  AttendanceResponse,
  CredentialResponse,
  InvoiceResponse,
  MemberDetailResponse,
  PaymentPlanResponse,
} from '../lib/types';
import {
  Badge,
  BeltChip,
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

export default function StudentDetailPage() {
  const { userId } = useParams();
  const queryClient = useQueryClient();
  const gym = useGym();
  const isOwner = gym.data?.role === 'OWNER';

  const member = useQuery<MemberDetailResponse, ApiError>({
    queryKey: ['member', userId],
    queryFn: () => api<MemberDetailResponse>(`/crm/members/${userId}`),
    enabled: Boolean(userId),
  });
  const credentials = useQuery<CredentialResponse[], ApiError>({
    queryKey: ['credentials', userId],
    queryFn: () => api<CredentialResponse[]>(`/crm/members/${userId}/credentials`),
    enabled: Boolean(userId),
  });
  const attendance = useQuery<AttendanceResponse[], ApiError>({
    queryKey: ['member-attendance', userId],
    queryFn: () => api<AttendanceResponse[]>(`/crm/attendance/member/${userId}`),
    enabled: Boolean(userId),
  });
  const plans = useQuery<PaymentPlanResponse[], ApiError>({
    queryKey: ['member-plans', userId],
    queryFn: () => api<PaymentPlanResponse[]>(`/crm/payment-plans/member/${userId}`),
    enabled: Boolean(userId) && isOwner,
  });
  const invoices = useQuery<InvoiceResponse[], ApiError>({
    queryKey: ['member-invoices', userId],
    queryFn: () => api<InvoiceResponse[]>(`/crm/invoices/member/${userId}`),
    enabled: Boolean(userId) && isOwner,
  });

  const [editModal, setEditModal] = useState(false);
  const [credentialModal, setCredentialModal] = useState(false);

  const revoke = useMutation({
    mutationFn: (credentialId: number) =>
      api(`/crm/credentials/${credentialId}/revoke`, { method: 'PUT' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['credentials', userId] }),
  });

  if (member.isLoading) return <Loading />;
  if (!member.data) {
    return <EmptyState title="Aluno não encontrado" />;
  }

  const detail = member.data;

  return (
    <div>
      <Link
        to="/alunos"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-4"
      >
        <ArrowLeft size={15} />
        Voltar para alunos
      </Link>
      <PageHeader
        title={detail.displayName}
        subtitle={
          detail.username
            ? `@${detail.username} · ${GYM_ROLES[detail.role]}`
            : GYM_ROLES[detail.role]
        }
        actions={<Button onClick={() => setEditModal(true)}>Editar aluno</Button>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <h2 className="font-bold text-white mb-4">Perfil do atleta</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Faixa atual</dt>
              <dd>
                <BeltChip belt={detail.belt} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Total de aulas</dt>
              <dd className="text-white font-semibold">{detail.totalClasses}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Últimos 30 dias</dt>
              <dd className="text-white font-semibold">{detail.last30Days} aula(s)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Último treino</dt>
              <dd className="text-zinc-300">{shortDate(detail.lastAttended)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Membro desde</dt>
              <dd className="text-zinc-300">{shortDate(detail.memberSince)}</dd>
            </div>
            {detail.email && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">E-mail</dt>
                <dd className="text-zinc-300">{detail.email}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Credenciais de acesso</h2>
            <Button variant="ghost" onClick={() => setCredentialModal(true)}>
              <span className="inline-flex items-center gap-2">
                <KeyRound size={14} />
                Cadastrar
              </span>
            </Button>
          </div>
          {(credentials.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhuma credencial"
              description="Cadastre o cartão, digital ou QR do aluno para a catraca reconhecê-lo."
            />
          ) : (
            <ul className="space-y-2">
              {(credentials.data ?? []).map((credential) => (
                <li
                  key={credential.id}
                  className="flex items-center justify-between bg-panel2 border border-edge rounded-xl px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {CREDENTIAL_TYPES[credential.type]}
                      {credential.label ? ` · ${credential.label}` : ''}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono">{credential.value}</p>
                  </div>
                  {credential.active ? (
                    <button
                      className="text-xs font-semibold text-accent-soft hover:underline"
                      onClick={() => {
                        if (window.confirm('Revogar esta credencial?')) {
                          revoke.mutate(credential.id);
                        }
                      }}
                    >
                      Revogar
                    </button>
                  ) : (
                    <Badge tone="gray">Revogada</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-white mb-4">Últimas presenças</h2>
          {(attendance.data ?? []).length === 0 ? (
            <EmptyState title="Sem presenças registradas" />
          ) : (
            <ul className="space-y-2">
              {(attendance.data ?? []).slice(0, 8).map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between bg-panel2 border border-edge rounded-xl px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white">{entry.className}</p>
                    <p className="text-xs text-zinc-500">{shortDate(entry.date)}</p>
                  </div>
                  <Badge tone={statusTone(entry.status)}>{ATTENDANCE_STATUS[entry.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isOwner && (
          <Card className="xl:col-span-3">
            <h2 className="font-bold text-white mb-4">Financeiro do aluno</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">
                  Planos
                </p>
                {(plans.data ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhum plano. Crie em Pagamentos.</p>
                ) : (
                  <ul className="space-y-2">
                    {(plans.data ?? []).map((plan) => (
                      <li
                        key={plan.id}
                        className="flex items-center justify-between bg-panel2 border border-edge rounded-xl px-3 py-2.5 text-sm"
                      >
                        <span className="text-white">{plan.name}</span>
                        <span className="text-zinc-400">
                          {money(plan.amount)} · próx. {shortDate(plan.nextDueDate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">
                  Últimas faturas
                </p>
                {(invoices.data ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhuma fatura.</p>
                ) : (
                  <ul className="space-y-2">
                    {(invoices.data ?? []).slice(0, 5).map((invoice) => (
                      <li
                        key={invoice.id}
                        className="flex items-center justify-between bg-panel2 border border-edge rounded-xl px-3 py-2.5 text-sm"
                      >
                        <span className="text-white">{invoice.description}</span>
                        <span className="flex items-center gap-2 text-zinc-400">
                          {money(invoice.amount)}
                          <Badge tone={statusTone(invoice.status)}>
                            {PAYMENT_STATUS[invoice.status]}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <EditMemberModal
        open={editModal}
        detail={detail}
        onClose={() => setEditModal(false)}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ['member', userId] });
          await queryClient.invalidateQueries({ queryKey: ['members'] });
          setEditModal(false);
        }}
      />
      <EnrollCredentialModal
        open={credentialModal}
        userId={userId!}
        onClose={() => setCredentialModal(false)}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ['credentials', userId] });
          setCredentialModal(false);
        }}
      />
    </div>
  );
}

function EditMemberModal({
  open,
  detail,
  onClose,
  onSaved,
}: {
  open: boolean;
  detail: MemberDetailResponse;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [role, setRole] = useState(detail.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'MEMBER');
  const [beltSlug, setBeltSlug] = useState(detail.belt?.slug ?? '');
  const [stripes, setStripes] = useState(String(detail.belt?.stripes ?? 0));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(`/crm/members/${detail.userId}`, {
        method: 'PUT',
        body: {
          role: detail.role === 'OWNER' ? undefined : role,
          beltSlug: beltSlug || undefined,
          stripes: beltSlug ? Number(stripes) : undefined,
        },
      });
      await onSaved();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Editar — ${detail.displayName}`} open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {detail.role !== 'OWNER' && (
          <Field label="Função na academia">
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="MEMBER">Aluno</option>
              <option value="INSTRUCTOR">Professor</option>
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Faixa">
            <select value={beltSlug} onChange={(event) => setBeltSlug(event.target.value)}>
              <option value="">Manter atual</option>
              {BELTS.map((belt) => (
                <option key={belt.slug} value={belt.slug}>
                  {belt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Graus">
            <select
              value={stripes}
              onChange={(event) => setStripes(event.target.value)}
              disabled={!beltSlug}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </Modal>
  );
}

function EnrollCredentialModal({
  open,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [type, setType] = useState('CARD');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(`/crm/members/${userId}/credentials`, {
        method: 'POST',
        body: { type, value, label: label || undefined },
      });
      await onSaved();
      setValue('');
      setLabel('');
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao cadastrar credencial.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Cadastrar credencial de acesso" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-zinc-400">
          O identificador enviado pelo leitor (UID do cartão, ID da digital, conteúdo do QR) passa
          a reconhecer este aluno automaticamente na catraca.
        </p>
        <Field label="Tipo">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {Object.entries(CREDENTIAL_TYPES).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Identificador" hint="Exatamente como o hardware envia. Ex.: 04:A3:B2:C1">
          <input
            required
            maxLength={150}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field label="Etiqueta (opcional)">
          <input
            maxLength={100}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ex.: Tag azul"
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Cadastrando…' : 'Cadastrar credencial'}
        </Button>
      </form>
    </Modal>
  );
}
