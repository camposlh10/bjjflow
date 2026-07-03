import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useClasses,
  useDashboard,
  useGym,
  useInvoices,
  usePaymentSummary,
  useRevenueSeries,
} from '../lib/hooks';
import { isoDayOfWeek, money, PAYMENT_STATUS, SESSION_TYPES, shortDate } from '../lib/format';
import { Badge, Card, EmptyState, Loading, PageHeader, StatCard, statusTone } from '../components/ui';

export default function DashboardPage() {
  const gym = useGym();
  const dashboard = useDashboard();
  const isOwner = gym.data?.role === 'OWNER';
  const summary = usePaymentSummary(isOwner);
  const revenue = useRevenueSeries(30, isOwner);
  const invoices = useInvoices(isOwner);
  const classes = useClasses();

  if (dashboard.isLoading) return <Loading />;

  const today = isoDayOfWeek();
  const todayClasses = (classes.data ?? [])
    .filter((gymClass) => gymClass.active && gymClass.dayOfWeek === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const recentInvoices = (invoices.data ?? []).slice(0, 6);

  const chartData = (revenue.data?.points ?? []).map((point) => ({
    day: shortDate(point.date).slice(0, 5),
    valor: point.amount,
  }));

  return (
    <div>
      <PageHeader
        title={`Bem-vindo de volta! 👋`}
        subtitle={
          dashboard.data
            ? `Aqui está o que acontece na ${dashboard.data.gymName} hoje.`
            : undefined
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {isOwner && (
          <StatCard
            icon={<CircleDollarSign size={20} />}
            label="Receita do mês"
            value={money(summary.data?.collectedThisMonthAmount)}
            detail={`${summary.data?.paymentsThisMonthCount ?? 0} pagamento(s)`}
            accent
          />
        )}
        <StatCard
          icon={<Users size={20} />}
          label="Alunos ativos"
          value={String(dashboard.data?.totalMembers ?? 0)}
        />
        <StatCard
          icon={<Calendar size={20} />}
          label="Turmas ativas"
          value={String(dashboard.data?.activeClasses ?? 0)}
          detail={`${dashboard.data?.todayClasses ?? 0} hoje`}
        />
        <StatCard
          icon={<CalendarCheck size={20} />}
          label="Check-ins hoje"
          value={String(dashboard.data?.todayCheckIns ?? 0)}
          detail={`${dashboard.data?.monthlyCheckIns ?? 0} no mês`}
        />
        {isOwner && (
          <StatCard
            icon={<AlertTriangle size={20} />}
            label="Inadimplência"
            value={money(summary.data?.overdueInvoiceAmount)}
            detail={`${summary.data?.overdueInvoiceCount ?? 0} fatura(s) vencida(s)`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {isOwner && (
          <Card className="xl:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-white">Receita — últimos 30 dias</h2>
              <span className="text-sm text-zinc-400">
                Total: <span className="text-white font-semibold">{money(revenue.data?.totalAmount)}</span>
              </span>
            </div>
            {chartData.length === 0 ? (
              <EmptyState
                title="Sem pagamentos ainda"
                description="Quando faturas forem pagas, a curva de receita aparece aqui."
              />
            ) : (
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f4372f" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f4372f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#26262d" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={70}
                      tickFormatter={(value: number) => money(value)}
                    />
                    <Tooltip
                      formatter={(value) => [money(Number(value)), 'Receita']}
                      contentStyle={{
                        backgroundColor: '#1b1b21',
                        border: '1px solid #26262d',
                        borderRadius: 12,
                        color: '#fff',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#f4372f"
                      strokeWidth={2}
                      fill="url(#revenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}

        <Card className={isOwner ? '' : 'xl:col-span-2'}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Turmas de hoje</h2>
            <Link to="/turmas" className="text-xs font-semibold text-accent-soft hover:underline">
              Ver agenda
            </Link>
          </div>
          {todayClasses.length === 0 ? (
            <EmptyState title="Nenhuma turma hoje" description="Cadastre turmas na aba Turmas." />
          ) : (
            <ul className="space-y-3">
              {todayClasses.map((gymClass) => (
                <li
                  key={gymClass.id}
                  className="flex items-center gap-3 bg-panel2 border border-edge rounded-xl px-3 py-2.5"
                >
                  <span className="text-sm font-bold text-accent-soft w-14">
                    {gymClass.startTime}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{gymClass.name}</p>
                    <p className="text-xs text-zinc-500">
                      {SESSION_TYPES[gymClass.sessionType]} · até {gymClass.endTime}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isOwner && (
          <Card className="xl:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Últimas faturas</h2>
              <Link
                to="/pagamentos"
                className="text-xs font-semibold text-accent-soft hover:underline"
              >
                Ver todas
              </Link>
            </div>
            {recentInvoices.length === 0 ? (
              <EmptyState
                title="Nenhuma fatura"
                description="Crie planos e faturas na aba Pagamentos."
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 border-b border-edge">
                    <th className="py-2 font-semibold">Aluno</th>
                    <th className="py-2 font-semibold">Descrição</th>
                    <th className="py-2 font-semibold">Vencimento</th>
                    <th className="py-2 font-semibold text-right">Valor</th>
                    <th className="py-2 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-edge/60 last:border-0">
                      <td className="py-2.5 text-white">{invoice.memberName ?? '—'}</td>
                      <td className="py-2.5 text-zinc-400">{invoice.description}</td>
                      <td className="py-2.5 text-zinc-400">{shortDate(invoice.dueDate)}</td>
                      <td className="py-2.5 text-right font-semibold text-white">
                        {money(invoice.amount)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge tone={statusTone(invoice.status)}>
                          {PAYMENT_STATUS[invoice.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
