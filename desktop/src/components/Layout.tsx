import {
  Bell,
  Calendar,
  CalendarCheck,
  ChartColumn,
  CreditCard,
  Fingerprint,
  Flame,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useGym } from '../lib/hooks';
import { GYM_ROLES } from '../lib/format';
import { Button, Card } from './ui';

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pagamentos', label: 'Pagamentos', icon: CreditCard, ownerOnly: true },
  { to: '/alunos', label: 'Alunos', icon: Users },
  { to: '/turmas', label: 'Turmas', icon: Calendar },
  { to: '/frequencia', label: 'Frequência', icon: CalendarCheck },
  { to: '/dispositivos', label: 'Dispositivos', icon: Fingerprint },
];

const moreNav = [
  { to: '/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/relatorios', label: 'Relatórios', icon: ChartColumn },
  { to: '/integracoes', label: 'Integrações', icon: Plug },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof Bell;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-accent/15 text-accent-soft border border-accent/30'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-panel2 border border-transparent'
        }`
      }
    >
      <Icon size={17} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const gym = useGym();

  if (gym.error && gym.error.code === 'CRM_STAFF_ONLY') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <h1 className="text-lg font-bold text-white">Acesso restrito</h1>
          <p className="text-sm text-zinc-400 mt-2">
            O CRM é exclusivo para proprietários e professores da academia. Peça ao proprietário
            para atualizar sua função, ou use o aplicativo BJJ Flow.
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sair
          </Button>
        </Card>
      </div>
    );
  }

  if (gym.error && gym.error.code === 'NO_GYM') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <h1 className="text-lg font-bold text-white">Você ainda não tem uma academia</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Crie sua academia para começar a usar o CRM.
          </p>
          <Button className="mt-4" onClick={() => navigate('/registrar?etapa=academia')}>
            Criar academia
          </Button>
          <Button
            variant="ghost"
            className="mt-2 ml-2"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sair
          </Button>
        </Card>
      </div>
    );
  }

  const isOwner = gym.data?.role === 'OWNER';

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-edge bg-panel/60 flex flex-col p-4 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <div className="p-2 rounded-xl bg-accent text-white">
            <Flame size={18} />
          </div>
          <div>
            <p className="font-extrabold text-white leading-tight">
              BJJ <span className="text-accent-soft">FLOW</span>
            </p>
            <p className="text-[10px] tracking-[0.25em] text-zinc-500 font-semibold">CRM</p>
          </div>
        </div>

        <nav className="space-y-1">
          {mainNav
            .filter((item) => !item.ownerOnly || isOwner)
            .map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
        </nav>

        <p className="text-[10px] font-bold tracking-widest text-zinc-600 px-3 pt-6 pb-2">MAIS</p>
        <nav className="space-y-1">
          {moreNav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <div className="bg-panel2 border border-edge rounded-xl p-3">
            <p className="text-sm font-semibold text-white truncate">
              {gym.data?.name ?? 'Academia'}
            </p>
            <p className="text-xs text-zinc-500">
              {user?.displayName ?? '—'} · {gym.data ? GYM_ROLES[gym.data.role] : ''}
            </p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg
              text-sm font-semibold text-accent-soft border border-accent/40 hover:bg-accent/10"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
