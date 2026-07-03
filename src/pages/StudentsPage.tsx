import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GYM_ROLES } from '../lib/format';
import { useMembers } from '../lib/hooks';
import { Badge, BeltChip, Card, EmptyState, Loading, PageHeader } from '../components/ui';

export default function StudentsPage() {
  const members = useMembers();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const all = members.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((member) => member.displayName.toLowerCase().includes(term));
  }, [members.data, search]);

  if (members.isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Alunos"
        subtitle={`${members.data?.length ?? 0} membro(s) na academia — dados compartilhados com o aplicativo.`}
      />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          className="!pl-9"
          placeholder="Buscar aluno…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhum aluno encontrado"
            description="Alunos entram na academia pelo aplicativo usando o código de convite (veja em Configurações)."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-edge">
                <th className="py-2 font-semibold">Nome</th>
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
                  <td className="py-3 font-semibold text-white">{member.displayName}</td>
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
    </div>
  );
}
