import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { DOCUMENT_KINDS } from '../lib/format';
import { useGym, useKidsSettings } from '../lib/hooks';
import type { DocumentKind, DocumentTypeDto, KidsSettingsResponse } from '../lib/types';
import { Badge, Button, Card, ErrorText, Field, Loading, Modal, PageHeader } from '../components/ui';

/**
 * The owner sets up the kids program once: rules, age groups and documents.
 * Staff see it read-only, plus the checklist of what is still missing.
 */
export default function KidsProgramPage() {
  const gym = useGym();
  const settings = useKidsSettings();
  const queryClient = useQueryClient();
  const isOwner = gym.data?.role === 'OWNER';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const store = (data: KidsSettingsResponse) => {
    queryClient.setQueryData(['kids-settings'], data);
    void queryClient.invalidateQueries({ queryKey: ['members'] });
  };

  async function applyRecommended() {
    setError('');
    setBusy(true);
    try {
      store(await api<KidsSettingsResponse>('/crm/kids/settings/recommended', { method: 'POST' }));
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao configurar.');
    } finally {
      setBusy(false);
    }
  }

  if (settings.isLoading || gym.isLoading) return <Loading />;
  const data = settings.data;
  if (!data) return <ErrorText>Não foi possível carregar o programa kids.</ErrorText>;

  if (!data.configured) {
    return (
      <div>
        <PageHeader title="Programa Kids" subtitle="Crianças, responsáveis, documentos e segurança na saída." />
        <Card className="max-w-2xl">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-accent/15 text-accent-soft">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-white">Configure em um clique</h2>
              <p className="text-sm text-zinc-400 mt-1">
                A configuração recomendada já cria tudo o que a maioria das academias usa. Depois você
                ajusta só o que quiser:
              </p>
              <ul className="text-sm text-zinc-300 mt-3 space-y-1.5 list-disc pl-5">
                <li>Turmas por idade: Pequenos (4–6), Kids (7–11) e Juvenil (12–15)</li>
                <li>Documentos: termo de responsabilidade e ficha médica (renovação anual) e autorização de uso de imagem</li>
                <li>Saída segura: só responsáveis e pessoas autorizadas retiram a criança, com alerta após 15 min de atraso</li>
                <li>Documentos pendentes geram aviso para a equipe, sem bloquear o treino</li>
              </ul>
              {isOwner ? (
                <Button className="mt-5" onClick={applyRecommended} disabled={busy}>
                  {busy ? 'Configurando…' : 'Usar configuração recomendada'}
                </Button>
              ) : (
                <p className="text-sm text-zinc-500 mt-5">Peça ao proprietário da academia para ativar o programa.</p>
              )}
              <ErrorText>{error}</ErrorText>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Programa Kids"
        subtitle={
          isOwner
            ? 'Regras que valem para todas as crianças da academia. Só o proprietário pode alterar.'
            : 'Regras definidas pelo proprietário da academia.'
        }
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChecklistCard data={data} />
        <RulesCard data={data} canEdit={isOwner} onSaved={store} />
        <DocumentsCard data={data} canEdit={isOwner} onSaved={store} />
      </div>
    </div>
  );
}

function ChecklistCard({ data }: { data: KidsSettingsResponse }) {
  const c = data.checklist;
  const items: { count: number; label: string }[] = [
    { count: c.withoutGuardian, label: 'sem responsável cadastrado' },
    { count: c.withMissingDocuments, label: 'com documento obrigatório pendente ou vencido' },
    { count: c.withoutHealthInfo, label: 'sem ficha de emergência' },
    { count: c.withoutBirthDate, label: 'sem data de nascimento (idade pode estar desatualizada)' },
  ];
  const done = items.every((item) => item.count === 0);
  return (
    <Card>
      <h2 className="font-bold text-white">O que falta</h2>
      <p className="text-sm text-zinc-500 mt-0.5 mb-4">
        {c.kids === 0
          ? 'Nenhuma criança cadastrada ainda.'
          : `${c.kids} criança(s) abaixo de ${data.adultAge} anos.`}
      </p>
      {c.kids > 0 && done ? (
        <p className="flex items-center gap-2 text-sm text-ok">
          <CheckCircle2 size={16} /> Tudo em dia.
        </p>
      ) : (
        <ul className="space-y-2">
          {items
            .filter((item) => item.count > 0)
            .map((item) => (
              <li key={item.label} className="flex items-start gap-2 text-sm text-zinc-300">
                <CircleAlert size={15} className="text-warn mt-0.5 shrink-0" />
                <span>
                  <strong className="text-white">{item.count}</strong> {item.label}
                </span>
              </li>
            ))}
        </ul>
      )}
      <Link
        to="/alunos?filtro=kids"
        className="inline-block mt-4 text-sm font-semibold text-accent-soft hover:underline"
      >
        Ver crianças →
      </Link>
    </Card>
  );
}

interface GroupRow {
  name: string;
  minAge: string;
  maxAge: string;
}

function RulesCard({
  data,
  canEdit,
  onSaved,
}: {
  data: KidsSettingsResponse;
  canEdit: boolean;
  onSaved: (data: KidsSettingsResponse) => void;
}) {
  const [checkoutRequired, setCheckoutRequired] = useState(true);
  const [pickupListOnly, setPickupListOnly] = useState(true);
  const [latePickupMinutes, setLatePickupMinutes] = useState('15');
  const [policy, setPolicy] = useState<'WARN' | 'BLOCK'>('WARN');
  const [adultAge, setAdultAge] = useState('16');
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCheckoutRequired(data.checkoutRequired ?? true);
    setPickupListOnly(data.pickupListOnly ?? true);
    setLatePickupMinutes(String(data.latePickupMinutes ?? 15));
    setPolicy(data.missingDocumentsPolicy ?? 'WARN');
    setAdultAge(String(data.adultAge));
    setGroups(data.ageGroups.map((g) => ({ name: g.name, minAge: String(g.minAge), maxAge: String(g.maxAge) })));
  }, [data]);

  function updateGroup(index: number, patch: Partial<GroupRow>) {
    setSaved(false);
    setGroups((previous) => previous.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaved(false);
    setBusy(true);
    try {
      onSaved(
        await api<KidsSettingsResponse>('/crm/kids/settings', {
          method: 'PUT',
          body: {
            checkoutRequired,
            pickupListOnly,
            latePickupMinutes: Number(latePickupMinutes),
            missingDocumentsPolicy: policy,
            adultAge: Number(adultAge),
            ageGroups: groups.map((g) => ({ name: g.name, minAge: Number(g.minAge), maxAge: Number(g.maxAge) })),
          },
        }),
      );
      setSaved(true);
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="xl:col-span-2">
      <form onSubmit={handleSubmit}>
        <fieldset disabled={!canEdit} className="space-y-5">
          <div>
            <h2 className="font-bold text-white">Saída segura</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Passam a valer quando o check-out das crianças for ativado, na próxima etapa.
            </p>
          </div>
          <div className="space-y-3">
            <Toggle checked={checkoutRequired} onChange={setCheckoutRequired}>
              Registrar a saída de cada criança e quem a retirou
            </Toggle>
            <Toggle checked={pickupListOnly} onChange={setPickupListOnly}>
              Só responsáveis e pessoas da lista de retirada podem levar a criança
            </Toggle>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Alerta de atraso" hint="Minutos após o fim da aula">
              <input
                type="number"
                min={5}
                max={240}
                value={latePickupMinutes}
                onChange={(e) => setLatePickupMinutes(e.target.value)}
              />
            </Field>
            <Field label="Documentos pendentes">
              <select value={policy} onChange={(e) => setPolicy(e.target.value as 'WARN' | 'BLOCK')}>
                <option value="WARN">Avisar a equipe</option>
                <option value="BLOCK">Não liberar o treino</option>
              </select>
            </Field>
            <Field label="Idade adulta" hint="A partir dela, sai do programa">
              <input type="number" min={12} max={18} value={adultAge} onChange={(e) => setAdultAge(e.target.value)} />
            </Field>
          </div>

          <div>
            <h2 className="font-bold text-white">Turmas por idade</h2>
            <p className="text-sm text-zinc-500 mt-0.5 mb-3">Cada criança aparece no grupo da sua idade.</p>
            <div className="space-y-2">
              {groups.map((group, index) => (
                <div key={index} className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2 items-center">
                  <input
                    aria-label="Nome do grupo"
                    value={group.name}
                    onChange={(e) => updateGroup(index, { name: e.target.value })}
                  />
                  <input
                    aria-label="Idade mínima"
                    type="number"
                    value={group.minAge}
                    onChange={(e) => updateGroup(index, { minAge: e.target.value })}
                  />
                  <input
                    aria-label="Idade máxima"
                    type="number"
                    value={group.maxAge}
                    onChange={(e) => updateGroup(index, { maxAge: e.target.value })}
                  />
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label={`Remover ${group.name}`}
                      className="p-2 text-zinc-500 hover:text-accent-soft"
                      onClick={() => setGroups((previous) => previous.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              {groups.length === 0 && <p className="text-sm text-zinc-500">Nenhum grupo.</p>}
            </div>
            {canEdit && groups.length < 10 && (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-soft hover:underline"
                onClick={() => setGroups((previous) => [...previous, { name: '', minAge: '', maxAge: '' }])}
              >
                <Plus size={14} /> Adicionar grupo
              </button>
            )}
          </div>
        </fieldset>
        {canEdit && (
          <div className="flex items-center gap-3 mt-5">
            <Button type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar regras'}
            </Button>
            {saved && <span className="text-sm text-ok">Salvo.</span>}
          </div>
        )}
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}

function Toggle({
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

function DocumentsCard({
  data,
  canEdit,
  onSaved,
}: {
  data: KidsSettingsResponse;
  canEdit: boolean;
  onSaved: (data: KidsSettingsResponse) => void;
}) {
  const [editing, setEditing] = useState<DocumentTypeDto | 'new' | null>(null);
  const [error, setError] = useState('');

  async function remove(type: DocumentTypeDto) {
    if (!window.confirm(`Deixar de exigir "${type.name}"? Os registros já feitos continuam guardados.`)) return;
    setError('');
    try {
      onSaved(await api<KidsSettingsResponse>(`/crm/kids/document-types/${type.id}`, { method: 'DELETE' }));
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao remover.');
    }
  }

  return (
    <Card className="xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-white">Documentos</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            O que a família assina na matrícula. A equipe registra cada assinatura no perfil da criança.
          </p>
        </div>
        {canEdit && (
          <Button variant="ghost" onClick={() => setEditing('new')}>
            <span className="inline-flex items-center gap-2">
              <Plus size={14} /> Novo documento
            </span>
          </Button>
        )}
      </div>
      {data.documentTypes.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum documento configurado.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {data.documentTypes.map((type) => (
            <li
              key={type.id}
              className="flex items-start justify-between gap-3 bg-panel2 border border-edge rounded-xl px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{type.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {DOCUMENT_KINDS[type.kind]} ·{' '}
                  {type.renewalMonths ? `renovar a cada ${type.renewalMonths} meses` : 'não vence'}
                </p>
                <div className="mt-1.5">
                  {type.required ? <Badge tone="amber">Obrigatório</Badge> : <Badge tone="gray">Opcional</Badge>}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-1 shrink-0">
                  <button className="text-xs font-semibold text-zinc-400 hover:text-white" onClick={() => setEditing(type)}>
                    Editar
                  </button>
                  <button
                    aria-label={`Remover ${type.name}`}
                    className="p-1 text-zinc-500 hover:text-accent-soft"
                    onClick={() => remove(type)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorText>{error}</ErrorText>
      {editing && (
        <DocumentTypeModal
          type={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            onSaved(saved);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

function DocumentTypeModal({
  type,
  onClose,
  onSaved,
}: {
  type: DocumentTypeDto | null;
  onClose: () => void;
  onSaved: (data: KidsSettingsResponse) => void;
}) {
  const [name, setName] = useState(type?.name ?? '');
  const [kind, setKind] = useState<DocumentKind>(type?.kind ?? 'OTHER');
  const [required, setRequired] = useState(type?.required ?? true);
  const [renewalMonths, setRenewalMonths] = useState(type?.renewalMonths ? String(type.renewalMonths) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { name, kind, required, renewalMonths: renewalMonths ? Number(renewalMonths) : null };
      onSaved(
        await api<KidsSettingsResponse>(type ? `/crm/kids/document-types/${type.id}` : '/crm/kids/document-types', {
          method: type ? 'PUT' : 'POST',
          body,
        }),
      );
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={type ? 'Editar documento' : 'Novo documento'} open onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Tipo">
          <select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
            {Object.entries(DOCUMENT_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Renovação" hint="Em meses. Deixe vazio se não vence.">
          <input
            type="number"
            min={1}
            max={60}
            value={renewalMonths}
            onChange={(e) => setRenewalMonths(e.target.value)}
          />
        </Field>
        <Toggle checked={required} onChange={setRequired}>
          Obrigatório para todas as crianças
        </Toggle>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </Modal>
  );
}
