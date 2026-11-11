import { create } from 'zustand';

import { API_BASE_URL, refreshAccessToken } from '../api/client';
import { useAuthStore } from '../store/authStore';

/**
 * Live connection to the backend (`/api/v1/realtime`). The server pushes small
 * hints ("new message in conversation 12", "new notification") and the app
 * reacts by refetching through the normal API, so a missed hint only means the
 * screen updates on its next poll instead of instantly.
 *
 * Protocol: after the socket opens we send `{type:'auth', token}`; the server
 * answers `{type:'ready'}`, or closes with 4001 when the token is invalid or
 * expires, in which case we refresh the token and reconnect.
 */
export type RealtimeEvent =
  | { type: 'ready' }
  | { type: 'message'; conversationId: number; messageId: number }
  | {
      type: 'notification';
      id: number;
      notificationType: string;
      title: string;
      body?: string;
      link?: string;
    };

export const useRealtimeStatus = create<{ connected: boolean }>(() => ({ connected: false }));

const listeners = new Set<(event: RealtimeEvent) => void>();

export function onRealtimeEvent(listener: (event: RealtimeEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const PING_MS = 25_000; // keeps proxies from dropping an idle connection
const MAX_RETRY_MS = 30_000;
const TOKEN_EXPIRED = 4001;

let socket: WebSocket | null = null;
let running = false;
let retryMs = 1_000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

function socketUrl(): string {
  return `${API_BASE_URL.replace(/^http/, 'ws')}/realtime`;
}

function emit(event: RealtimeEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // One bad listener must not stop the others.
    }
  });
}

function clearTimers() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pingTimer) clearInterval(pingTimer);
  reconnectTimer = null;
  pingTimer = null;
}

function scheduleReconnect() {
  if (!running || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, retryMs);
  retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
}

function connect() {
  const token = useAuthStore.getState().accessToken;
  if (!running || !token || socket) return;

  const ws = new WebSocket(socketUrl());
  socket = ws;

  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));

  ws.onmessage = (message) => {
    let event: RealtimeEvent | { type: 'pong' };
    try {
      event = JSON.parse(String(message.data));
    } catch {
      return;
    }
    if (event.type === 'pong') return;
    if (event.type === 'ready') {
      retryMs = 1_000;
      useRealtimeStatus.setState({ connected: true });
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, PING_MS);
    }
    emit(event);
  };

  ws.onclose = async (closeEvent) => {
    if (socket === ws) socket = null;
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    useRealtimeStatus.setState({ connected: false });
    if (!running) return;
    if (closeEvent.code === TOKEN_EXPIRED) {
      try {
        // Null means the session itself is over; the app is logging out.
        if (!(await refreshAccessToken())) return;
        retryMs = 1_000;
      } catch {
        // Offline: just retry later.
      }
    }
    scheduleReconnect();
  };

  // An error is always followed by close, which handles reconnecting.
  ws.onerror = () => undefined;
}

/** Opens (and keeps reopening) the connection until {@link stopRealtime}. */
export function startRealtime() {
  if (running) return;
  running = true;
  retryMs = 1_000;
  connect();
}

export function stopRealtime() {
  running = false;
  clearTimers();
  const ws = socket;
  socket = null;
  useRealtimeStatus.setState({ connected: false });
  ws?.close();
}
