import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Router } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, API_BASE, ApiError } from '../lib/api';
import { dateTime } from '../lib/format';
import type { BridgeCommandResponse, BridgeResponse, BridgeWithKeyResponse } from '../lib/types';
import { Badge, Button, Card, ErrorText, Field, Modal } from '../components/ui';

/**
 * The gym's BJJ Flow Bridge installs: the small app on the front-desk PC that
 * relays device notifications (with an offline queue) and runs device commands.
 */
export default function BridgesSection({ isOwner }: { isOwner: boolean }) {
  const queryClient = useQueryClient();
  const bridges = useQuery<BridgeResponse[], ApiError>({
    queryKey: ['bridges'],
    queryFn: () => api<BridgeResponse[]>('/crm/bridges'),
    refetchInterval: 15000,
  });
  const [registerOpen, setRegisterOpen] = useState(false);
  const [issued, setIssued] = useState<BridgeWithKeyResponse | null>(null);
  const [testing, setTesting] = useState<BridgeResponse | null>(null);

  const rotate = useMutation({
    mutationFn: (id: number) => api<BridgeWithKeyResponse>(`/crm/bridges/${id}/rotate-key`, { method: 'POST' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['bridges'] });
      setIssued(result);
    },
  });
  const deactivate = useMutation({
    mutationFn: (id: number) => api(`/crm/bridges/${id}/deactivate`, { method: 'PUT' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bridges'] }),
  });

  const list = bridges.data ?? [];

  return (
    <Card className="mt-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-white font-semibold">Bridges</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Programa instalado no computador da recepção. Recebe as passagens dos aparelhos pela rede
            da academia, guarda se a internet cair e envia ao BJJ Flow.
          </p>
        </div>
        {isOwner && (
          <Button variant="ghost" onClick={() => setRegisterOpen(true)} className="shrink-0">
            <span className="inline-flex items-center gap-2">
              <Plus size={15} />
              Registrar bridge
            </span>
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-zinc-500 py-2">
          Nenhuma bridge registrada. Só é necessária se os aparelhos não acessam a internet sozinhos
          ou não suportam HTTPS.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-edge">
              <th className="py-2 font-semibold">Bridge</th>
              <th className="py-2 font-semibold">Última conexão</th>
              <th className="py-2 font-semibold">Na fila</th>
              <th className="py-2 font-semibold">Status</th>
              <th className="py-2 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((bridge) => (
              <tr key={bridge.id} className="border-b border-edge/60 last:border-0">
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-panel2 text-zinc-400">
                      <Router size={15} />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{bridge.name}</p>
                      {bridge.version && <p className="text-xs text-zinc-500">v{bridge.version}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 text-zinc-400">
                  {bridge.lastSeenAt ? dateTime(bridge.lastSeenAt) : 'Nunca conectada'}
                </td>
                <td className="py-3 text-zinc-400">{bridge.queueDepth ?? '—'}</td>
                <td className="py-3">
                  {!bridge.active ? (
                    <Badge tone="gray">Inativa</Badge>
                  ) : bridge.online ? (
                    <Badge tone="green">Online</Badge>
                  ) : (
                    <Badge tone="amber">Offline</Badge>
                  )}
                </td>
                <td className="py-3 text-right space-x-3 whitespace-nowrap">
                  {bridge.active && (
                    <button
                      className="text-xs font-semibold text-accent-soft hover:underline"
                      onClick={() => setTesting(bridge)}
                    >
                      Testar conexão
                    </button>
                  )}
                  {isOwner && bridge.active && (
                    <>
                      <button
                        className="text-xs font-semibold text-accent-soft hover:underline"
                        onClick={() => {
                          if (window.confirm('Gerar nova chave? A bridge para até receber a nova chave.')) {
                            rotate.mutate(bridge.id);
                          }
                        }}
                      >
                        Trocar chave
                      </button>
                      <button
                        className="text-xs font-semibold text-zinc-400 hover:text-accent-soft"
                        onClick={() => {
                          if (window.confirm('Desativar esta bridge?')) deactivate.mutate(bridge.id);
                        }}
                      >
                        Desativar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <RegisterBridgeModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegistered={async (result) => {
          await queryClient.invalidateQueries({ queryKey: ['bridges'] });
          setRegisterOpen(false);
          setIssued(result);
        }}
      />

      <Modal title="Chave da bridge" open={issued !== null} onClose={() => setIssued(null)}>
        {issued && <BridgeSetup issued={issued} onDone={() => setIssued(null)} />}
      </Modal>

      <Modal title="Testar conexão" open={testing !== null} onClose={() => setTesting(null)}>
        {testing && <PingPanel bridge={testing} />}
      </Modal>
    </Card>
  );
}

function RegisterBridgeModal({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: (result: BridgeWithKeyResponse) => Promise<void>;
}) {
  const [name, setName] = useState('Computador da recepção');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onRegistered(await api<BridgeWithKeyResponse>('/crm/bridges', { method: 'POST', body: { name } }));
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao registrar bridge.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Registrar bridge" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Registrando…' : 'Registrar e gerar chave'}
        </Button>
      </form>
    </Modal>
  );
}

/** The key (shown once) and the config.json to paste on the front-desk PC. */
function BridgeSetup({ issued, onDone }: { issued: BridgeWithKeyResponse; onDone: () => void }) {
  const server = new URL(API_BASE, window.location.href).toString().replace(/\/+$/, '');
  const config = JSON.stringify(
    { server, bridgeKey: issued.apiKey, listenPort: 8085, allowedDeviceHosts: [], dataDir: 'data' },
    null,
    2,
  );
  return (
    <div className="space-y-4 text-sm">
      <p className="text-zinc-400">
        A chave da bridge <b className="text-white">{issued.bridge.name}</b> é exibida{' '}
        <b className="text-accent-soft">apenas uma vez</b>. No computador da recepção, salve isto como{' '}
        <code className="text-accent-soft">config.json</code> na pasta da bridge e coloque o IP de cada
        aparelho em <code className="text-accent-soft">allowedDeviceHosts</code>:
      </p>
      <div className="relative">
        <pre className="bg-panel2 border border-edge rounded-xl p-3 text-xs text-ok font-mono overflow-x-auto">
          {config}
        </pre>
        <button
          className="absolute top-2 right-2 text-zinc-400 hover:text-white"
          title="Copiar"
          onClick={() => navigator.clipboard.writeText(config)}
        >
          <Copy size={14} />
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Depois rode <code>install-windows.ps1</code> como Administrador (veja o README da bridge). Nos
        aparelhos, use o IP do computador e a porta 8085 no lugar do servidor do BJJ Flow, com o mesmo
        caminho.
      </p>
      <Button className="w-full" onClick={onDone}>
        Salvei a configuração
      </Button>
    </div>
  );
}

/** Queues a PING and follows it until the bridge answers. */
function PingPanel({ bridge }: { bridge: BridgeResponse }) {
  const [sentId, setSentId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const commands = useQuery<BridgeCommandResponse[], ApiError>({
    queryKey: ['bridge-commands', bridge.id],
    queryFn: () => api<BridgeCommandResponse[]>(`/crm/bridges/${bridge.id}/commands`),
    enabled: sentId !== null,
    refetchInterval: (query) => {
      const sent = query.state.data?.find((c) => c.id === sentId);
      return sent && (sent.status === 'DONE' || sent.status === 'FAILED') ? false : 1500;
    },
  });
  const sent = commands.data?.find((c) => c.id === sentId);

  async function ping() {
    setError('');
    try {
      const command = await api<BridgeCommandResponse>(`/crm/bridges/${bridge.id}/ping`, { method: 'POST' });
      setSentId(command.id);
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao enviar teste.');
    }
  }

  const status = sent?.status ?? (sentId ? 'PENDING' : null);
  return (
    <div className="space-y-4 text-sm">
      <p className="text-zinc-400">
        Envia um teste para <b className="text-white">{bridge.name}</b> e espera a resposta. A bridge
        confere a cada 5 segundos.
      </p>
      {status && (
        <div className="bg-panel2 border border-edge rounded-xl p-3 flex items-center justify-between gap-3">
          <span className="text-zinc-300">
            {status === 'DONE'
              ? sent?.result
              : status === 'FAILED'
                ? sent?.result ?? 'Falhou'
                : status === 'SENT'
                  ? 'Recebido pela bridge…'
                  : 'Aguardando a bridge…'}
          </span>
          <Badge tone={status === 'DONE' ? 'green' : status === 'FAILED' ? 'red' : 'amber'}>
            {status === 'DONE' ? 'OK' : status === 'FAILED' ? 'Falhou' : 'Aguardando'}
          </Badge>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      <Button className="w-full" onClick={ping} disabled={status === 'PENDING' || status === 'SENT'}>
        {sentId ? 'Testar de novo' : 'Enviar teste'}
      </Button>
    </div>
  );
}
