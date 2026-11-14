import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Connectivity, as one source of truth for the whole app. React Query reads it
 * (`onlineManager`): while offline, queries pause and keep showing cached data,
 * and they refetch on their own when the connection returns.
 *
 * "Online" means connected and not known to be cut off from the internet
 * (`isInternetReachable === false` covers Wi-Fi without internet).
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && state.isInternetReachable !== false);
  }),
);

export function isOnline(): boolean {
  return onlineManager.isOnline();
}

/** Calls `listener` every time connectivity changes. Returns an unsubscribe function. */
export function onConnectivityChange(listener: (online: boolean) => void): () => void {
  return onlineManager.subscribe((online) => listener(online));
}

/** Re-renders when connectivity changes. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (notify) => onlineManager.subscribe(() => notify()),
    () => onlineManager.isOnline(),
    () => true,
  );
}
