import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Fingerprint, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, API_BASE, ApiError } from '../lib/api';
import { dateTime } from '../lib/format';
import { useDevices, useGym } from '../lib/hooks';
import type { BridgeResponse, DeviceResponse, DeviceWithKeyResponse } from '../lib/types';
import BridgesSection from './BridgesSection';
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
  FACE: 'Leitor facial',
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
  const [linking, setLinking] = useState<DeviceResponse | null>(null);
  const bridges = useQuery<BridgeResponse[], ApiError>({
    queryKey: ['bridges'],
    queryFn: () => api<BridgeResponse[]>('/crm/bridges'),
  });
  const bridgeName = (id: number | null) =>
    (bridges.data ?? []).find((b) => b.id === id)?.name ?? 'Sem bridge';

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
                  <td className="py-3 text-zinc-400">
                    {device.location ?? '—'}
                    {device.lanHost && (
                      <p className="text-xs text-zinc-500">
                        {bridgeName(device.bridgeId)} · {device.lanHost}
                      </p>
                    )}
                  </td>
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
                            onClick={() => setLinking(device)}
                          >
                            Conectar
                          </button>
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

      <BridgesSection isOwner={isOwner} />

      <LinkDeviceModal
        device={linking}
        bridges={(bridges.data ?? []).filter((b) => b.active)}
        onClose={() => setLinking(null)}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ['devices'] });
          setLinking(null);
        }}
      />

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
            {isControlId(issuedKey.device.provider) && <ControlIdSetup apiKey={issuedKey.apiKey} />}
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
              list="device-providers"
            />
            <datalist id="device-providers">
              <option value="Control iD" />
            </datalist>
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

function isControlId(provider: string | null | undefined) {
  return /control\s*-?\s*id/i.test(provider ?? '');
}

/** What to type in the Control iD web interface (Monitor) so it reports to us. */
function ControlIdSetup({ apiKey }: { apiKey: string }) {
  const server = new URL(API_BASE, window.location.href);
  const https = server.protocol === 'https:';
  const port = server.port || (https ? '443' : '80');
  const apiPath = server.pathname.replace(/^\/+|\/+$/g, '');
  const rows: [string, string][] = [
    ['Servidor (hostname)', server.hostname],
    ['Porta', port],
    ['Caminho (path)', `${apiPath}/access/vendors/controlid/${apiKey}`],
  ];
  return (
    <div className="space-y-3 text-sm">
      <p className="text-zinc-400">
        No aparelho Control iD, ative o <b className="text-white">Monitor</b> e preencha:
      </p>
      <div className="bg-panel2 border border-edge rounded-xl divide-y divide-edge/60">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center gap-3 px-3 py-2">
            <span className="w-36 shrink-0 text-xs text-zinc-500">{label}</span>
            <code className="flex-1 font-mono text-ok break-all">{value}</code>
            <button
              className="text-zinc-400 hover:text-white shrink-0"
              title="Copiar"
              onClick={() => navigator.clipboard.writeText(value)}
            >
              <Copy size={14} />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Cadastre cada aluno no aparelho usando o ID dele no BJJ Flow — ou deixe como está: a
        primeira passagem de cada aluno cai na fila de revisão em Frequência e, ao vincular, o
        sistema aprende o ID do aparelho para as próximas.
      </p>
      {https && (
        <p className="text-xs text-warn">
          O servidor só aceita HTTPS. Se o modelo do aparelho não permitir HTTPS no Monitor, ele
          precisará do BJJ Flow Bridge instalado no computador da recepção.
        </p>
      )}
    </div>
  );
}

/** Which bridge reaches the device, and the device's IP on the gym's network. */
function LinkDeviceModal({
  device,
  bridges,
  onClose,
  onSaved,
}: {
  device: DeviceResponse | null;
  bridges: BridgeResponse[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [bridgeId, setBridgeId] = useState('');
  const [lanHost, setLanHost] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<number | null>(null);
  if (device && openedFor !== device.id) {
    setOpenedFor(device.id);
    setBridgeId(device.bridgeId ? String(device.bridgeId) : bridges[0] ? String(bridges[0].id) : '');
    setLanHost(device.lanHost ?? '');
    setError('');
  }
  if (!device && openedFor !== null) setOpenedFor(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!device) return;
    setError('');
    setBusy(true);
    try {
      await api(`/crm/devices/${device.id}`, {
        method: 'PUT',
        body: { bridgeId: bridgeId ? Number(bridgeId) : 0, lanHost },
      });
      await onSaved();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Conectar ${device?.name ?? ''}`} open={device !== null} onClose={onClose}>
      {bridges.length === 0 ? (
        <p className="text-sm text-zinc-400">
          Registre e instale uma bridge primeiro (seção Bridges, abaixo). Ela é quem fala com o aparelho
          na rede da academia.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-zinc-400">
            Necessário para cadastrar alunos no aparelho pelo CRM. O IP também precisa estar em{' '}
            <code className="text-accent-soft">devices</code> no config.json da bridge.
          </p>
          <Field label="Bridge">
            <select value={bridgeId} onChange={(event) => setBridgeId(event.target.value)}>
              {bridges.map((bridge) => (
                <option key={bridge.id} value={bridge.id}>
                  {bridge.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="IP do aparelho na rede da academia">
            <input
              required
              maxLength={100}
              value={lanHost}
              onChange={(event) => setLanHost(event.target.value)}
              placeholder="Ex.: 192.168.0.50"
              pattern="[A-Za-z0-9.\-]+(:[0-9]{1,5})?"
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
