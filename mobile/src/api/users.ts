import { Journey } from './activity';
import { MedalInput, MedalTier } from './gyms';
import { api } from './client';

export type ProfileBelt = {
  slug: string;
  name: string;
  namePt: string;
  colorHex: string;
  stripes: number;
};

export type ProfileGym = {
  id: number;
  name: string;
  city: string | null;
  verified: boolean;
  role: 'OWNER' | 'INSTRUCTOR' | 'MEMBER';
  logoUrl: string | null;
  memberCount: number;
  ratingAverage: number;
  ratingCount: number;
};

export type ProfilePhoto = { id: number; url: string };

export type ProfileMetrics = {
  trainings: number;
  currentStreak: number;
  longestStreak: number;
  activeWeeks: number;
};

export type ProfileMedal = {
  id: number;
  competition: string;
  tier: MedalTier;
  count: number;
};

export type UserProfile = {
  id: number;
  username: string | null;
  displayName: string;
  pro: boolean;
  bio: string | null;
  city: string | null;
  country: string | null;
  state: string | null;
  avatarUrl: string | null;
  certificateUrl: string | null;
  accentColor: string | null;
  bannerUrl: string | null;
  joinedAt: string;
  belt: ProfileBelt | null;
  gym: ProfileGym | null;
  metrics: ProfileMetrics;
  medals: ProfileMedal[];
  photos: ProfilePhoto[];
  followers: number;
  following: number;
  isFollowing: boolean;
  isMe: boolean;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  favoriteArt: string | null;
  trainingStartYear: number | null;
  age: number | null;
};

export async function getUserProfile(id: number): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>(`/users/${id}/profile`);
  return data;
}

export type SearchUser = {
  id: number;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  pro: boolean;
  belt: ProfileBelt | null;
};

export async function searchUsers(q: string): Promise<SearchUser[]> {
  const { data } = await api.get<SearchUser[]>('/users/search', { params: { q } });
  return data;
}

export async function getUserJourney(id: number): Promise<Journey> {
  const { data } = await api.get<Journey>(`/users/${id}/journey`);
  return data;
}

export async function followUser(id: number): Promise<UserProfile> {
  const { data } = await api.post<UserProfile>(`/users/${id}/follow`);
  return data;
}

export async function unfollowUser(id: number): Promise<UserProfile> {
  const { data } = await api.delete<UserProfile>(`/users/${id}/follow`);
  return data;
}

export type UpdateProfilePayload = {
  bio?: string;
  avatarKey?: string;
  certificateKey?: string;
  accentColor?: string;
  /** Empty string clears the banner back to the gradient default. */
  bannerKey?: string;
  username?: string;
};

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  const { data } = await api.put<UserProfile>('/users/me/profile', payload);
  return data;
}

export type CompleteProfilePayload = {
  firstName?: string;
  lastName?: string;
  beltSlug?: string;
  stripes?: number;
  age?: number;
  gender?: string;
  city?: string;
  country?: string;
  state?: string;
  favoriteArt?: string;
  trainingStartYear?: number;
};

/** Fill in / edit profile basics (belt, age, location) — e.g. for social-login accounts. */
export async function completeProfile(payload: CompleteProfilePayload): Promise<UserProfile> {
  const { data } = await api.put<UserProfile>('/users/me/onboarding', payload);
  return data;
}

export async function addMyPhoto(key: string): Promise<UserProfile> {
  const { data } = await api.post<UserProfile>('/users/me/photos', { key });
  return data;
}

export async function deleteMyPhoto(photoId: number): Promise<UserProfile> {
  const { data } = await api.delete<UserProfile>(`/users/me/photos/${photoId}`);
  return data;
}

export async function updateMyMedals(medals: MedalInput[]): Promise<UserProfile> {
  const { data } = await api.put<UserProfile>('/users/me/medals', { medals });
  return data;
}

/** TEMP — preview the PRO badge before subscriptions exist. */
export async function togglePro(): Promise<UserProfile> {
  const { data } = await api.post<UserProfile>('/users/me/pro');
  return data;
}

export type Settings = {
  email: string;
  username: string | null;
  pro: boolean;
  privateAccount: boolean;
  notifyCommunity: boolean;
  notifyMessages: boolean;
  notifyPromotions: boolean;
  mfaEnabled: boolean;
  gymBeltSync: boolean;
};

export async function getSettings(): Promise<Settings> {
  const { data } = await api.get<Settings>('/users/me/settings');
  return data;
}

export async function updateSettings(payload: Partial<Omit<Settings, 'email' | 'username' | 'pro'>>): Promise<Settings> {
  const { data } = await api.put<Settings>('/users/me/settings', payload);
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.put('/users/me/password', { currentPassword, newPassword });
}

export async function changeEmail(password: string, email: string): Promise<Settings> {
  const { data } = await api.put<Settings>('/users/me/email', { password, email });
  return data;
}

export async function sendFeedback(message: string): Promise<void> {
  await api.post('/users/me/feedback', { message });
}
