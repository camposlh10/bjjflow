import { AxiosError } from 'axios';

import { t } from '../i18n';
import { User } from '../store/authStore';
import { api } from './client';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
  // Present only when a login is challenged for MFA (tokens/user are then absent).
  mfaRequired?: boolean;
  mfaToken?: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  gender?: string;
  city?: string;
  country?: string;
  state?: string;
  favoriteArt?: string;
  trainingStartYear?: number;
  age: number;
  beltSlug: string;
  stripes?: number;
  weightKg?: number;
  heightCm?: number;
};

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

/** Second step of an MFA login: exchange the mfaToken + code (TOTP or recovery) for tokens. */
export async function completeMfa(mfaToken: string, code: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/mfa', { mfaToken, code });
  return data;
}

export type OAuthProvider = 'GOOGLE' | 'APPLE';

/** Sign in or sign up with a verified Google/Apple ID token. */
export async function oauthLogin(
  provider: OAuthProvider,
  idToken: string,
  displayName?: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/oauth', { provider, idToken, displayName });
  return data;
}

/** Request a password-reset code by email. Always succeeds (no account enumeration). */
export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
}

/** Complete a password reset with the emailed code + a new password. */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { email: email.trim().toLowerCase(), code: code.trim(), newPassword });
}

/** Converte erros da API em mensagens pt-BR para exibir ao usuário. */
export function apiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ code?: string }>;
  if (axiosError?.isAxiosError) {
    if (!axiosError.response) {
      return t('errors.NETWORK');
    }
    switch (axiosError.response.data?.code) {
      case 'EMAIL_ALREADY_USED':
        return t('errors.EMAIL_ALREADY_USED');
      case 'INVALID_CREDENTIALS':
        return t('errors.INVALID_CREDENTIALS');
      case 'INVALID_BELT':
        return t('errors.INVALID_BELT');
      case 'VALIDATION_ERROR':
        return t('errors.VALIDATION_ERROR');
      case 'ALREADY_IN_GYM':
        return t('errors.ALREADY_IN_GYM');
      case 'INVALID_INVITE_CODE':
        return t('errors.INVALID_INVITE_CODE');
      case 'NOT_ELIGIBLE':
        return t('errors.NOT_ELIGIBLE');
      case 'CHECKIN_NOT_OPEN':
        return t('errors.CHECKIN_NOT_OPEN');
      case 'INVALID_TIME':
        return t('errors.INVALID_TIME');
      case 'INVALID_STRIPES':
        return t('errors.INVALID_STRIPES');
      case 'USERNAME_TAKEN':
        return t('errors.USERNAME_TAKEN');
      case 'INVALID_USERNAME':
        return t('errors.INVALID_USERNAME');
      case 'WRONG_PASSWORD':
        return t('errors.WRONG_PASSWORD');
      case 'INVALID_MFA_CODE':
        return t('errors.INVALID_MFA_CODE');
      case 'INVALID_MFA_TOKEN':
        return t('errors.INVALID_MFA_TOKEN');
      case 'MFA_NOT_ENROLLED':
        return t('errors.MFA_NOT_ENROLLED');
      case 'INVALID_RESET_CODE':
        return t('errors.INVALID_RESET_CODE');
      case 'OAUTH_INVALID':
        return t('errors.OAUTH_INVALID');
      case 'OAUTH_NO_EMAIL':
        return t('errors.OAUTH_NO_EMAIL');
    }
  }
  return t('errors.UNKNOWN');
}
