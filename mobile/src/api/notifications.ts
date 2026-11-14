import { api } from './client';
import { isOnline } from '../offline/network';
import { OfflineRequiredError, offlineWrite } from '../offline/write';

export type NotificationType =
  | 'SOCIAL'
  | 'MESSAGE'
  | 'TRAINING'
  | 'PERFORMANCE'
  | 'COMPETITION'
  | 'ACADEMY'
  | 'SYSTEM';

export type NotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationList = { unread: number; items: NotificationItem[] };

export async function getNotifications(limit?: number): Promise<NotificationList> {
  const { data } = await api.get<NotificationList>('/users/me/notifications', { params: { limit } });
  return data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await offlineWrite({ method: 'post', url: `/users/me/notifications/${id}/read`, label: 'offline.label.notificationRead', invalidate: [['notifications']] });
}

export async function markAllNotificationsRead(): Promise<void> {
  await offlineWrite({ method: 'post', url: '/users/me/notifications/read-all', label: 'offline.label.notificationRead', invalidate: [['notifications']] });
}

/** Recompute data-driven insights, returns the refreshed list. */
export async function refreshInsights(limit?: number): Promise<NotificationList> {
  if (!isOnline()) throw new OfflineRequiredError();
  const { data } = await api.post<NotificationList>('/users/me/insights/refresh', null, { params: { limit } });
  return data;
}

// Device-token registration for remote push. Wired for when a dev/EAS build adds
// expo-notifications (Expo Go on SDK 54 cannot receive remote push).
export async function registerPushToken(token: string, platform?: string): Promise<void> {
  await offlineWrite({ method: 'post', url: '/users/me/push-tokens', data: { token, platform }, label: 'offline.label.pushToken' });
}

export async function removePushToken(token: string): Promise<void> {
  await offlineWrite({ method: 'post', url: '/users/me/push-tokens/remove', data: { token }, label: 'offline.label.pushToken' });
}
