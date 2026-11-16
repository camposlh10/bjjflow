import { useQueryClient } from '@tanstack/react-query';
import { Baby, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GuardianFields, type GuardianForm } from './FamilyCard';
import { api, ApiError } from '../lib/api';
import { GYM_ROLES, todayIso } from '../lib/format';
import { useMembers } from '../lib/hooks';
import type { FamilyResponse, MemberResponse } from '../lib/types';
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
} from '../components/ui';

type Filter = 'all' | 'kids' | 'adults';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'kids', label: 'Kids' },
  { value: 'adults', label: 'Adultos' },
];

export default function StudentsPage() {
  const members = useMembers();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [addChild, setAddChild] = useState(false);
  const filter = (FILTERS.some((f) => f.value === params.get('filtro')) ? params.get('filtro') : 'all') as Filter;

  const all = members.data ?? [];
  const kidsCount = all.filter((member) => member.kid).length;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((member) => (filter === 'kids' ? member.kid : filter === 'adults' ? !member.kid : true))
      .filter((member) => !term || member.displayName.toLowerCase().includes(term));
  }, [all, search, filter]);

  if (members.isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Alunos"
        subtitle={`${all.length} membro(s) na academia, ${kidsCount} criança(s) — dados compartilhados com o aplicativo.`}
        actions={
          <Button onClick={() => setAddChild(true)}>
            <span className="inline-flex items-center gap-2">
              <Baby size={15} /> Cadastrar criança
            </span>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="!pl-9"
            placeholder="Buscar aluno…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex rounded-lg border border-edge overflow-hidden" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setParams(f.value === 'all' ? {} : { filtro: f.value })}
              className={`px-3 py-2 text-sm font-semibold ${
                filter === f.value ? 'bg-accent/15 text-accent-soft' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={filter === 'kids' ? 'Nenhuma criança' : 'Nenhum aluno encontrado'}
            description={
              filter === 'kids'
                ? 'Cadastre crianças que não têm conta própria com o botão "Cadastrar criança".'
                : 'Alunos entram na academia pelo aplicativo usando o código de convite (veja em Configurações).'
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-edge">
                <th className="py-2 font-semibold">Nome</th>
                <th className="py-2 font-semibold">Idade</th>
                <th className="py-2 font-semibold">Faixa</th>
                <th className="py-2 font-semibold">Função</th>
                <th className="py-2 font-semibold text-right">Aulas desde a última graduação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr
                  key={member.userId}
                  className="border-b border-edge/60 last:border-0 cursor-pointer hover:bg-panel2/60"
                  onClick={() => navigate(`/alunos/${member.userId}`)}
                >
                  <td className="py-3 font-semibold text-white">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {member.displayName}
                      <MemberBadges member={member} />
                    </span>
                  </td>
                  <td className="py-3 text-zinc-300">{member.age ?? '—'}</td>
                  <td className="py-3">
                    <BeltChip belt={member.belt} />
                  </td>
                  <td className="py-3">
                    <Badge tone={member.role === 'OWNER' ? 'red' : member.role === 'INSTRUCTOR' ? 'blue' : 'gray'}>
                      {GYM_ROLES[member.role]}
                    </Badge>
                  </td>
                  <td className="py-3 text-right text-zinc-300">{member.classesAttended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {addChild && (
        <AddChildModal
          onClose={() => setAddChild(false)}
          onCreated={(child) => navigate(`/alunos/${child.userId}`)}
        />
      )}
    </div>
  );
}

function MemberBadges({ member }: { member: MemberResponse }) {
  return (
    <>
      {member.kid && <Badge tone="blue">Kids</Badge>}
      {member.noGuardian && <Badge tone="amber">Sem responsável</Badge>}
      {member.missingDocuments > 0 && (
        <Badge tone="amber">
          {member.missingDocuments} doc. pendente{member.missingDocuments > 1 ? 's' : ''}
        </Badge>
      )}
      {member.delinquent && <Badge tone="red">Inadimplente</Badge>}
    </>
  );
}

function AddChildModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (child: FamilyResponse) => void;
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [guardian, setGuardian] = useState<GuardianForm>({ name: '', relationship: 'MOTHER', phone: '', email: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const child = await api<FamilyResponse>('/crm/kids/children', {
        method: 'POST',
        body: { firstName, lastName, birthDate, guardian },
      });
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      void queryClient.invalidateQueries({ queryKey: ['kids-settings'] });
      queryClient.setQueryData(['family', String(child.userId)], child);
      onCreated(child);
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao cadastrar.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Cadastrar criança" open onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-zinc-400">
          Para crianças sem conta própria no aplicativo. A academia cuida do perfil, e o responsável acompanha pelo
          app dele com um código que geramos agora.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_10rem] gap-3">
          <Field label="Nome">
            <input required maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Sobrenome">
            <input required maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Nascimento">
            <input type="date" required max={todayIso()} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide pt-2">Responsável</p>
        <GuardianFields value={guardian} onChange={setGuardian} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Cadastrando…' : 'Cadastrar'}
        </Button>
      </form>
    </Modal>
  );
}
