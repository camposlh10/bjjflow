import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosError } from 'axios';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import { create } from 'zustand';

import { apiErrorMessage } from '../api/auth';
import { CreateCheckInPayload, createCheckIn } from '../api/checkins';
import { DirectMessage, sendMessage } from '../api/messages';
import { logPain } from '../api/pain';
import { t } from '../i18n';
import { queryClient } from '../queryClient';

/**
 * Writes that must survive a bad connection: chat messages and check-ins.
 *
 * Each item carries an id generated on the phone, sent to the server as
 * `clientId`. The server stores it with the row, so resending an item whose
 * first attempt actually went through (but whose response was lost) returns
 * the original instead of creating a duplicate. That makes it safe to keep
 * retrying until the server answers.
 *
 * The queue is saved on the device, so it also survives the app being closed.
 */
export type PainEntry = { region: string; intensity: number };

export type OutboxMessage = {
  kind: 'message';
  id: string;
  conversationId: number;
  content: string;
  createdAt: string;
  /** The server refused it (not a connection problem); waits for the user. */
  failed?: boolean;
};

export type OutboxCheckIn = {
  kind: 'checkin';
  id: string;
  payload: CreateCheckInPayload;
  pain: PainEntry[];
  createdAt: string;
};

export type OutboxItem = OutboxMessage | OutboxCheckIn;

type OutboxState = {
  items: OutboxItem[];
  add: (item: OutboxItem) => void;
  remove: (id: string) => void;
  setFailed: (id: string, failed: boolean) => void;
  clear: () => void;
};

const STORAGE_KEY = 'bjjflow.outbox';

export const useOutbox = create<OutboxState>()((set) => ({
  items: [],
  add: (item) => set((state) => ({ items: [...state.items, item] })),
  remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  setFailed: (id, failed) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id && i.kind === 'message' ? { ...i, failed } : i)),
    })),
  clear: () => set({ items: [] }),
}));

// Saved by hand rather than with zustand's persist middleware, whose web build
// uses `import.meta` and breaks the Expo web bundle.
let loaded = false;

function save(items: OutboxItem[]) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => undefined);
}

useOutbox.subscribe((state) => {
  if (loaded) save(state.items);
});

/** Resolves once the queue saved on the device has been loaded. */
export const outboxLoaded: Promise<void> = (async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const saved: OutboxItem[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(saved) && saved.length > 0) {
      // Keep anything added while loading, after the older saved items.
      useOutbox.setState((state) => ({
        items: [...saved.filter((s) => !state.items.some((i) => i.id === s.id)), ...state.items],
      }));
    }
  } catch {
    // Unreadable storage: start with an empty queue.
  } finally {
    loaded = true;
    save(useOutbox.getState().items);
  }
})();

export function newClientId(): string {
  return Crypto.randomUUID();
}

/**
 * True when retrying could succeed: no answer at all (offline, timeout), the
 * server failing, or rate limiting. Anything else is a real refusal.
 */
export function isRetryable(error: unknown): boolean {
  const status = (error as AxiosError).response?.status;
  return status === undefined || status >= 500 || status === 429;
}

/** Puts a chat message in the queue and starts sending it. */
export function queueMessage(conversationId: number, content: string) {
  useOutbox.getState().add({
    kind: 'message',
    id: newClientId(),
    conversationId,
    content,
    createdAt: new Date().toISOString(),
  });
  void flushOutbox();
}

export function retryMessage(id: string) {
  useOutbox.getState().setFailed(id, false);
  void flushOutbox();
}

export function discardMessage(id: string) {
  useOutbox.getState().remove(id);
}

/**
 * Sends a check-in now; if the connection fails, keeps it in the queue and
 * sends it later. A refusal from the server (e.g. invalid date) is thrown so
 * the screen can show it right away.
 */
export async function submitCheckIn(
  payload: CreateCheckInPayload,
  pain: PainEntry[] = [],
): Promise<'sent' | 'queued'> {
  const id = payload.clientId ?? newClientId();
  const item: OutboxCheckIn = {
    kind: 'checkin',
    id,
    payload: { ...payload, clientId: id },
    pain,
    createdAt: new Date().toISOString(),
  };
  try {
    await sendCheckIn(item);
    return 'sent';
  } catch (error) {
    if (!isRetryable(error)) throw error;
    useOutbox.getState().add(item);
    return 'queued';
  }
}

export function invalidateTrainingData() {
  for (const key of ['stats', 'journey', 'communityFeed', 'userSubmissions', 'painDaily', 'painMonthly', 'home']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
  queryClient.invalidateQueries({ queryKey: ['userProfile'] });
}

async function sendCheckIn(item: OutboxCheckIn) {
  await createCheckIn(item.payload);
  // Pain entries ride along once the check-in itself is in. They are not
  // idempotent, so a failure here is not retried (the check-in is what matters).
  for (const entry of item.pain) {
    try {
      await logPain(entry);
    } catch {
      break;
    }
  }
  invalidateTrainingData();
}

function addToThread(conversationId: number, saved: DirectMessage) {
  queryClient.setQueryData<DirectMessage[]>(['messages', conversationId], (old) => {
    if (!old) return old;
    if (old.some((m) => m.id === saved.id)) return old;
    return [...old, saved].sort((a, b) => a.id - b.id);
  });
}

let flushing: Promise<void> | null = null;

/** Sends everything waiting, oldest first. Stops at the first connection problem. */
export function flushOutbox(): Promise<void> {
  if (!flushing) {
    flushing = runFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function runFlush() {
  // Never send before the saved queue is in memory (it may hold older items).
  await outboxLoaded;
  // Re-read each round: items may be added or removed while we send.
  for (;;) {
    const item = useOutbox.getState().items.find((i) => !(i.kind === 'message' && i.failed));
    if (!item) return;
    try {
      if (item.kind === 'message') {
        const saved = await sendMessage(item.conversationId, item.content, item.id);
        // Add the confirmed copy and drop the pending one in the same tick (no flicker).
        addToThread(item.conversationId, saved);
        useOutbox.getState().remove(item.id);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } else {
        await sendCheckIn(item);
        useOutbox.getState().remove(item.id);
      }
    } catch (error) {
      if (isRetryable(error)) return; // try again later
      if (item.kind === 'message') {
        useOutbox.getState().setFailed(item.id, true);
      } else {
        useOutbox.getState().remove(item.id);
        Alert.alert(t('checkin.queued.rejected'), apiErrorMessage(error));
      }
    }
  }
}
