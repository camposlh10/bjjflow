const TOKEN_KEY = 'bjjflow.token';
const REFRESH_KEY = 'bjjflow.refreshToken';
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
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem(REFRESH_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

// One refresh at a time: refresh tokens rotate on every use, so parallel 401s
// must share a single refresh instead of each spending the token.
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Renews the access token. Resolves true when a new token is stored, false when
 * the session is over (expired, revoked or signed out elsewhere). Rejects when
 * the server could not be reached, so a network blip does not sign the user out.
 */
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (response.status === 401 || response.status === 403) return false;
      if (!response.ok) throw new Error(`Refresh failed (${response.status})`);
      const data = await response.json();
      if (!data?.accessToken) return false;
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken ?? null);
      if (data.user) setStoredUser(data.user);
      return true;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Ends the session on the server too. Best-effort: sign-out never waits on it. */
export function revokeSession(): void {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return;
  void fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    keepalive: true,
  }).catch(() => undefined);
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
  const send = (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  };

  let response = await send();

  // Access tokens are short-lived: on 401, renew once and replay the request.
  if (response.status === 401 && options.auth !== false) {
    let renewed: boolean;
    try {
      renewed = await refreshSession();
    } catch {
      throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Tente novamente.');
    }
    if (renewed) {
      response = await send();
    }
  }

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
