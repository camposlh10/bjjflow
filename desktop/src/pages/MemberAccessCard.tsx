import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanFace, CreditCard, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { dateTime } from '../lib/format';
import { useDevices } from '../lib/hooks';
import type { EnrollmentResponse, MemberAccessResponse } from '../lib/types';
import { Badge, Button, Card, ErrorText, Field, Modal } from '../components/ui';

const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'gray' }> = {
  PENDING: { label: 'Aguardando no aparelho', tone: 'amber' },
  ENROLLED: { label: 'Cadastrado', tone: 'green' },
  FAILED: { label: 'Falhou', tone: 'red' },
  REMOVING: { label: 'Removendo', tone: 'amber' },
  REMOVED: { label: 'Removido', tone: 'gray' },
};

/**
 * The member's access by face or card: LGPD consent for the face, and their
 * registrations on the gym's devices (sent through the bridge).
 */
export default function MemberAccessCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const key = ['member-access', userId];
  const access = useQuery<MemberAccessResponse, ApiError>({
    queryKey: key,
    queryFn: () => api<MemberAccessResponse>(`/crm/members/${userId}/access`),
    // Follow registrations while the device works on them.
    refetchInterval: (query) =>
      query.state.data?.enrollments.some((e) => e.status === 'PENDING' || e.status === 'REMOVING') ? 2000 : false,
  });
  const [consentOpen, setConsentOpen] = useState(false);
  const [enrollMethod, setEnrollMethod] = useState<'FACE' | 'CARD' | null>(null);
  const [error, setError] = useState('');

  const refresh = (data: MemberAccessResponse) => queryClient.setQueryData(key, data);
  const revoke = useMutation({
    mutationFn: () => api<MemberAccessResponse>(`/crm/members/${userId}/access/face-consent`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Erro ao revogar.'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/crm/members/${userId}/access/enrollments/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Erro ao remover.'),
  });

  const data = access.data;
  const consent = data?.faceConsent;
  const visible = (data?.enrollments ?? []).filter((e) => e.status !== 'REMOVED');

  return (
    <Card className="xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="min-w-[16rem] flex-1">
          <h2 className="font-bold text-white">Acesso por reconhecimento facial e cartão</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Cadastra o aluno nos aparelhos da academia. O rosto é capturado e guardado só no aparelho.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" onClick={() => setEnrollMethod('CARD')}>
            <span className="inline-flex items-center gap-2">
              <CreditCard size={15} /> Cartão
            </span>
          </Button>
          <Button onClick={() => (consent ? setEnrollMethod('FACE') : setConsentOpen(true))}>
            <span className="inline-flex items-center gap-2">
              <ScanFace size={15} /> Cadastrar rosto
            </span>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 bg-panel2 border border-edge rounded-xl px-3 py-2.5 mb-4 text-sm">
        {consent ? (
          <>
            <span className="text-zinc-300">
              Consentimento para reconhecimento facial registrado em {dateTime(consent.grantedAt)}{' '}
              <span className="text-zinc-500">(termo {consent.termsVersion})</span>
            </span>
            <button
              className="text-xs font-semibold text-zinc-400 hover:text-accent-soft shrink-0"
              onClick={() => {
                if (window.confirm('Revogar o consentimento? O rosto do aluno será apagado de todos os aparelhos.')) {
                  revoke.mutate();
                }
              }}
            >
              Revogar
            </button>
          </>
        ) : (
          <>
            <span className="text-zinc-400">Sem consentimento para reconhecimento facial.</span>
            <button
              className="text-xs font-semibold text-accent-soft hover:underline shrink-0"
              onClick={() => setConsentOpen(true)}
            >
              Registrar consentimento
            </button>
          </>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">Ainda não cadastrado em nenhum aparelho.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((enrollment) => (
            <EnrollmentRow
              key={enrollment.id}
              enrollment={enrollment}
              onRemove={() => {
                if (window.confirm('Remover o aluno deste aparelho?')) remove.mutate(enrollment.id);
              }}
            />
          ))}
        </ul>
      )}
      <ErrorText>{error}</ErrorText>

      <ConsentModal
        open={consentOpen}
        userId={userId}
        termsVersion={data?.currentTermsVersion ?? ''}
        onClose={() => setConsentOpen(false)}
        onRecorded={(result) => {
          refresh(result);
          setConsentOpen(false);
          setEnrollMethod('FACE');
        }}
      />
      <EnrollModal
        method={enrollMethod}
        userId={userId}
        onClose={() => setEnrollMethod(null)}
        onSent={async () => {
          setEnrollMethod(null);
          await queryClient.invalidateQueries({ queryKey: key });
        }}
      />
    </Card>
  );
}

