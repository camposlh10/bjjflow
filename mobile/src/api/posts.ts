import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { GymRole } from './gyms';
import { API_ORIGIN, api } from './client';
import { isOnline } from '../offline/network';
import { OfflineRequiredError, offlineWrite, type Queued } from '../offline/write';

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

/** A page of the gym wall plus the cursor for the next (older) page (null = end). */
export type PostPage = { items: Post[]; nextCursor: number | null };

/** The first page (no cursor) starts with the pinned posts. */
export async function getFeedPage(cursor?: number | null): Promise<PostPage> {
  const { data } = await api.get<PostPage | Post[]>('/gyms/posts', {
    params: { limit: 15, cursor: cursor ?? undefined },
  });
  // A backend without paging answers with the whole array.
  if (Array.isArray(data)) return { items: data, nextCursor: null };
  return data;
}

export async function getPost(id: number): Promise<Post> {
  const { data } = await api.get<Post>(`/gyms/posts/${id}`);
  return data;
}

type UploadFile = { uri: string; name: string; type: string };

/** Uploads can be large videos on mobile data: far longer than the API's default 8s. */
const UPLOAD_TIMEOUT_MS = 5 * 60_000;

type UploadTicket = {
  /** false: the backend has no direct-upload storage (local dev) - use multipart. */
  direct: boolean;
  key: string | null;
  url: string | null;
  type: MediaType;
  uploadUrl: string | null;
  headers: Record<string, string> | null;
};

/**
 * Uploads a picked image/video and returns its storage key + URL.
 *
 * Preferred path: ask the API for a one-time upload URL and send the file
 * straight to object storage, so it never passes through our server. Falls back
 * to posting the file to the API when that isn't available (local dev backend,
 * web preview, or the file size can't be read).
 */
export async function uploadMedia(file: UploadFile): Promise<UploadedMedia> {
  // Files are too big to keep in the offline queue: uploading needs a connection.
  if (!isOnline()) throw new OfflineRequiredError();
  const direct = await tryDirectUpload(file);
  return direct ?? uploadViaApi(file);
}

async function tryDirectUpload(file: UploadFile): Promise<UploadedMedia | null> {
  // uploadAsync only reads file:// sources (what the image picker returns).
  if (Platform.OS === 'web' || !file.uri.startsWith('file://')) {
    return null;
  }
  let ticket: UploadTicket;
  try {
    const info = await FileSystem.getInfoAsync(file.uri);
    if (!info.exists || !info.size) {
      return null;
    }
    const { data } = await api.post<UploadTicket>('/media/uploads', {
      contentType: file.type,
      sizeBytes: info.size,
      filename: file.name,
    });
    ticket = data;
  } catch (error) {
    // A real refusal (too large, unsupported type) must reach the user as is.
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 400 || status === 413) {
      throw error;
    }
    return null;
  }
  if (!ticket.direct || !ticket.uploadUrl || !ticket.key || !ticket.url) {
    return null;
  }
  const result = await FileSystem.uploadAsync(ticket.uploadUrl, file.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    // Foreground: fail when the connection drops, so the user sees an error and
    // can retry. The iOS default (background) would keep retrying silently.
    sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    headers: ticket.headers ?? { 'Content-Type': file.type },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status})`);
  }
  return { key: ticket.key, url: ticket.url, type: ticket.type };
}

async function uploadViaApi(file: UploadFile): Promise<UploadedMedia> {
  const form = new FormData();
  // React Native's FormData accepts a {uri, name, type} object for files.
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  // General media endpoint (no gym membership required) — works for profile
  // avatar/photos/certificate as well as gym uploads.
  const { data } = await api.post<UploadedMedia>('/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}

export async function createPost(
  content: string,
  media: { key: string; type: MediaType }[] = [],
): Promise<Post | Queued> {
  return offlineWrite<Post>({ method: 'post', url: '/gyms/posts', data: { content, media }, label: 'offline.label.post', invalidate: [['gymFeed'], ['post'], ['comments'], ['savedPosts']] });
}

export async function deletePost(id: number): Promise<void> {
  await offlineWrite({ method: 'delete', url: `/gyms/posts/${id}`, label: 'offline.label.postDelete', invalidate: [['gymFeed'], ['post'], ['comments'], ['savedPosts']] });
}

export async function toggleLike(id: number): Promise<{ liked: boolean; likeCount: number } | Queued> {
  return offlineWrite<{ liked: boolean; likeCount: number }>({ method: 'post', url: `/gyms/posts/${id}/like`, label: 'offline.label.like', invalidate: [['gymFeed'], ['post'], ['comments'], ['savedPosts']] });
}

export async function sharePost(id: number): Promise<{ shareCount: number } | Queued> {
  return offlineWrite<{ shareCount: number }>({ method: 'post', url: `/gyms/posts/${id}/share`, label: 'offline.label.share', invalidate: [['gymFeed'], ['post'], ['comments'], ['savedPosts']] });
}

export async function toggleSave(id: number): Promise<{ saved: boolean } | Queued> {
  return offlineWrite<{ saved: boolean }>({ method: 'post', url: `/gyms/posts/${id}/save`, label: 'offline.label.save', invalidate: [['gymFeed'], ['post'], ['comments'], ['savedPosts']] });
}

export async function getSavedPosts(): Promise<Post[]> {
  const { data } = await api.get<Post[]>('/gyms/posts/saved');
  return data;
}

export async function setPinned(id: number, pinned: boolean): Promise<Post | Queued> {
  return offlineWrite<Post>({ method: 'put', url: `/gyms/posts/${id}/pin`, data: { pinned }, label: 'offline.label.pin', invalidate: [['gymFeed'], ['post'], ['comments'], ['savedPosts']] });
}

export async function getComments(id: number): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(`/gyms/posts/${id}/comments`);
  return data;
}

export async function addComment(id: number, content: string): Promise<Comment | Queued> {
  return offlineWrite<Comment>({ method: 'post', url: `/gyms/posts/${id}/comments`, data: { content }, label: 'offline.label.comment', invalidate: [['gymFeed'], ['post'], ['comments'], ['savedPosts']] });
}
