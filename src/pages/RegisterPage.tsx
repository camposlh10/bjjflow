import { Flame } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../lib/api';
import { BELTS } from '../lib/format';
import type { GymDto } from '../lib/types';
import { Button, ErrorText, Field } from '../components/ui';

export default function RegisterPage() {
  const { token, register } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  // Step 2 directly when an already-registered user still has no gym.
  const [step, setStep] = useState<'conta' | 'academia'>(
    token && params.get('etapa') === 'academia' ? 'academia' : 'conta',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('30');
  const [beltSlug, setBeltSlug] = useState('adult-black');

  const [gymName, setGymName] = useState('');
  const [gymCity, setGymCity] = useState('');
  const [gymDescription, setGymDescription] = useState('');

  async function handleAccount(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({
        email,
        password,
        displayName,
        age: Number(age),
        beltSlug,
      });
      setStep('academia');
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Não foi possível criar a conta.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGym(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api<GymDto>('/gyms', {
        method: 'POST',
        body: {
          name: gymName,
          city: gymCity || undefined,
          description: gymDescription || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['gym'] });
      navigate('/');
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Não foi possível criar a academia.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
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

        <div className="flex items-center gap-2 mb-4 text-xs font-semibold">
          <span className={step === 'conta' ? 'text-accent-soft' : 'text-zinc-500'}>
            1 · Sua conta
          </span>
          <span className="text-zinc-600">──</span>
          <span className={step === 'academia' ? 'text-accent-soft' : 'text-zinc-500'}>
            2 · Sua academia
          </span>
        </div>

        {step === 'conta' ? (
          <form
            onSubmit={handleAccount}
            className="bg-panel border border-edge rounded-2xl p-6 space-y-4"
          >
            <h1 className="text-lg font-bold text-white">Criar conta do proprietário</h1>
            <Field label="Nome completo">
              <input
                required
                maxLength={100}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Seu nome"
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@academia.com"
              />
            </Field>
            <Field label="Senha" hint="Mínimo de 8 caracteres.">
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Idade">
                <input
                  type="number"
                  required
                  min={14}
                  max={100}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                />
              </Field>
              <Field label="Sua faixa">
                <select value={beltSlug} onChange={(event) => setBeltSlug(event.target.value)}>
                  {BELTS.map((belt) => (
                    <option key={belt.slug} value={belt.slug}>
                      {belt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Criando…' : 'Continuar'}
            </Button>
            <p className="text-sm text-zinc-400 text-center pt-1">
              Já tem conta?{' '}
              <Link to="/login" className="text-accent-soft font-semibold hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        ) : (
          <form
            onSubmit={handleGym}
            className="bg-panel border border-edge rounded-2xl p-6 space-y-4"
          >
            <h1 className="text-lg font-bold text-white">Criar sua academia</h1>
            <p className="text-sm text-zinc-400">
              Você será o proprietário e receberá um código de convite para seus alunos.
            </p>
            <Field label="Nome da academia">
              <input
                required
                maxLength={150}
                value={gymName}
                onChange={(event) => setGymName(event.target.value)}
                placeholder="Ex.: Alliance Rio"
              />
            </Field>
            <Field label="Cidade">
              <input
                maxLength={100}
                value={gymCity}
                onChange={(event) => setGymCity(event.target.value)}
                placeholder="Ex.: Rio de Janeiro"
              />
            </Field>
            <Field label="Descrição">
              <textarea
                rows={3}
                maxLength={500}
                value={gymDescription}
                onChange={(event) => setGymDescription(event.target.value)}
                placeholder="Conte um pouco sobre a academia"
              />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Criando…' : 'Criar academia e entrar no CRM'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
