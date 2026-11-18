import type { QueryClient } from '@tanstack/react-query';

/** A member's public look, as the server announces it when it changes. */
export type PersonUpdate = {
  userId: number;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
};

/**
 * Whether `value` is this member as shown somewhere in the app: any object
 * with an avatarUrl whose id (or userId) is theirs. That covers feed authors,
 * ranking and match players, profiles, search results, conversation partners
 * and gym members, without each screen having to know about the others.
 */
function isPerson(value: Record<string, unknown>, userId: number): boolean {
  return 'avatarUrl' in value && (value.id === userId || value.userId === userId);
}

/** Returns `value` with the member's details replaced, or the same reference when nothing changed. */
function patch(value: unknown, u: PersonUpdate): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = patch(item, u);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? out : value;
  }
  if (value === null || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  if (isPerson(obj, u.userId)) {
    const next: Record<string, unknown> = { ...obj, avatarUrl: u.avatarUrl };
    if ('bannerUrl' in obj && u.bannerUrl !== undefined) next.bannerUrl = u.bannerUrl;
    if ('displayName' in obj && u.displayName) next.displayName = u.displayName;
    if ('username' in obj && u.username !== undefined) next.username = u.username;
    out = next;
  }
  for (const key of Object.keys(obj)) {
    const child = obj[key];
    if (child === null || typeof child !== 'object') continue;
    const next = patch(child, u);
    if (next !== child) {
      out = out ?? { ...obj };
      out[key] = next;
    }
  }
  return out ?? value;
}

/**
 * Puts a member's new picture (and name) everywhere it's on screen right now:
 * every cached query is patched in place, so lists update without refetching,
 * then their profile is refetched for what can't be patched (photo gallery).
 */
export function applyPersonUpdate(queryClient: QueryClient, update: PersonUpdate) {
  for (const query of queryClient.getQueryCache().getAll()) {
    const data = query.state.data;
    if (data === undefined) continue;
    const next = patch(data, update);
    if (next !== data) queryClient.setQueryData(query.queryKey, next);
  }
  queryClient.invalidateQueries({ queryKey: ['userProfile', update.userId] });
}
