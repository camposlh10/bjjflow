import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, FilePlus2, RefreshCw } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import {
  BILLING_CYCLES,
  money,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUS,
  shortDate,
  todayIso,
} from '../lib/format';
import { useInvoices, useMembers, usePaymentPlans, usePaymentSummary } from '../lib/hooks';
import type {
  GenerateInvoicesResponse,
  InvoiceResponse,
  PaymentPlanResponse,
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
  PageHeader,
  StatCard,
  statusTone,
} from '../components/ui';

type Tab = 'faturas' | 'planos';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const summary = usePaymentSummary();
  const invoices = useInvoices();
  const plans = usePaymentPlans();
  const members = useMembers();

  const [tab, setTab] = useState<Tab>('faturas');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [planModal, setPlanModal] = useState<PaymentPlanResponse | 'new' | null>(null);
  const [payModal, setPayModal] = useState<InvoiceResponse | null>(null);
  const [feedback, setFeedback] = useState('');

  const invalidatePayments = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['payment-plans'] }),
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['revenue-series'] }),
    ]);

  const generateDue = useMutation({
    mutationFn: () =>
      api<GenerateInvoicesResponse>('/crm/invoices/generate-due', { method: 'POST' }),
    onSuccess: async (result) => {
      await invalidatePayments();
      setFeedback(
        result.createdCount === 0
          ? 'Nenhuma fatura a gerar — os planos estão em dia.'
          : `${result.createdCount} fatura(s) gerada(s) a partir dos planos.`,
      );
    },
  });

  const cancelInvoice = useMutation({
    mutationFn: (invoiceId: number) =>
      api(`/crm/invoices/${invoiceId}/cancel`, { method: 'PUT' }),
    onSuccess: invalidatePayments,
  });

  const filteredInvoices = useMemo(() => {
    const all = invoices.data ?? [];
    if (statusFilter === 'ALL') return all;
    return all.filter((invoice) => invoice.status === statusFilter);
  }, [invoices.data, statusFilter]);

  if (summary.isLoading || invoices.isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        subtitle="Planos, faturas e recebimentos manuais (PIX, dinheiro, cartão)."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => generateDue.mutate()}
              disabled={generateDue.isPending}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={15} />
                Gerar faturas dos planos
              </span>
            </Button>
            <Button onClick={() => setInvoiceModal(true)}>
              <span className="inline-flex items-center gap-2">
                <FilePlus2 size={15} />
                Nova fatura
              </span>
            </Button>
          </>
        }
      />

      {feedback && (
        <p className="mb-4 text-sm text-ok bg-ok/10 border border-ok/30 rounded-lg px-3 py-2">
          {feedback}
        </p>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<CircleDollarSign size={20} />}
          label="Recebido no mês"
          value={money(summary.data?.collectedThisMonthAmount)}
          accent
        />
        <StatCard
          icon={<CircleDollarSign size={20} />}
          label="Pendente"
          value={money(summary.data?.pendingInvoiceAmount)}
          detail={`${summary.data?.pendingInvoiceCount ?? 0} fatura(s)`}
        />
        <StatCard
          icon={<CircleDollarSign size={20} />}
          label="Vencido"
          value={money(summary.data?.overdueInvoiceAmount)}
          detail={`${summary.data?.overdueInvoiceCount ?? 0} fatura(s)`}
        />
        <StatCard
          icon={<CircleDollarSign size={20} />}
          label="Planos ativos"
          value={String(summary.data?.activePlanCount ?? 0)}
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        {(['faturas', 'planos'] as Tab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${
              tab === item
                ? 'bg-accent/15 text-accent-soft border border-accent/30'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            {item}
          </button>
        ))}
        {tab === 'faturas' && (
          <select
            className="ml-auto !w-44"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">Todas</option>
            {Object.entries(PAYMENT_STATUS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}s
              </option>
            ))}
          </select>
        )}
        {tab === 'planos' && (
          <Button className="ml-auto" variant="ghost" onClick={() => setPlanModal('new')}>
            Novo plano
          </Button>
        )}
      </div>

      {tab === 'faturas' ? (
        <Card>
          {filteredInvoices.length === 0 ? (
            <EmptyState
              title="Nenhuma fatura encontrada"
              description="Crie uma fatura avulsa ou gere faturas a partir dos planos."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-edge">
                  <th className="py-2 font-semibold">Aluno</th>
                  <th className="py-2 font-semibold">Descrição</th>
                  <th className="py-2 font-semibold">Vencimento</th>
                  <th className="py-2 font-semibold text-right">Valor</th>
                  <th className="py-2 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Forma</th>
                  <th className="py-2 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-edge/60 last:border-0">
                    <td className="py-2.5 text-white">{invoice.memberName ?? '—'}</td>
                    <td className="py-2.5 text-zinc-400">{invoice.description}</td>
                    <td className="py-2.5 text-zinc-400">{shortDate(invoice.dueDate)}</td>
                    <td className="py-2.5 text-right font-semibold text-white">
                      {money(invoice.amount)}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={statusTone(invoice.status)}>
                        {PAYMENT_STATUS[invoice.status]}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-zinc-400">
                      {invoice.status === 'PAID' ? PAYMENT_PROVIDERS[invoice.provider] : '—'}
                    </td>
                    <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                      {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                        <>
                          <button
                            className="text-xs font-semibold text-ok hover:underline"
                            onClick={() => setPayModal(invoice)}
                          >
                            Marcar paga
                          </button>
                          <button
                            className="text-xs font-semibold text-zinc-400 hover:text-accent-soft"
                            onClick={() => {
                              if (window.confirm('Cancelar esta fatura?')) {
                                cancelInvoice.mutate(invoice.id);
                              }
                            }}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                      {invoice.status === 'PAID' && invoice.paidAt && (
                        <span className="text-xs text-zinc-500">
                          paga em {shortDate(invoice.paidAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card>
          {(plans.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhum plano cadastrado"
              description="Crie um plano de mensalidade para gerar faturas automaticamente."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-edge">
                  <th className="py-2 font-semibold">Aluno</th>
                  <th className="py-2 font-semibold">Plano</th>
                  <th className="py-2 font-semibold text-right">Valor</th>
                  <th className="py-2 font-semibold">Ciclo</th>
                  <th className="py-2 font-semibold">Próx. vencimento</th>
                  <th className="py-2 font-semibold">Status</th>
                  <th className="py-2 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(plans.data ?? []).map((plan) => (
                  <tr key={plan.id} className="border-b border-edge/60 last:border-0">
                    <td className="py-2.5 text-white">{plan.memberName ?? '—'}</td>
                    <td className="py-2.5 text-zinc-400">{plan.name}</td>
                    <td className="py-2.5 text-right font-semibold text-white">
                      {money(plan.amount)}
                    </td>
                    <td className="py-2.5 text-zinc-400">{BILLING_CYCLES[plan.billingCycle]}</td>
                    <td className="py-2.5 text-zinc-400">{shortDate(plan.nextDueDate)}</td>
                    <td className="py-2.5">
                      <Badge tone={plan.active ? 'green' : 'gray'}>
                        {plan.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        className="text-xs font-semibold text-accent-soft hover:underline"
                        onClick={() => setPlanModal(plan)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <InvoiceModal
        open={invoiceModal}
        onClose={() => setInvoiceModal(false)}
        onSaved={async () => {
          await invalidatePayments();
          setInvoiceModal(false);
        }}
        members={members.data ?? []}
        plans={(plans.data ?? []).filter((plan) => plan.active)}
      />
      <PlanModal
        plan={planModal}
        onClose={() => setPlanModal(null)}
        onSaved={async () => {
          await invalidatePayments();
          setPlanModal(null);
        }}
        members={members.data ?? []}
      />
      <MarkPaidModal
        invoice={payModal}
        onClose={() => setPayModal(null)}
        onSaved={async () => {
          await invalidatePayments();
          setPayModal(null);
        }}
      />
    </div>
  );
}

function InvoiceModal({
  open,
  onClose,
  onSaved,
  members,
  plans,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  members: { userId: number; displayName: string }[];
  plans: PaymentPlanResponse[];
}) {
  const [memberUserId, setMemberUserId] = useState('');
  const [paymentPlanId, setPaymentPlanId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayIso());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/crm/invoices', {
        method: 'POST',
        body: {
          memberUserId: memberUserId ? Number(memberUserId) : undefined,
          paymentPlanId: paymentPlanId ? Number(paymentPlanId) : undefined,
          description: description || undefined,
          amount: amount ? Number(amount) : undefined,
          dueDate: dueDate || undefined,
        },
      });
      await onSaved();
      setDescription('');
      setAmount('');
      setPaymentPlanId('');
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao criar fatura.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nova fatura" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Plano (opcional)" hint="Preenche aluno, descrição e valor automaticamente.">
          <select value={paymentPlanId} onChange={(event) => setPaymentPlanId(event.target.value)}>
            <option value="">Fatura avulsa</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.memberName} — {plan.name}
              </option>
            ))}
          </select>
        </Field>
        {!paymentPlanId && (
          <Field label="Aluno">
            <select
              required
              value={memberUserId}
              onChange={(event) => setMemberUserId(event.target.value)}
            >
              <option value="">Selecione…</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Descrição">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={255}
            placeholder={paymentPlanId ? 'Usar nome do plano' : 'Ex.: Mensalidade Junho'}
            required={!paymentPlanId}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={paymentPlanId ? 'Valor do plano' : '150.00'}
              required={!paymentPlanId}
            />
          </Field>
          <Field label="Vencimento">
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Criando…' : 'Criar fatura'}
        </Button>
      </form>
    </Modal>
  );
}

function PlanModal({
  plan,
  onClose,
  onSaved,
  members,
}: {
  plan: PaymentPlanResponse | 'new' | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  members: { userId: number; displayName: string }[];
}) {
  const editing = plan !== null && plan !== 'new' ? plan : null;
  const [memberUserId, setMemberUserId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [nextDueDate, setNextDueDate] = useState(todayIso());
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedId, setLoadedId] = useState<number | 'new' | null>(null);

  // Sync form when a different plan is opened.
  const currentId = plan === 'new' ? 'new' : plan?.id ?? null;
  if (plan !== null && currentId !== loadedId) {
    setLoadedId(currentId);
    setError('');
    if (editing) {
      setMemberUserId(String(editing.memberUserId));
      setName(editing.name);
      setAmount(String(editing.amount));
      setBillingCycle(editing.billingCycle);
      setNextDueDate(editing.nextDueDate);
      setActive(editing.active);
    } else {
      setMemberUserId('');
      setName('');
      setAmount('');
      setBillingCycle('MONTHLY');
      setNextDueDate(todayIso());
      setActive(true);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (editing) {
        await api(`/crm/payment-plans/${editing.id}`, {
          method: 'PUT',
          body: {
            name,
            amount: Number(amount),
            billingCycle,
            nextDueDate,
            active,
          },
        });
      } else {
        await api('/crm/payment-plans', {
          method: 'POST',
          body: {
            memberUserId: Number(memberUserId),
            name,
            amount: Number(amount),
            billingCycle,
            nextDueDate,
          },
        });
      }
      await onSaved();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao salvar plano.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar plano — ${editing.memberName ?? ''}` : 'Novo plano'}
      open={plan !== null}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editing && (
          <Field label="Aluno">
            <select
              required
              value={memberUserId}
              onChange={(event) => setMemberUserId(event.target.value)}
            >
              <option value="">Selecione…</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Nome do plano">
          <input
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Mensalidade BJJ"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field label="Ciclo de cobrança">
            <select value={billingCycle} onChange={(event) => setBillingCycle(event.target.value)}>
              {Object.entries(BILLING_CYCLES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Próximo vencimento">
          <input
            type="date"
            required
            value={nextDueDate}
            onChange={(event) => setNextDueDate(event.target.value)}
          />
        </Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="!w-4 h-4 accent-[#f4372f]"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Plano ativo (gera faturas automaticamente)
          </label>
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar plano'}
        </Button>
      </form>
    </Modal>
  );
}

function MarkPaidModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: InvoiceResponse | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [provider, setProvider] = useState('PIX');
  const [externalTransactionId, setExternalTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    setError('');
    setBusy(true);
    try {
      await api(`/crm/invoices/${invoice.id}/mark-paid`, {
        method: 'PUT',
        body: {
          provider,
          externalTransactionId: externalTransactionId || undefined,
          notes: notes || undefined,
        },
      });
      await onSaved();
      setExternalTransactionId('');
      setNotes('');
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Erro ao registrar pagamento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={invoice ? `Registrar pagamento — ${money(invoice.amount)}` : 'Registrar pagamento'}
      open={invoice !== null}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {invoice && (
          <p className="text-sm text-zinc-400">
            {invoice.memberName} · {invoice.description} · vence {shortDate(invoice.dueDate)}
          </p>
        )}
        <Field label="Forma de pagamento">
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            {Object.entries(PAYMENT_PROVIDERS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Identificador externo (opcional)" hint="Ex.: ID da transação PIX.">
          <input
            maxLength={150}
            value={externalTransactionId}
            onChange={(event) => setExternalTransactionId(event.target.value)}
          />
        </Field>
        <Field label="Observações (opcional)">
          <textarea
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Registrando…' : 'Confirmar pagamento'}
        </Button>
      </form>
    </Modal>
  );
}
