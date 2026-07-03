import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '../store/authStore';

// Tunnel mode cannot reach a local backend through Expo's exp.direct host.
// Override this with EXPO_PUBLIC_API_BASE_URL when testing another backend.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://bjj-flow-production.up.railway.app/api/v1';
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

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  const { refreshToken, setTokens, logout } = useAuthStore.getState();

  // On 401, try a one-time token refresh and replay the original request.
  // Uses bare axios to avoid re-entering this interceptor.
  if (error.response?.status === 401 && refreshToken && config && !config._retried) {
    config._retried = true;
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
      await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(config);
    } catch {
      await logout();
    }
  }
  throw error;
});
