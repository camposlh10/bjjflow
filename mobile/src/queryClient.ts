import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

// Bump when a cached response SHAPE changes incompatibly — invalidates old caches.
export const CACHE_BUSTER = 'v1';
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cached data is "fresh" for 30s (instant re-entry); kept 24h so it survives
      // app restarts (the persister restores it instantly, then revalidates).
      staleTime: 30_000,
      gcTime: CACHE_MAX_AGE,
      // One quick retry absorbs transient blips, then fail fast (no 30s spins).
      retry: 1,
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 3000),
      refetchOnReconnect: 'always',
      refetchOnWindowFocus: false,
    },
  },
});

/** Writes the in-memory cache to AsyncStorage so it can be restored on next launch. */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'bjjflow.rq-cache',
  throttleTime: 1000,
});

/** Wipe in-memory + persisted cache — call on logout so the next user starts clean. */
export async function clearPersistedCache() {
  queryClient.clear();
  try {
    await asyncStoragePersister.removeClient();
  } catch {
    // ignore — storage may be unavailable
  }
}
