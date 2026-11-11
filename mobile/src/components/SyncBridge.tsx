import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { flushOutbox, useOutbox } from '../offline/outbox';
import { onRealtimeEvent, startRealtime, stopRealtime } from '../realtime/realtime';

const FLUSH_INTERVAL_MS = 20_000;

/**
 * Keeps the signed-in app in sync while it is in the foreground: holds the
 * realtime connection open, turns its events into cache refreshes, and sends
 * anything waiting in the offline outbox. Renders nothing.
 */
export default function SyncBridge() {
  const queryClient = useQueryClient();

  // Live connection: open while the app is in the foreground.
  useEffect(() => {
    if (AppState.currentState !== 'background') startRealtime();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startRealtime();
        void flushOutbox();
      } else if (state === 'background') {
        stopRealtime();
      }
    });
    return () => {
      subscription.remove();
      stopRealtime();
    };
  }, []);

  // Server hints -> refresh just what changed.
  useEffect(
    () =>
      onRealtimeEvent((event) => {
        if (event.type === 'ready') {
          // (Re)connected: catch up on anything missed while offline.
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          void flushOutbox();
        } else if (event.type === 'message') {
          // An open thread asks only for messages after its last one.
          queryClient.invalidateQueries({ queryKey: ['messages', event.conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        } else if (event.type === 'notification') {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          if (event.link?.startsWith('gym:')) {
            queryClient.invalidateQueries({ queryKey: ['gymFeed'] });
          }
        }
      }),
    [queryClient],
  );

  // Outbox: send on start (it waits for the saved queue to load) and keep retrying while non-empty.
  const pending = useOutbox((state) => state.items.length);
  useEffect(() => {
    void flushOutbox();
  }, []);
  useEffect(() => {
    if (pending === 0) return;
    const timer = setInterval(() => void flushOutbox(), FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pending]);

  return null;
}
