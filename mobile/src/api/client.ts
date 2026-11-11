import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { useAuthStore } from '../store/authStore';

// Port the backend listens on in dev (server.port in its application.yml).
const DEV_API_PORT = 8090;

/**
 * Derive the backend host from the Metro server the app was loaded from, so a
 * physical phone on the same Wi-Fi reaches the dev machine with no config.
 *
 * Returns null when the host isn't usable as a backend address: under tunnel
 * mode Metro is served from exp.direct, which cannot route to a private LAN.
 */
function metroDerivedBaseUrl(): string | null {
  // e.g. "192.168.15.46:8081" in LAN mode, "abc.exp.direct:80" under tunnel.
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (!host || host.endsWith('.exp.direct')) {
    return null;
  }
  // The Android emulator reaches the host machine at 10.0.2.2, never localhost
  // (which is the emulator itself).
  const resolved =
    Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')
      ? '10.0.2.2'
      : host;
  return `http://${resolved}:${DEV_API_PORT}/api/v1`;
}

// Explicit override always wins — set it for tunnel mode, a staging backend, or
// any deployed build (see the env blocks in eas.json).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  metroDerivedBaseUrl() ??
  `http://localhost:${DEV_API_PORT}/api/v1`;
// Origin without the /api/v1 suffix - used to resolve relative media URLs (/media/...).
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  // Fail a stalled request in 8s so screens reach an error/retry state quickly
  // instead of appearing to "never load".
  timeout: 8_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// One refresh at a time. Refresh tokens rotate on every use, so when several
// requests hit a 401 together they must all wait on the same refresh instead of
// each spending the token.
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchanges the refresh token for a new pair. Resolves to the new access token,
 * or null when the session is gone (the user is then logged out). Throws when
 * the server could not be reached, so being offline never ends the session.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) {
        return null;
      }
      try {
        // Bare axios: must not re-enter the interceptors below.
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { timeout: 8_000 },
        );
        await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return data.accessToken as string;
      } catch (refreshError) {
        const status = (refreshError as AxiosError).response?.status;
        if (status === 401 || status === 403) {
          // The server rejected the session itself (expired, revoked, signed out elsewhere).
          await logout({ revoke: false });
          return null;
        }
        throw refreshError;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;

  // On 401, refresh once and replay the original request.
  if (error.response?.status === 401 && config && !config._retried) {
    config._retried = true;
    let accessToken: string | null = null;
    try {
      accessToken = await refreshAccessToken();
    } catch {
      // Network trouble while refreshing: surface the original error and keep
      // the session; the next request will try again.
    }
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      return api(config);
    }
  }
  throw error;
});

/** Tells the server to end this session. Best-effort: logging out never waits on it. */
export async function revokeSession(refreshToken: string): Promise<void> {
  try {
    await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken }, { timeout: 5_000 });
  } catch {
    // Offline or already invalid: the token still expires on its own.
  }
}
