import { useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useGym } from '../lib/hooks';
import type { GymDto } from '../lib/types';
import { Button, Card, ErrorText, Field, Loading, PageHeader } from '../components/ui';

export default function SettingsPage() {
  const gym = useGym();
  const queryClient = useQueryClient();
  const isOwner = gym.data?.role === 'OWNER';

  const [form, setForm] = useState({
    name: '',
    city: '',
    description: '',
    graduationTarget: '40',
    phone: '',
    email: '',
    website: '',
    address: '',
    instagram: '',
    facebook: '',
    whatsapp: '',
    youtube: '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (gym.data) {
      setForm({
        name: gym.data.name ?? '',
        city: gym.data.city ?? '',
        description: gym.data.description ?? '',
        graduationTarget: String(gym.data.graduationTarget ?? 40),
        phone: gym.data.phone ?? '',
        email: gym.data.email ?? '',
        website: gym.data.website ?? '',
        address: gym.data.address ?? '',
        instagram: gym.data.instagram ?? '',
        facebook: gym.data.facebook ?? '',
        whatsapp: gym.data.whatsapp ?? '',
        youtube: gym.data.youtube ?? '',
      });
    }
  }, [gym.data]);

  function set(key: keyof typeof form) {
    return (event: { target: { value: string } }) => {
      setSaved(false);
      setForm((previous) => ({ ...previous, [key]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api<GymDto>('/crm/gym', {
        method: 'PUT',
        body: {
          name: form.name,
          city: form.city || null,
          description: form.description || null,
          graduationTarget: Number(form.graduationTarget) || undefined,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          address: form.address || null,
          instagram: form.instagram || null,
          facebook: form.facebook || null,
          whatsapp: form.whatsapp || null,
          youtube: form.youtube || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['gym'] });
      setSaved(true);
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  if (gym.isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Configurações da academia"
        subtitle="Estes dados são os mesmos exibidos no aplicativo BJJ Flow — alterações aqui aparecem lá na hora."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <form onSubmit={handleSubmit} className="xl:col-span-2 space-y-4">
          <Card className="space-y-4">
            <h2 className="font-bold text-white">Informações básicas</h2>
            <Field label="Nome da academia">
              <input required maxLength={150} value={form.name} onChange={set('name')} disabled={!isOwner} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade">
                <input maxLength={100} value={form.city} onChange={set('city')} disabled={!isOwner} />
              </Field>
              <Field label="Meta de graduação (aulas)">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={form.graduationTarget}
                  onChange={set('graduationTarget')}
                  disabled={!isOwner}
                />
              </Field>
            </div>
            <Field label="Descrição">
              <textarea
                rows={3}
                maxLength={500}
                value={form.description}
                onChange={set('description')}
                disabled={!isOwner}
              />
            </Field>
            <Field label="Endereço">
              <input maxLength={255} value={form.address} onChange={set('address')} disabled={!isOwner} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-bold text-white">Contato e redes sociais</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone">
                <input maxLength={30} value={form.phone} onChange={set('phone')} disabled={!isOwner} />
              </Field>
              <Field label="E-mail">
                <input maxLength={255} value={form.email} onChange={set('email')} disabled={!isOwner} />
              </Field>
              <Field label="Site">
                <input maxLength={255} value={form.website} onChange={set('website')} disabled={!isOwner} />
              </Field>
              <Field label="WhatsApp">
                <input maxLength={50} value={form.whatsapp} onChange={set('whatsapp')} disabled={!isOwner} />
              </Field>
              <Field label="Instagram">
                <input maxLength={255} value={form.instagram} onChange={set('instagram')} disabled={!isOwner} />
              </Field>
              <Field label="Facebook">
                <input maxLength={255} value={form.facebook} onChange={set('facebook')} disabled={!isOwner} />
              </Field>
              <Field label="YouTube">
                <input maxLength={255} value={form.youtube} onChange={set('youtube')} disabled={!isOwner} />
              </Field>
            </div>
          </Card>

          <ErrorText>{error}</ErrorText>
          {saved && (
            <p className="text-sm text-ok bg-ok/10 border border-ok/30 rounded-lg px-3 py-2">
              Configurações salvas — já visíveis no aplicativo.
            </p>
          )}
          {isOwner ? (
            <Button type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar configurações'}
            </Button>
          ) : (
            <p className="text-sm text-zinc-500">
              Somente o proprietário pode editar as configurações.
            </p>
          )}
        </form>

        <div className="space-y-4">
          <Card>
            <h2 className="font-bold text-white mb-2">Código de convite</h2>
            <p className="text-sm text-zinc-400 mb-3">
              Alunos entram na academia digitando este código no aplicativo BJJ Flow.
            </p>
            {gym.data?.inviteCode ? (
              <div className="flex items-center gap-2 bg-panel2 border border-edge rounded-xl p-3">
                <code className="text-lg font-mono font-bold text-accent-soft tracking-widest flex-1">
                  {gym.data.inviteCode}
                </code>
                <button
                  className="text-zinc-400 hover:text-white"
                  title="Copiar"
                  onClick={() => {
                    navigator.clipboard.writeText(gym.data?.inviteCode ?? '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  <Copy size={16} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Disponível apenas para a equipe.</p>
            )}
            {copied && <p className="text-xs text-ok mt-2">Copiado!</p>}
          </Card>

          <Card>
            <h2 className="font-bold text-white mb-2">Resumo</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Membros</dt>
                <dd className="text-white font-semibold">{gym.data?.memberCount ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Verificada</dt>
                <dd className="text-white font-semibold">{gym.data?.verified ? 'Sim' : 'Não'}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
