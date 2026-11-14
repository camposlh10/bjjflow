import { api } from './client';
import { onlineWrite } from '../offline/write';

export type MfaEnrollResponse = {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
};

export async function enrollMfa(): Promise<MfaEnrollResponse> {
  return onlineWrite<MfaEnrollResponse>({ method: 'post', url: '/users/me/mfa/enroll' });
}

export async function enableMfa(code: string): Promise<{ enabled: boolean }> {
  return onlineWrite<{ enabled: boolean }>({ method: 'post', url: '/users/me/mfa/enable', data: { code } });
}

export async function disableMfa(password: string): Promise<{ enabled: boolean }> {
  return onlineWrite<{ enabled: boolean }>({ method: 'post', url: '/users/me/mfa/disable', data: { password } });
}
