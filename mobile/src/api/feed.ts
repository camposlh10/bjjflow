import { api } from './client';

export type FeedBelt = {
  slug: string;
  name: string;
  namePt: string;
  colorHex: string;
  stripes: number;
};

export type FeedAuthor = {
  id: number;
  username: string | null;
  displayName: string;
  pro: boolean;
  avatarUrl: string | null;
  belt: FeedBelt | null;
};

export type FeedSubmission = { submission: string; direction: 'HIT' | 'CONCEDED'; count: number };

/** One public training session, rendered Strava-style on the Comunidade feed. */
export type FeedItem = {
  checkInId: number;
  author: FeedAuthor;
  sessionType: string | null;
  durationMinutes: number | null;
  date: string;
  createdAt: string;
  notes: string | null;
  photoUrl: string | null;
  landed: number;
  conceded: number;
  submissions: FeedSubmission[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
};

export type FeedComment = {
  id: number;
  author: FeedAuthor;
  content: string;
  createdAt: string;
};

/** A page of the feed plus the cursor for the next (older) page (null = end). */
export type FeedPage = { items: FeedItem[]; nextCursor: number | null };

export async function getCommunityFeed(cursor?: number): Promise<FeedPage> {
  const { data } = await api.get<FeedPage | FeedItem[]>('/feed', { params: { cursor, limit: 20 } });
  // Tolerate the older array response shape (pre-pagination backend) during rollout.
  if (Array.isArray(data)) return { items: data, nextCursor: null };
  return data;
}

export async function toggleFeedLike(checkInId: number): Promise<{ liked: boolean; likeCount: number }> {
  const { data } = await api.post(`/feed/${checkInId}/like`);
  return data;
}

export async function shareFeedItem(checkInId: number): Promise<{ shareCount: number }> {
  const { data } = await api.post(`/feed/${checkInId}/share`);
  return data;
}

export async function getFeedComments(checkInId: number): Promise<FeedComment[]> {
  const { data } = await api.get<FeedComment[]>(`/feed/${checkInId}/comments`);
  return data;
}

export async function addFeedComment(checkInId: number, content: string): Promise<FeedComment> {
  const { data } = await api.post<FeedComment>(`/feed/${checkInId}/comments`, { content });
  return data;
}
