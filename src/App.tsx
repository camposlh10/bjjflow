import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import ComingSoon from './components/ComingSoon';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PaymentsPage from './pages/PaymentsPage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import ClassesPage from './pages/ClassesPage';
import AttendancePage from './pages/AttendancePage';
import DevicesPage from './pages/DevicesPage';
import SettingsPage from './pages/SettingsPage';
import { useGym } from './lib/hooks';
import { Loading } from './components/ui';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireOwner({ children }: { children: JSX.Element }) {
  const gym = useGym();
  if (gym.isLoading) return <Loading />;
  if (gym.data && gym.data.role !== 'OWNER') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registrar" element={<RegisterPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/pagamentos"
          element={
            <RequireOwner>
              <PaymentsPage />
            </RequireOwner>
          }
        />
        <Route path="/alunos" element={<StudentsPage />} />
        <Route path="/alunos/:userId" element={<StudentDetailPage />} />
        <Route path="/turmas" element={<ClassesPage />} />
        <Route path="/frequencia" element={<AttendancePage />} />
        <Route path="/dispositivos" element={<DevicesPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route
          path="/notificacoes"
          element={
            <ComingSoon
              title="Notificações"
              description="Envio de mensagens, lembretes de pagamento e avisos de turma chegará em uma próxima versão, junto com o módulo de notificações do backend."
            />
          }
        />
        <Route
          path="/relatorios"
          element={
            <ComingSoon
              title="Relatórios"
              description="Relatórios de frequência, retenção de alunos e financeiro estão no roadmap. Por enquanto, use o resumo do Dashboard e a aba Pagamentos."
            />
          }
        />
        <Route
          path="/integracoes"
          element={
            <ComingSoon
              title="Integrações"
              description="Integrações com Mercado Pago, Stripe e PIX automático virão junto com o módulo de gateways de pagamento."
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
