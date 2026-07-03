import { GymRole } from './gyms';
import { API_ORIGIN, api } from './client';

export type MediaType = 'IMAGE' | 'VIDEO';

export type MediaItem = {
  url: string;
  type: MediaType;
};

export type UploadedMedia = {
  key: string;
  url: string;
  type: MediaType;
};

export type PostAuthorBelt = {
  slug: string;
  namePt: string;
  colorHex: string;
  stripes: number;
};

export type PostAuthor = {
  userId: number;
  displayName: string;
  role: GymRole;
  belt: PostAuthorBelt | null;
};

export type Post = {
  id: number;
  author: PostAuthor;
  content: string;
  media: MediaItem[];
  pinned: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  createdAt: string;
};

export type Comment = {
  id: number;
  author: PostAuthor;
  content: string;
  createdAt: string;
};

/** Local media comes back as a relative path; cloud media as an absolute URL. */
export function resolveMediaUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

export async function getFeed(): Promise<Post[]> {
  const { data } = await api.get<Post[]>('/gyms/posts');
  return data;
}

export async function getPost(id: number): Promise<Post> {
  const { data } = await api.get<Post>(`/gyms/posts/${id}`);
  return data;
}

export async function uploadMedia(file: {
  uri: string;
  name: string;
  type: string;
}): Promise<UploadedMedia> {
  const form = new FormData();
  // React Native's FormData accepts a {uri, name, type} object for files.
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  // General media endpoint (no gym membership required) — works for profile
  // avatar/photos/certificate as well as gym uploads.
  const { data } = await api.post<UploadedMedia>('/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function createPost(
  content: string,
  media: { key: string; type: MediaType }[] = [],
): Promise<Post> {
  const { data } = await api.post<Post>('/gyms/posts', { content, media });
  return data;
}

export async function deletePost(id: number): Promise<void> {
  await api.delete(`/gyms/posts/${id}`);
}

export async function toggleLike(id: number): Promise<{ liked: boolean; likeCount: number }> {
  const { data } = await api.post(`/gyms/posts/${id}/like`);
  return data;
}

export async function sharePost(id: number): Promise<{ shareCount: number }> {
  const { data } = await api.post(`/gyms/posts/${id}/share`);
  return data;
}

export async function toggleSave(id: number): Promise<{ saved: boolean }> {
  const { data } = await api.post(`/gyms/posts/${id}/save`);
  return data;
}

export async function getSavedPosts(): Promise<Post[]> {
  const { data } = await api.get<Post[]>('/gyms/posts/saved');
  return data;
}

export async function setPinned(id: number, pinned: boolean): Promise<Post> {
  const { data } = await api.put<Post>(`/gyms/posts/${id}/pin`, { pinned });
  return data;
}

export async function getComments(id: number): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(`/gyms/posts/${id}/comments`);
  return data;
}

export async function addComment(id: number, content: string): Promise<Comment> {
  const { data } = await api.post<Comment>(`/gyms/posts/${id}/comments`, { content });
  return data;
}
