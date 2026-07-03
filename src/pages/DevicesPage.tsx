import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Fingerprint, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { dateTime } from '../lib/format';
import { useDevices, useGym } from '../lib/hooks';
import type { DeviceWithKeyResponse } from '../lib/types';
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

const DEVICE_TYPES: Record<string, string> = {
  CARD: 'Leitor de cartão',
  FINGERPRINT: 'Leitor biométrico',
  TURNSTILE: 'Catraca',
  QR: 'Leitor de QR Code',
  GENERIC: 'Outro',
};

export default function DevicesPage() {
  const devices = useDevices();
  const gym = useGym();
  const queryClient = useQueryClient();
  const isOwner = gym.data?.role === 'OWNER';

  const [registerModal, setRegisterModal] = useState(false);
  const [issuedKey, setIssuedKey] = useState<DeviceWithKeyResponse | null>(null);

  const rotate = useMutation({
    mutationFn: (deviceId: number) =>
      api<DeviceWithKeyResponse>(`/crm/devices/${deviceId}/rotate-key`, { method: 'POST' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIssuedKey(result);
    },
  });

  const deactivate = useMutation({
    mutationFn: (deviceId: number) =>
      api(`/crm/devices/${deviceId}/deactivate`, { method: 'PUT' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  if (devices.isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Dispositivos de acesso"
        subtitle="Catracas, leitores de cartão e biometria que registram presença automaticamente."
        actions={
          isOwner && (
            <Button onClick={() => setRegisterModal(true)}>
              <span className="inline-flex items-center gap-2">
                <Plus size={15} />
                Registrar dispositivo
              </span>
            </Button>
          )
        }
      />

      <Card className="mb-4 !py-4 text-sm text-zinc-400">
        <p>
          Cada dispositivo autentica com sua chave de API no endpoint{' '}
          <code className="text-accent-soft bg-panel2 px-1.5 py-0.5 rounded">
            POST /api/v1/access/hardware/events
          </code>{' '}
          (header <code className="text-accent-soft bg-panel2 px-1.5 py-0.5 rounded">X-Device-Key</code>).
          As escaneadas viram presença quando batem com uma turma; casos duvidosos vão para a fila
          de revisão em Frequência.
        </p>
      </Card>

      <Card>
        {(devices.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhum dispositivo registrado"
            description="Registre a catraca ou o leitor da recepção para começar a captar presenças."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-edge">
                <th className="py-2 font-semibold">Dispositivo</th>
                <th className="py-2 font-semibold">Tipo</th>
                <th className="py-2 font-semibold">Local</th>
                <th className="py-2 font-semibold">Última atividade</th>
                <th className="py-2 font-semibold">Status</th>
                {isOwner && <th className="py-2 font-semibold text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {(devices.data ?? []).map((device) => (
                <tr key={device.id} className="border-b border-edge/60 last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 rounded-lg bg-panel2 text-zinc-400">
                        <Fingerprint size={15} />
                      </span>
                      <div>
                        <p className="font-semibold text-white">{device.name}</p>
                        {device.provider && (
                          <p className="text-xs text-zinc-500">{device.provider}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-zinc-400">
                    {DEVICE_TYPES[device.type] ?? device.type}
                  </td>
                  <td className="py-3 text-zinc-400">{device.location ?? '—'}</td>
                  <td className="py-3 text-zinc-400">
                    {device.lastSeenAt ? dateTime(device.lastSeenAt) : 'Nunca conectado'}
                  </td>
                  <td className="py-3">
                    <Badge tone={device.active ? 'green' : 'gray'}>
                      {device.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  {isOwner && (
                    <td className="py-3 text-right space-x-3 whitespace-nowrap">
                      {device.active && (
                        <>
                          <button
                            className="text-xs font-semibold text-accent-soft hover:underline"
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Gerar nova chave? A chave atual deixará de funcionar imediatamente.',
                                )
                              ) {
                                rotate.mutate(device.id);
                              }
                            }}
                          >
                            Trocar chave
                          </button>
                          <button
                            className="text-xs font-semibold text-zinc-400 hover:text-accent-soft"
                            onClick={() => {
                              if (window.confirm('Desativar este dispositivo?')) {
                                deactivate.mutate(device.id);
                              }
                            }}
                          >
                            Desativar
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <RegisterDeviceModal
        open={registerModal}
        onClose={() => setRegisterModal(false)}
        onRegistered={async (result) => {
          await queryClient.invalidateQueries({ queryKey: ['devices'] });
          setRegisterModal(false);
          setIssuedKey(result);
        }}
      />

      <Modal
        title="Chave de API do dispositivo"
        open={issuedKey !== null}
        onClose={() => setIssuedKey(null)}
      >
        {issuedKey && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Configure esta chave no dispositivo <b className="text-white">{issuedKey.device.name}</b>.
              Ela é exibida <b className="text-accent-soft">apenas uma vez</b> — o servidor guarda
              somente uma versão criptografada.
            </p>
            <div className="flex items-center gap-2 bg-panel2 border border-edge rounded-xl p-3">
              <code className="text-sm text-ok font-mono break-all flex-1">
                {issuedKey.apiKey}
              </code>
              <button
                className="text-zinc-400 hover:text-white shrink-0"
                title="Copiar"
                onClick={() => navigator.clipboard.writeText(issuedKey.apiKey)}
              >
                <Copy size={16} />
              </button>
            </div>
            <Button className="w-full" onClick={() => setIssuedKey(null)}>
              Salvei a chave em local seguro
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function RegisterDeviceModal({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: (result: DeviceWithKeyResponse) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('TURNSTILE');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api<DeviceWithKeyResponse>('/crm/devices', {
        method: 'POST',
        body: {
          name,
          type,
          provider: provider || undefined,
          location: location || undefined,
        },
      });
      await onRegistered(result);
      setName('');
      setProvider('');
      setLocation('');
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao registrar dispositivo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Registrar dispositivo" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Catraca da entrada"
          />
        </Field>
        <Field label="Tipo">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {Object.entries(DEVICE_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fabricante (opcional)">
            <input
              maxLength={100}
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="Ex.: Control iD"
            />
          </Field>
          <Field label="Local (opcional)">
            <input
              maxLength={150}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ex.: Recepção"
            />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Registrando…' : 'Registrar e gerar chave'}
        </Button>
      </form>
    </Modal>
  );
}
