import type { QueryKey } from '@tanstack/react-query';

import { api } from '../api/client';
import { t, TranslationKey } from '../i18n';
import { isOnline } from './network';
import { flushOutbox, isRetryable, newClientId, outboxHasPending, useOutbox } from './outbox';

/**
 * Every write the app makes goes through one of two helpers:
 *
 * - `offlineWrite`: changes that can wait (likes, comments, attendance, notes,
 *   profile edits…). Sent at once when possible; otherwise saved in the outbox
 *   and resolved with `QUEUED`, and sent later in order. Each carries an
 *   `Idempotency-Key`, so a resend after a lost response is applied only once.
 * - `onlineWrite`: things that need the server's answer right away (sign-in,
 *   joining a gym, payments, uploads). Offline, they fail immediately with a
 *   clear message instead of waiting for a timeout.
 *
 * Callers of `offlineWrite` get `T | Queued` and must handle both (the type
 * system enforces it): show the change optimistically and let the queue confirm.
 */
export const QUEUED = Object.freeze({ __queued: true as const });
export type Queued = typeof QUEUED;

export function isQueued(value: unknown): value is Queued {
  return typeof value === 'object' && value !== null && (value as { __queued?: unknown }).__queued === true;
}

export class OfflineRequiredError extends Error {
  readonly offlineRequired = true;
  constructor() {
    super(t('offline.required'));
  }
}

export function isOfflineRequired(error: unknown): error is OfflineRequiredError {
  return typeof error === 'object' && error !== null && (error as { offlineRequired?: unknown }).offlineRequired === true;
}

export type WriteRequest = {
  method: 'post' | 'put' | 'patch' | 'delete';
  url: string;
  data?: unknown;
  /** Shown in the sync list if the server later refuses it. */
  label: TranslationKey;
  /** Cached queries to refresh once the server has applied it. */
  invalidate?: QueryKey[];
};

export async function offlineWrite<T>(request: WriteRequest): Promise<T | Queued> {
  const id = newClientId();
  const enqueue = (): Queued => {
    useOutbox.getState().add({
      kind: 'request',
      id,
      method: request.method,
      url: request.url,
      data: request.data,
      label: request.label,
      invalidate: request.invalidate ?? [],
      createdAt: new Date().toISOString(),
    });
    return QUEUED;
  };

  if (!isOnline()) {
    return enqueue();
  }
  // Earlier changes are still waiting: keep the order (e.g. create, then delete).
  if (outboxHasPending()) {
    enqueue();
    void flushOutbox();
    return QUEUED;
  }
  try {
    const { data } = await api.request<T>({
      method: request.method,
      url: request.url,
      data: request.data,
      headers: { 'Idempotency-Key': id },
    });
    return data;
  } catch (error) {
    if (isRetryable(error)) {
      return enqueue();
    }
    throw error;
  }
}

export async function onlineWrite<T>(request: Omit<WriteRequest, 'label' | 'invalidate'>): Promise<T> {
  if (!isOnline()) {
    throw new OfflineRequiredError();
  }
  const { data } = await api.request<T>({ method: request.method, url: request.url, data: request.data });
  return data;
}
