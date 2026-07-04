import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, CreditCard, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { dateTime, money, PAYMENT_STATUS } from '../lib/format';
import type {
  InvoiceResponse,
  PosEventResponse,
  PosEventStatus,
  PosIntegrationResponse,
  PosIntegrationWithKeyResponse,
} from '../lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Modal,
} from '../components/ui';

const POS_STATUS_LABELS: Record<PosEventStatus, string> = {
  RECEIVED: 'Recebido',
  PROCESSED: 'Processado',
  DUPLICATE: 'Duplicado',
  UNRESOLVED_INVOICE: 'Fatura não encontrada',
  AMOUNT_MISMATCH: 'Valor divergente',
  ALREADY_PAID: 'Fatura já paga',
  FAILED: 'Falhou',
  IGNORED: 'Ignorado',
};

function posStatusTone(status: PosEventStatus): 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  switch (status) {
    case 'PROCESSED':
      return 'green';
    case 'UNRESOLVED_INVOICE':
    case 'AMOUNT_MISMATCH':
      return 'amber';
    case 'FAILED':
      return 'red';
    case 'ALREADY_PAID':
    case 'DUPLICATE':
      return 'blue';
    default:
      return 'gray';
  }
}

export default function PosTab({ openInvoices }: { openInvoices: InvoiceResponse[] }) {
  const queryClient = useQueryClient();
  const [registerModal, setRegisterModal] = useState(false);
  const [issuedKey, setIssuedKey] = useState<PosIntegrationWithKeyResponse | null>(null);

  const integrations = useQuery<PosIntegrationResponse[], ApiError>({
    queryKey: ['pos-integrations'],
    queryFn: () => api<PosIntegrationResponse[]>('/crm/pos-integrations'),
  });
  const events = useQuery<PosEventResponse[], ApiError>({
    queryKey: ['pos-events'],
    queryFn: () => api<PosEventResponse[]>('/crm/pos-events'),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['pos-integrations'] }),
      queryClient.invalidateQueries({ queryKey: ['pos-events'] }),
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['revenue-series'] }),
    ]);

  const rotate = useMutation({
    mutationFn: (integrationId: number) =>
      api<PosIntegrationWithKeyResponse>(`/crm/pos-integrations/${integrationId}/rotate-key`, {
        method: 'POST',
      }),
    onSuccess: async (result) => {
      await refresh();
      setIssuedKey(result);
    },
  });

  const deactivate = useMutation({
    mutationFn: (integrationId: number) =>
      api(`/crm/pos-integrations/${integrationId}/deactivate`, { method: 'PUT' }),
    onSuccess: refresh,
  });

  if (integrations.isLoading || events.isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-white">Maquininhas e gateways</h2>
            <p className="text-xs text-zinc-500 mt-1">
              O provedor envia o webhook para{' '}
              <code className="text-accent-soft bg-panel2 px-1.5 py-0.5 rounded">
                POST /api/v1/payments/webhooks/pos
              </code>{' '}
              com o header{' '}
              <code className="text-accent-soft bg-panel2 px-1.5 py-0.5 rounded">X-Webhook-Key</code>.
              Use a referência da fatura (coluna Ref.) na venda para o pagamento casar sozinho.
            </p>
          </div>
          <Button onClick={() => setRegisterModal(true)}>
            <span className="inline-flex items-center gap-2">
              <Plus size={15} />
              Registrar maquininha
            </span>
          </Button>
        </div>
        {(integrations.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma maquininha registrada"
            description="Registre sua maquininha ou gateway para receber pagamentos automaticamente."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-edge">
                <th className="py-2 font-semibold">Nome</th>
                <th className="py-2 font-semibold">Provedor</th>
                <th className="py-2 font-semibold">Última atividade</th>
                <th className="py-2 font-semibold">Status</th>
                <th className="py-2 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(integrations.data ?? []).map((integration) => (
                <tr key={integration.id} className="border-b border-edge/60 last:border-0">
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-2 font-semibold text-white">
                      <CreditCard size={15} className="text-zinc-400" />
                      {integration.name}
                    </span>
                  </td>
                  <td className="py-2.5 text-zinc-400">{integration.providerName}</td>
                  <td className="py-2.5 text-zinc-400">
                    {integration.lastSeenAt ? dateTime(integration.lastSeenAt) : 'Nunca conectada'}
                  </td>
                  <td className="py-2.5">
                    <Badge tone={integration.active ? 'green' : 'gray'}>
                      {integration.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-right space-x-3 whitespace-nowrap">
                    {integration.active && (
                      <>
                        <button
                          className="text-xs font-semibold text-accent-soft hover:underline"
                          onClick={() => {
                            if (window.confirm('Gerar nova chave? A atual para de funcionar na hora.')) {
                              rotate.mutate(integration.id);
                            }
                          }}
                        >
                          Trocar chave
                        </button>
                        <button
                          className="text-xs font-semibold text-zinc-400 hover:text-accent-soft"
                          onClick={() => {
                            if (window.confirm('Desativar esta integração?')) {
                              deactivate.mutate(integration.id);
                            }
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
      </Card>

      <Card>
        <h2 className="font-bold text-white mb-1">Transações recebidas</h2>
        <p className="text-xs text-zinc-500 mb-4">
          Pagamentos com fatura e valor corretos são baixados automaticamente; os demais ficam
          aqui para revisão.
        </p>
        {(events.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma transação ainda"
            description="Quando a maquininha confirmar um pagamento, ele aparece aqui."
          />
        ) : (
          <ul className="space-y-2">
            {(events.data ?? []).map((event) => (
              <PosEventRow key={event.id} event={event} openInvoices={openInvoices} onChanged={refresh} />
            ))}
          </ul>
        )}
      </Card>

      <RegisterIntegrationModal
        open={registerModal}
        onClose={() => setRegisterModal(false)}
        onRegistered={async (result) => {
          await refresh();
          setRegisterModal(false);
          setIssuedKey(result);
        }}
      />

      <Modal
        title="Chave do webhook"
        open={issuedKey !== null}
        onClose={() => setIssuedKey(null)}
      >
        {issuedKey && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Configure esta chave no webhook do provedor{' '}
              <b className="text-white">{issuedKey.integration.name}</b>. Ela é exibida{' '}
              <b className="text-accent-soft">apenas uma vez</b>.
            </p>
            <div className="flex items-center gap-2 bg-panel2 border border-edge rounded-xl p-3">
              <code className="text-sm text-ok font-mono break-all flex-1">
                {issuedKey.webhookKey}
              </code>
              <button
                className="text-zinc-400 hover:text-white shrink-0"
                title="Copiar"
                onClick={() => navigator.clipboard.writeText(issuedKey.webhookKey)}
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

function PosEventRow({
  event,
  openInvoices,
  onChanged,
}: {
  event: PosEventResponse;
  openInvoices: InvoiceResponse[];
  onChanged: () => Promise<unknown>;
}) {
  const [invoiceId, setInvoiceId] = useState('');
  const [error, setError] = useState('');
  const reviewable = event.status === 'UNRESOLVED_INVOICE' || event.status === 'AMOUNT_MISMATCH';

  async function act(path: string) {
    setError('');
    try {
      await api(path, { method: 'PUT' });
      await onChanged();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao processar.');
    }
  }

  return (
    <li className="bg-panel2 border border-edge rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={posStatusTone(event.status)}>{POS_STATUS_LABELS[event.status]}</Badge>
            <span className="text-sm font-semibold text-white">{money(event.amount)}</span>
            {event.cardBrand && (
              <span className="text-xs text-zinc-400">
                {event.cardBrand}
                {event.installments && event.installments > 1 ? ` · ${event.installments}x` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {event.integrationName ?? 'Integração'} · TX {event.externalTransactionId}
            {event.paymentReference ? ` · Ref. ${event.paymentReference}` : ''}
          </p>
          {event.invoiceDescription && (
            <p className="text-xs text-zinc-400 mt-0.5">
              Fatura: {event.invoiceDescription}
              {event.memberName ? ` — ${event.memberName}` : ''}
            </p>
          )}
          {event.notes && <p className="text-xs text-warn mt-0.5">{event.notes}</p>}
        </div>
        <span className="text-xs text-zinc-500 whitespace-nowrap shrink-0">
          {dateTime(event.paidAt)}
        </span>
      </div>

      {reviewable && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select
            className="!w-72 !py-1.5 text-xs"
            value={invoiceId}
            onChange={(changeEvent) => setInvoiceId(changeEvent.target.value)}
          >
            <option value="">Vincular a uma fatura…</option>
            {openInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.memberName} — {invoice.description} ({money(invoice.amount)},{' '}
                {PAYMENT_STATUS[invoice.status]})
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            className="!py-1.5 !px-3 text-xs"
            disabled={!invoiceId}
            onClick={() => act(`/crm/pos-events/${event.id}/link-invoice/${invoiceId}`)}
          >
            Confirmar pagamento
          </Button>
          <button
            className="text-xs font-semibold text-zinc-400 hover:text-accent-soft ml-auto"
            onClick={() => act(`/crm/pos-events/${event.id}/ignore`)}
          >
            Ignorar
          </button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </li>
  );
}

function RegisterIntegrationModal({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: (result: PosIntegrationWithKeyResponse) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [providerName, setProviderName] = useState('Stone');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api<PosIntegrationWithKeyResponse>('/crm/pos-integrations', {
        method: 'POST',
        body: { name, providerName },
      });
      await onRegistered(result);
      setName('');
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao registrar integração.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Registrar maquininha / gateway" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome">
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Maquininha da recepção"
          />
        </Field>
        <Field label="Provedor">
          <select value={providerName} onChange={(event) => setProviderName(event.target.value)}>
            {['Stone', 'Cielo', 'PagSeguro', 'Mercado Pago', 'SumUp', 'InfinitePay', 'Outro'].map(
              (provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ),
            )}
          </select>
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Registrando…' : 'Registrar e gerar chave'}
        </Button>
      </form>
    </Modal>
  );
}
