import { api } from './client';

export type MfaEnrollResponse = {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
};

export async function enrollMfa(): Promise<MfaEnrollResponse> {
  const { data } = await api.post<MfaEnrollResponse>('/users/me/mfa/enroll');
  return data;
}

export async function enableMfa(code: string): Promise<{ enabled: boolean }> {
  const { data } = await api.post<{ enabled: boolean }>('/users/me/mfa/enable', { code });
  return data;
}

export async function disableMfa(password: string): Promise<{ enabled: boolean }> {
  const { data } = await api.post<{ enabled: boolean }>('/users/me/mfa/disable', { password });
  return data;
}
