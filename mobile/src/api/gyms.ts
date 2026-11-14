import { api } from './client';
import { offlineWrite, onlineWrite, type Queued } from '../offline/write';

export type GymRole = 'OWNER' | 'INSTRUCTOR' | 'MEMBER';

export type GymPhoto = { id: number; url: string };

export type MedalTier = 'GOLD' | 'SILVER' | 'BRONZE';

export type GymMedal = {
  id: number;
  competition: string;
  tier: MedalTier;
  count: number;
};

export type Gym = {
  id: number;
  name: string;
  city: string | null;
  description: string | null;
  memberCount: number;
  role: GymRole;
  graduationTarget: number;
  instructorsOnlyPosts: boolean;
  /** present only for owner/instructor */
  inviteCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  logoUrl: string | null;
  photos: GymPhoto[];
  verified: boolean;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  youtube: string | null;
  googlePlaceId: string | null;
  medals: GymMedal[];
  createdAt: string;
  verification: GymVerification | null;
};

export type VerificationStatus = 'PENDING' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED';

export type GymVerification = {
  status: VerificationStatus;
  cnpj: string;
  certificateUrl: string | null;
  establishmentUrls: string[];
  /** only present for the gym owner */
  reviewNotes: string | null;
};

export type UpdateGymPayload = {
  name: string;
  city?: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  logoKey?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  youtube?: string;
  googlePlaceId?: string;
};

export type GymReview = {
  id: number;
  userId: number;
  displayName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type GymReviewSummary = {
  average: number;
  count: number;
  myRating: number | null;
  myComment: string | null;
};

export type GymReviewsResponse = {
  summary: GymReviewSummary;
  reviews: GymReview[];
};

export type RankingEntry = {
  position: number;
  userId: number;
  displayName: string;
  belt: GymMemberBelt | null;
  classes: number;
};

export type GymMemberBelt = {
  slug: string;
  namePt: string;
  colorHex: string;
  stripes: number;
};

export type GymMember = {
  userId: number;
  displayName: string;
  role: GymRole;
  belt: GymMemberBelt | null;
  /** aulas verificadas desde a última graduação (contador de graduação) */
  classesAttended: number;
};

export type GymSuggestion = {
  id: number;
  name: string;
  city: string | null;
  memberCount: number;
};

export type CreateGymPayload = {
  name: string;
  city?: string;
  description?: string;
};

/** Returns the user's gym, or null when they aren't in one (backend replies 204). */
export async function getMyGym(): Promise<Gym | null> {
  const res = await api.get<Gym>('/gyms/me', {
    validateStatus: (s) => s === 200 || s === 204,
  });
  return res.status === 204 ? null : res.data;
}

export async function createGym(payload: CreateGymPayload): Promise<Gym> {
  return onlineWrite<Gym>({ method: 'post', url: '/gyms', data: payload });
}

export async function joinGymByCode(inviteCode: string): Promise<Gym> {
  return onlineWrite<Gym>({ method: 'post', url: '/gyms/join', data: { inviteCode } });
}

export async function getGymMembers(): Promise<GymMember[]> {
  const { data } = await api.get<GymMember[]>('/gyms/me/members');
  return data;
}

export async function getGymSuggestions(): Promise<GymSuggestion[]> {
  const { data } = await api.get<GymSuggestion[]>('/gyms/suggestions');
  return data;
}

export async function leaveGym(): Promise<void> {
  await onlineWrite({ method: 'post', url: '/gyms/leave' });
}

export async function promoteMember(
  userId: number,
  beltSlug: string,
  stripes: number,
): Promise<GymMember> {
  return onlineWrite<GymMember>({ method: 'post', url: `/gyms/me/members/${userId}/promote`, data: {
    beltSlug,
    stripes,
  } });
}

export async function updateGym(payload: UpdateGymPayload): Promise<Gym | Queued> {
  return offlineWrite<Gym>({ method: 'put', url: '/gyms/me', data: payload, label: 'offline.label.gymEdit', invalidate: [['myGym']] });
}

/** Owner-only: update gym rules without touching the rest of the gym profile. */
export async function updateGymRules(payload: {
  graduationTarget?: number;
  instructorsOnlyPosts?: boolean;
}): Promise<Gym | Queued> {
  return offlineWrite<Gym>({ method: 'put', url: '/gyms/me/rules', data: payload, label: 'offline.label.gymEdit', invalidate: [['myGym']] });
}

/** TEMP testing aid: add the BJJ Bot student to my gym + seed feed/attendance. */
export async function addTestBot(): Promise<{ userId: number; username: string; displayName: string }> {
  return onlineWrite<{ userId: number; username: string; displayName: string }>({ method: 'post', url: '/dev/bot' });
}

export async function addGymPhoto(key: string): Promise<GymPhoto> {
  return onlineWrite<GymPhoto>({ method: 'post', url: '/gyms/me/photos', data: { key } });
}

export async function deleteGymPhoto(photoId: number): Promise<void> {
  await offlineWrite({ method: 'delete', url: `/gyms/me/photos/${photoId}`, label: 'offline.label.gymEdit', invalidate: [['myGym']] });
}

export async function getRanking(): Promise<RankingEntry[]> {
  const { data } = await api.get<RankingEntry[]>('/gyms/ranking');
  return data;
}

/** TEMP testing aid — flip your own role to preview instructor/owner features. */
export async function setMyGymRole(role: GymRole): Promise<Gym> {
  return onlineWrite<Gym>({ method: 'post', url: '/gyms/me/role', data: { role } });
}

/** TEMP testing aid — toggle the gym's verified badge (owner only). */
export async function toggleGymVerified(): Promise<Gym> {
  return onlineWrite<Gym>({ method: 'post', url: '/gyms/me/verify' });
}

export async function getGymReviews(): Promise<GymReviewsResponse> {
  const { data } = await api.get<GymReviewsResponse>('/gyms/me/reviews');
  return data;
}

export async function upsertGymReview(rating: number, comment?: string): Promise<GymReviewsResponse | Queued> {
  return offlineWrite<GymReviewsResponse>({ method: 'post', url: '/gyms/me/reviews', data: { rating, comment }, label: 'offline.label.review', invalidate: [['gymReviews'], ['myGym']] });
}

export type MedalInput = { competition: string; tier: MedalTier; count: number };

export async function updateGymMedals(medals: MedalInput[]): Promise<Gym | Queued> {
  return offlineWrite<Gym>({ method: 'put', url: '/gyms/me/medals', data: { medals }, label: 'offline.label.gymEdit', invalidate: [['myGym']] });
}

export type SubmitVerificationPayload = {
  cnpj: string;
  certificateKey: string;
  establishmentKeys: string[];
};

export async function submitGymVerification(payload: SubmitVerificationPayload): Promise<Gym> {
  return onlineWrite<Gym>({ method: 'post', url: '/gyms/me/verification', data: payload });
}

export type VerificationAdminItem = {
  id: number;
  gymId: number;
  gymName: string;
  status: VerificationStatus;
  cnpj: string;
  certificateUrl: string | null;
  establishmentUrls: string[];
  aiConfidence: number | null;
  aiSummary: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

export async function getVerificationQueue(): Promise<VerificationAdminItem[]> {
  const { data } = await api.get<VerificationAdminItem[]>('/admin/verifications');
  return data;
}

export async function decideVerification(
  id: number,
  approve: boolean,
  notes?: string,
): Promise<VerificationAdminItem> {
  return onlineWrite<VerificationAdminItem>({ method: 'post', url: `/admin/verifications/${id}/decision`, data: {
    approve,
    notes,
  } });
}
