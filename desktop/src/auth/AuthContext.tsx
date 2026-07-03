import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, getStoredUser, getToken, setStoredUser, setToken } from '../lib/api';
import type { AuthResponse, AuthUser } from '../lib/types';

interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  age: number;
  beltSlug: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [user, setUser] = useState<AuthUser | null>(getStoredUser<AuthUser>());

  const applyAuth = useCallback((response: AuthResponse) => {
    if (response.mfaRequired) {
      throw new ApiError(
        401,
        'MFA_REQUIRED',
        'Esta conta usa verificação em duas etapas. Entre pelo aplicativo BJJ Flow para acessar o CRM.',
      );
    }
    if (!response.accessToken) {
      throw new ApiError(500, 'NO_TOKEN', 'Resposta de autenticação inválida.');
    }
    setToken(response.accessToken);
    if (response.user) setStoredUser(response.user);
    setTokenState(response.accessToken);
    setUser(response.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      applyAuth(response);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { ...input, stripes: 0 },
        auth: false,
      });
      applyAuth(response);
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, login, register, logout }),
    [token, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
