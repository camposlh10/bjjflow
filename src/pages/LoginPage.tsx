import { Flame } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';
import { Button, ErrorText, Field } from '../components/ui';

export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (exception) {
      setError(
        exception instanceof ApiError && exception.status !== 500
          ? exception.message
          : 'Não foi possível entrar. Verifique suas credenciais.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-accent text-white">
            <Flame size={22} />
          </div>
          <div>
            <p className="text-xl font-extrabold text-white leading-tight">
              BJJ <span className="text-accent-soft">FLOW</span>
            </p>
            <p className="text-[10px] tracking-[0.3em] text-zinc-500 font-semibold">CRM</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-panel border border-edge rounded-2xl p-6 space-y-4"
        >
          <h1 className="text-lg font-bold text-white">Entrar</h1>
          <p className="text-sm text-zinc-400">
            Use a mesma conta do aplicativo BJJ Flow.
          </p>
          <Field label="E-mail">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@academia.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          <p className="text-sm text-zinc-400 text-center pt-1">
            Novo por aqui?{' '}
            <Link to="/registrar" className="text-accent-soft font-semibold hover:underline">
              Criar conta e academia
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
