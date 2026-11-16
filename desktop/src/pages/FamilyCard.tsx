import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Copy, HeartPulse, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { DOCUMENT_STATUS, RELATIONSHIPS, shortDate, todayIso } from '../lib/format';
import type {
  FamilyResponse,
  GuardianDto,
  HealthDto,
  PickupDto,
  Relationship,
  StudentDocumentDto,
} from '../lib/types';
import { Badge, Button, Card, ErrorText, Field, Loading, Modal } from '../components/ui';

type Dialog =
  | { kind: 'basics' }
  | { kind: 'guardian'; guardian: GuardianDto | null }
  | { kind: 'pickup'; pickup: PickupDto | null }
  | { kind: 'health' }
  | { kind: 'document'; document: StudentDocumentDto };

/** XXXX-XXXX, easier to read out to a parent at the desk. */
function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/**
 * A child's family record: guardians and their app link, who may collect the
 * child, the emergency card and signed documents.
 */
export default function FamilyCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const key = ['family', userId];
  const family = useQuery<FamilyResponse, ApiError>({
    queryKey: key,
    queryFn: () => api<FamilyResponse>(`/crm/kids/students/${userId}`),
  });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState('');

  const store = (data: FamilyResponse) => {
    queryClient.setQueryData(key, data);
    void queryClient.invalidateQueries({ queryKey: ['members'] });
    void queryClient.invalidateQueries({ queryKey: ['member', userId] });
    void queryClient.invalidateQueries({ queryKey: ['kids-settings'] });
  };

  async function run(path: string, method: 'POST' | 'PUT' | 'DELETE', confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError('');
    try {
      store(await api<FamilyResponse>(path, { method }));
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar.');
    }
  }

  if (family.isLoading) {
    return (
      <Card className="xl:col-span-3">
        <Loading />
      </Card>
    );
  }
  const data = family.data;
  if (!data) return null;
  const base = `/crm/kids/students/${userId}`;

  return (
    <Card className="xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-bold text-white">Família e segurança</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            {data.birthDate ? (
              <>
                {data.age} anos · nasceu em {shortDate(data.birthDate)}
                {data.ageGroup && <> · turma {data.ageGroup}</>}
              </>
            ) : (
              <span className="text-warn">Sem data de nascimento: a idade pode estar desatualizada.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.managed && <Badge tone="blue">Perfil gerido pela academia</Badge>}
          <Button variant="ghost" onClick={() => setDialog({ kind: 'basics' })}>
            <span className="inline-flex items-center gap-2">
              <Pencil size={14} /> {data.managed ? 'Editar dados' : 'Data de nascimento'}
            </span>
          </Button>
        </div>
      </div>

      {!data.programConfigured && (
        <p className="text-sm text-zinc-400 bg-panel2 border border-edge rounded-xl px-3 py-2.5 mb-4">
          O programa kids ainda não foi configurado, então não há documentos exigidos.{' '}
          <Link to="/programa-kids" className="text-accent-soft font-semibold hover:underline">
            Configurar
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          icon={<Users size={15} />}
          title="Responsáveis"
          action={
            data.guardians.length < 6 && (
              <AddButton onClick={() => setDialog({ kind: 'guardian', guardian: null })}>Adicionar</AddButton>
            )
          }
        >
          {data.guardians.length === 0 ? (
            <p className="text-sm text-warn">Nenhum responsável cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {data.guardians.map((g) => (
                <GuardianItem
                  key={g.id}
                  guardian={g}
                  onEdit={() => setDialog({ kind: 'guardian', guardian: g })}
                  onRenew={() => run(`${base}/guardians/${g.id}/invite`, 'POST')}
                  onRemove={() =>
                    run(
                      `${base}/guardians/${g.id}`,
                      'DELETE',
                      `Remover ${g.name} como responsável? Ele perde o acesso pelo aplicativo.`,
                    )
                  }
                />
              ))}
            </ul>
          )}
        </Section>

        <Section
          icon={<ShieldCheck size={15} />}
          title="Quem pode buscar"
          action={<AddButton onClick={() => setDialog({ kind: 'pickup', pickup: null })}>Adicionar</AddButton>}
        >
          <p className="text-xs text-zinc-500 mb-2">Os responsáveis sempre podem. Inclua avós, motoristas, babás…</p>
          {data.pickups.length === 0 ? (
            <p className="text-sm text-zinc-500">Ninguém além dos responsáveis.</p>
          ) : (
            <ul className="space-y-2">
              {data.pickups.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 border ${
                    p.blocked ? 'bg-accent/10 border-accent/40' : 'bg-panel2 border-edge'
                  }`}
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-white flex items-center gap-2">
                      {p.blocked && <Ban size={14} className="text-accent-soft" />}
                      {p.name}
                      {p.blocked && <Badge tone="red">Não autorizado</Badge>}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {[p.relationship, p.phone].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {p.notes && <p className="text-xs text-zinc-500 mt-0.5">{p.notes}</p>}
                  </div>
                  <ItemActions
                    onEdit={() => setDialog({ kind: 'pickup', pickup: p })}
                    onRemove={() => run(`${base}/pickups/${p.id}`, 'DELETE', `Remover ${p.name} da lista?`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          icon={<HeartPulse size={15} />}
          title="Ficha de emergência"
          action={
            <AddButton onClick={() => setDialog({ kind: 'health' })}>{data.health ? 'Editar' : 'Preencher'}</AddButton>
          }
        >
          <HealthView health={data.health} />
        </Section>

        <Section title="Documentos">
          {data.documents.length === 0 ? (
            <p className="text-sm text-zinc-500">A academia não exige documentos.</p>
          ) : (
            <ul className="space-y-2">
              {data.documents.map((d) => {
                const status = DOCUMENT_STATUS[d.status];
                return (
                  <li
                    key={d.type.id}
                    className="flex items-start justify-between gap-3 bg-panel2 border border-edge rounded-xl px-3 py-2.5"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-white flex flex-wrap items-center gap-2">
                        {d.type.name}
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {!d.type.required && <span className="text-xs text-zinc-500">opcional</span>}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {d.signedOn
                          ? `Assinado por ${d.signedByName} em ${shortDate(d.signedOn)}${
                              d.expiresOn ? ` · vence ${shortDate(d.expiresOn)}` : ''
                            }`
                          : 'Ainda não assinado'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        className="text-xs font-semibold text-accent-soft hover:underline"
                        onClick={() => setDialog({ kind: 'document', document: d })}
                      >
                        {d.status === 'VALID' ? 'Renovar' : 'Registrar'}
                      </button>
                      {d.recordId && (
                        <button
                          aria-label="Desfazer registro"
                          title="Desfazer registro (lançado por engano)"
                          className="p-1 text-zinc-500 hover:text-accent-soft"
                          onClick={() =>
                            run(`${base}/documents/${d.recordId}`, 'DELETE', 'Desfazer este registro de assinatura?')
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
      <ErrorText>{error}</ErrorText>

      {dialog?.kind === 'basics' && (
        <BasicsModal data={data} base={base} onClose={() => setDialog(null)} onSaved={store} />
      )}
      {dialog?.kind === 'guardian' && (
        <GuardianModal guardian={dialog.guardian} base={base} onClose={() => setDialog(null)} onSaved={store} />
      )}
      {dialog?.kind === 'pickup' && (
        <PickupModal pickup={dialog.pickup} base={base} onClose={() => setDialog(null)} onSaved={store} />
      )}
      {dialog?.kind === 'health' && (
        <HealthModal health={data.health} base={base} onClose={() => setDialog(null)} onSaved={store} />
      )}
      {dialog?.kind === 'document' && (
        <DocumentModal
          document={dialog.document}
          defaultSigner={data.guardians.find((g) => g.primaryContact)?.name ?? data.guardians[0]?.name ?? ''}
          base={base}
          onClose={() => setDialog(null)}
          onSaved={store}
        />
      )}
    </Card>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-semibold text-accent-soft hover:underline"
    >
      <Plus size={13} /> {children}
    </button>
  );
}

function ItemActions({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button aria-label="Editar" className="p-1 text-zinc-500 hover:text-white" onClick={onEdit}>
        <Pencil size={13} />
      </button>
      <button aria-label="Remover" className="p-1 text-zinc-500 hover:text-accent-soft" onClick={onRemove}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function GuardianItem({
  guardian: g,
  onEdit,
  onRenew,
  onRemove,
}: {
  guardian: GuardianDto;
  onEdit: () => void;
  onRenew: () => void;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const expired = g.inviteExpiresAt != null && new Date(g.inviteExpiresAt) < new Date();
  return (
    <li className="bg-panel2 border border-edge rounded-xl px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-white flex flex-wrap items-center gap-2">
            {g.name}
            <span className="text-xs font-normal text-zinc-400">{RELATIONSHIPS[g.relationship]}</span>
            {g.primaryContact && <Badge tone="blue">Contato principal</Badge>}
            {g.financialResponsible && <Badge tone="gray">Financeiro</Badge>}
          </p>
          <p className="text-xs text-zinc-400">{[g.phone, g.email].filter(Boolean).join(' · ') || 'Sem contato'}</p>
        </div>
        <ItemActions onEdit={onEdit} onRemove={onRemove} />
      </div>
      <div className="mt-2 text-xs">
        {g.status === 'ACTIVE' ? (
          <span className="text-ok">
            App conectado{g.linkedAccountName ? ` (${g.linkedAccountName})` : ''} em {shortDate(g.linkedAt)}
          </span>
        ) : expired || !g.inviteCode ? (
          <span className="text-zinc-400">
            Código expirado.{' '}
            <button className="font-semibold text-accent-soft hover:underline" onClick={onRenew}>
              Gerar novo
            </button>
          </span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2 text-zinc-400">
            Código para o app:
            <code className="font-mono font-bold text-white tracking-wider">{formatCode(g.inviteCode)}</code>
            <button
              aria-label="Copiar código"
              className="text-zinc-400 hover:text-white"
              onClick={() => {
                void navigator.clipboard?.writeText(formatCode(g.inviteCode!));
                setCopied(true);
              }}
            >
              <Copy size={12} />
            </button>
            {copied ? 'copiado' : `válido até ${shortDate(g.inviteExpiresAt)}`}
          </span>
        )}
      </div>
    </li>
  );
}

function HealthView({ health }: { health: HealthDto | null }) {
  if (!health) return <p className="text-sm text-warn">Ficha não preenchida.</p>;
  const rows: [string, string | null, boolean?][] = [
    ['Alergias', health.allergies, true],
    ['Condições', health.conditions, true],
    ['Medicamentos', health.medications],
    ['Tipo sanguíneo', health.bloodType],
    ['Plano de saúde', health.healthPlan],
    ['Observações', health.emergencyNotes],
  ];
  return (
    <div>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value, alert]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-zinc-500 shrink-0">{label}</dt>
            <dd className={`text-right ${value && alert ? 'text-accent-soft font-semibold' : 'text-zinc-300'}`}>
              {value ?? (alert ? 'Nenhuma informada' : '—')}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-zinc-500 mt-2">
        Atualizada em {shortDate(health.updatedAt)}
        {health.updatedByName ? ` por ${health.updatedByName}` : ''}
      </p>
    </div>
  );
}

// ---------- dialogs ----------

function useSubmit(onSaved: (data: FamilyResponse) => void, onClose: () => void) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(path: string, method: 'POST' | 'PUT', body: unknown) {
    setError('');
    setBusy(true);
    try {
      onSaved(await api<FamilyResponse>(path, { method, body }));
      onClose();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, submit };
}

interface DialogProps {
  base: string;
  onClose: () => void;
  onSaved: (data: FamilyResponse) => void;
}

function BasicsModal({ data, base, onClose, onSaved }: DialogProps & { data: FamilyResponse }) {
  const [firstName, setFirstName] = useState(data.displayName.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(data.displayName.split(' ').slice(1).join(' '));
  const [birthDate, setBirthDate] = useState(data.birthDate ?? '');
  const { error, busy, submit } = useSubmit(onSaved, onClose);
  const locked = !data.managed && data.birthDate != null;

  return (
    <Modal title={data.managed ? 'Dados da criança' : 'Data de nascimento'} open onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(`${base}/basics`, 'PUT', {
            firstName: data.managed ? firstName : undefined,
            lastName: data.managed ? lastName : undefined,
            birthDate: birthDate || undefined,
          });
        }}
        className="space-y-4"
      >
        {data.managed && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome">
              <input required maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Sobrenome">
              <input required maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
        )}
        <Field
          label="Data de nascimento"
          hint={locked ? 'Informada pelo próprio aluno no aplicativo.' : undefined}
        >
          <input
            type="date"
            max={todayIso()}
            disabled={locked}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy || (locked && !data.managed)} className="w-full">
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </Modal>
  );
}

export function GuardianFields({
  value,
  onChange,
}: {
  value: GuardianForm;
  onChange: (value: GuardianForm) => void;
}) {
  const set = (patch: Partial<GuardianForm>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="grid grid-cols-[1fr_11rem] gap-3">
        <Field label="Nome do responsável">
          <input required maxLength={120} value={value.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Parentesco">
          <select value={value.relationship} onChange={(e) => set({ relationship: e.target.value as Relationship })}>
            {Object.entries(RELATIONSHIPS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone">
          <input maxLength={30} value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <input type="email" maxLength={255} value={value.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
      </div>
    </>
  );
}

export interface GuardianForm {
  name: string;
  relationship: Relationship;
  phone: string;
  email: string;
}

function GuardianModal({ guardian, base, onClose, onSaved }: DialogProps & { guardian: GuardianDto | null }) {
  const [form, setForm] = useState<GuardianForm>({
    name: guardian?.name ?? '',
    relationship: guardian?.relationship ?? 'MOTHER',
    phone: guardian?.phone ?? '',
    email: guardian?.email ?? '',
  });
  const [primaryContact, setPrimaryContact] = useState(guardian?.primaryContact ?? false);
  const [financial, setFinancial] = useState(guardian?.financialResponsible ?? false);
  const { error, busy, submit } = useSubmit(onSaved, onClose);

  return (
    <Modal title={guardian ? `Editar — ${guardian.name}` : 'Novo responsável'} open onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const body = { ...form, primaryContact, financialResponsible: financial };
          void submit(guardian ? `${base}/guardians/${guardian.id}` : `${base}/guardians`, guardian ? 'PUT' : 'POST', body);
        }}
        className="space-y-4"
      >
        <GuardianFields value={form} onChange={setForm} />
        <Check checked={primaryContact} onChange={setPrimaryContact}>
          Contato principal (o primeiro a ser chamado)
        </Check>
        <Check checked={financial} onChange={setFinancial}>
          Responsável financeiro
        </Check>
        {!guardian && (
          <p className="text-xs text-zinc-500">
            Geramos um código para o responsável conectar o aplicativo BJJ Flow à criança. Válido por 14 dias.
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </Modal>
  );
}

function PickupModal({ pickup, base, onClose, onSaved }: DialogProps & { pickup: PickupDto | null }) {
  const [name, setName] = useState(pickup?.name ?? '');
  const [relationship, setRelationship] = useState(pickup?.relationship ?? '');
  const [phone, setPhone] = useState(pickup?.phone ?? '');
  const [notes, setNotes] = useState(pickup?.notes ?? '');
  const [blocked, setBlocked] = useState(pickup?.blocked ?? false);
  const { error, busy, submit } = useSubmit(onSaved, onClose);

  return (
    <Modal title={pickup ? `Editar — ${pickup.name}` : 'Adicionar pessoa'} open onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const body = { name, relationship, phone, notes, blocked };
          void submit(pickup ? `${base}/pickups/${pickup.id}` : `${base}/pickups`, pickup ? 'PUT' : 'POST', body);
        }}
        className="space-y-4"
      >
        <Field label="Nome">
          <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Relação com a criança">
            <input maxLength={60} placeholder="Avó, motorista…" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Observações">
          <input maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Check checked={blocked} onChange={setBlocked}>
          <span>
            <strong className="text-accent-soft">Não autorizado</strong> — esta pessoa não pode buscar a criança
            (por exemplo, por decisão judicial)
          </span>
        </Check>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </Modal>
  );
}

function HealthModal({ health, base, onClose, onSaved }: DialogProps & { health: HealthDto | null }) {
  const [form, setForm] = useState({
    allergies: health?.allergies ?? '',
    conditions: health?.conditions ?? '',
    medications: health?.medications ?? '',
    bloodType: health?.bloodType ?? '',
    healthPlan: health?.healthPlan ?? '',
    emergencyNotes: health?.emergencyNotes ?? '',
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((previous) => ({ ...previous, [key]: e.target.value }));
  const { error, busy, submit } = useSubmit(onSaved, onClose);

  return (
    <Modal title="Ficha de emergência" open onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(`${base}/health`, 'PUT', form);
        }}
        className="space-y-4"
      >
        <Field label="Alergias">
          <textarea rows={2} maxLength={500} value={form.allergies} onChange={set('allergies')} />
        </Field>
        <Field label="Condições de saúde" hint="Asma, epilepsia, diabetes, TDAH…">
          <textarea rows={2} maxLength={500} value={form.conditions} onChange={set('conditions')} />
        </Field>
        <Field label="Medicamentos de uso contínuo">
          <input maxLength={500} value={form.medications} onChange={set('medications')} />
        </Field>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label="Tipo sanguíneo">
            <select value={form.bloodType} onChange={set('bloodType')}>
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plano de saúde">
            <input maxLength={120} value={form.healthPlan} onChange={set('healthPlan')} />
          </Field>
        </div>
        <Field label="Observações para emergência">
          <textarea rows={2} maxLength={500} value={form.emergencyNotes} onChange={set('emergencyNotes')} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </Modal>
  );
}

function DocumentModal({
  document,
  defaultSigner,
  base,
  onClose,
  onSaved,
}: DialogProps & { document: StudentDocumentDto; defaultSigner: string }) {
  const [signedByName, setSignedByName] = useState(defaultSigner);
  const [signedOn, setSignedOn] = useState(todayIso());
  const { error, busy, submit } = useSubmit(onSaved, onClose);

  return (
    <Modal title={`Registrar — ${document.type.name}`} open onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(`${base}/documents`, 'POST', { documentTypeId: document.type.id, signedByName, signedOn });
        }}
        className="space-y-4"
      >
        <p className="text-sm text-zinc-400">
          Registre aqui o documento assinado em papel. Guarde a via assinada na academia.
        </p>
        <Field label="Assinado por">
          <input required maxLength={120} value={signedByName} onChange={(e) => setSignedByName(e.target.value)} />
        </Field>
        <Field
          label="Data da assinatura"
          hint={document.type.renewalMonths ? `Vence ${document.type.renewalMonths} meses depois.` : 'Não vence.'}
        >
          <input type="date" required max={todayIso()} value={signedOn} onChange={(e) => setSignedOn(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Salvando…' : 'Registrar assinatura'}
        </Button>
      </form>
    </Modal>
  );
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="!w-4 h-4 mt-0.5 shrink-0 accent-[#f4372f]"
      />
      {children}
    </label>
  );
}