function EnrollmentRow({ enrollment, onRemove }: { enrollment: EnrollmentResponse; onRemove: () => void }) {
  const status = STATUS[enrollment.status] ?? { label: enrollment.status, tone: 'gray' as const };
  return (
    <li className="flex items-center justify-between gap-3 bg-panel2 border border-edge rounded-xl px-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="p-1.5 rounded-lg bg-panel text-zinc-400">
          {enrollment.method === 'FACE' ? <ScanFace size={15} /> : <CreditCard size={15} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-white">
            {enrollment.method === 'FACE' ? 'Rosto' : `Cartão ${enrollment.cardValue}`} ·{' '}
            {enrollment.deviceName ?? 'Aparelho'}
          </p>
          <p className="text-xs text-zinc-500 truncate">
            {enrollment.status === 'PENDING' && enrollment.method === 'FACE'
              ? 'Peça ao aluno para olhar para a câmera do aparelho.'
              : enrollment.lastError ?? `Atualizado em ${dateTime(enrollment.updatedAt)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge tone={status.tone}>{status.label}</Badge>
        {(enrollment.status === 'ENROLLED' || enrollment.status === 'FAILED') && (
          <button className="text-zinc-500 hover:text-accent-soft" title="Remover do aparelho" onClick={onRemove}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </li>
  );
}

function ConsentModal({
  open,
  userId,
  termsVersion,
  onClose,
  onRecorded,
}: {
  open: boolean;
  userId: string;
  termsVersion: string;
  onClose: () => void;
  onRecorded: (result: MemberAccessResponse) => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      onRecorded(
        await api<MemberAccessResponse>(`/crm/members/${userId}/access/face-consent`, {
          method: 'POST',
          body: { termsVersion, memberAgreed: agreed },
        }),
      );
      setAgreed(false);
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao registrar.');
    }
  }

  return (
    <Modal title="Consentimento para reconhecimento facial" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="bg-panel2 border border-edge rounded-xl p-3 text-zinc-300 space-y-2">
          <p>
            O aluno autoriza a academia a usar a imagem do seu rosto <b>somente para liberar e registrar sua
            entrada</b> nos aparelhos de acesso da academia.
          </p>
          <p>
            O rosto é capturado e armazenado apenas no aparelho, não no BJJ Flow. O aluno pode revogar a
            autorização a qualquer momento; nesse caso o rosto é apagado dos aparelhos.
          </p>
          <p className="text-xs text-zinc-500">Termo versão {termsVersion} · LGPD art. 11</p>
        </div>
        <label className="flex items-start gap-2 text-zinc-300">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="!w-4 h-4 mt-0.5 shrink-0 accent-[#f4372f]"
          />
          Confirmo que o aluno leu e concordou com este termo (por exemplo, assinando o formulário da academia).
        </label>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={!agreed} className="w-full">
          Registrar consentimento
        </Button>
      </form>
    </Modal>
  );
}

function EnrollModal({
  method,
  userId,
  onClose,
  onSent,
}: {
  method: 'FACE' | 'CARD' | null;
  userId: string;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const devices = useDevices();
  const ready = (devices.data ?? []).filter((d) => d.active && d.bridgeId && d.lanHost);
  const [deviceId, setDeviceId] = useState('');
  const [cardValue, setCardValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = deviceId || (ready[0] ? String(ready[0].id) : '');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(`/crm/members/${userId}/access/enrollments`, {
        method: 'POST',
        body: { deviceId: Number(chosen), method, cardValue: method === 'CARD' ? cardValue : undefined },
      });
      setCardValue('');
      await onSent();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao cadastrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={method === 'CARD' ? 'Cadastrar cartão no aparelho' : 'Cadastrar rosto no aparelho'}
      open={method !== null}
      onClose={onClose}
    >
      {ready.length === 0 ? (
        <p className="text-sm text-zinc-400">
          Nenhum aparelho conectado a uma bridge. Em Dispositivos, use <b>Conectar</b> no aparelho para
          escolher a bridge e o IP dele na rede da academia.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <Field label="Aparelho">
            <select value={chosen} onChange={(event) => setDeviceId(event.target.value)}>
              {ready.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                  {device.location ? ` · ${device.location}` : ''}
                </option>
              ))}
            </select>
          </Field>
          {method === 'CARD' ? (
            <Field label="Número do cartão">
              <input
                required
                value={cardValue}
                onChange={(event) => setCardValue(event.target.value)}
                placeholder="Ex.: 123.45678 (como impresso) ou 528281023086"
                pattern="[0-9]{1,20}([.,][0-9]{1,10})?"
              />
            </Field>
          ) : (
            <p className="text-zinc-400">
              Ao enviar, o aparelho abre a câmera por alguns segundos. Peça ao aluno para ficar em frente a
              ele e olhar para a câmera.
            </p>
          )}
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Enviando…' : 'Enviar ao aparelho'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
