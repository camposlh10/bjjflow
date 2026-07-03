const TOKEN_KEY = 'bjjflow.token';
const USER_KEY = 'bjjflow.user';

// In dev, Vite proxies /api to the local backend (see vite.config.ts).
// In production (Vercel), set VITE_API_URL to the Railway backend, e.g.
// https://seu-app.up.railway.app/api/v1
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredUser(user: unknown): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** set false for login/register calls */
  auth?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 401 && options.auth !== false) {
    setToken(null);
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'Sessão expirada. Entre novamente.');
  }

  if (!response.ok) {
    let code = 'ERROR';
    let message = 'Erro inesperado. Tente novamente.';
    try {
      const data = await response.json();
      if (data && typeof data === 'object') {
        code = data.code ?? code;
        message = data.message ?? message;
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, code, message);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
