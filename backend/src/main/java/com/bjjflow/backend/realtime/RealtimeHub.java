package com.bjjflow.backend.realtime;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import tools.jackson.databind.json.JsonMapper;

/**
 * Live connections of signed-in users, and the events pushed down them (new
 * message, new notification). Events are hints: the app reacts by refetching
 * through the normal API, so a missed event only delays an update until the
 * next poll.
 *
 * Connections live in this server's memory, so with several instances a user
 * only receives events raised on the instance they are connected to. That is
 * fine for one instance; relay events through a shared channel (e.g. Postgres
 * LISTEN/NOTIFY or Redis) before scaling out.
 */
@Service
public class RealtimeHub {

    private static final Logger log = LoggerFactory.getLogger(RealtimeHub.class);
    /** Closed when the access token it authenticated with expires; the app reconnects with a fresh one. */
    public static final CloseStatus TOKEN_EXPIRED = new CloseStatus(4001, "token expired");
    /** Time allowed between opening the socket and authenticating it. */
    static final long AUTH_GRACE_MILLIS = 10_000;

    private record Connection(WebSocketSession session, Long userId, Instant expiresAt, long openedAt) {
    }

    private final Map<String, Connection> connections = new ConcurrentHashMap<>();
    private final Map<Long, Set<String>> byUser = new ConcurrentHashMap<>();
    private final JsonMapper json;

    public RealtimeHub(JsonMapper json) {
        this.json = json;
    }

    void opened(WebSocketSession session) {
        // Thread-safe sends, with a cap so one slow client cannot back up the server.
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, 5_000, 64 * 1024);
        connections.put(session.getId(), new Connection(safe, null, null, System.currentTimeMillis()));
    }

    void authenticated(WebSocketSession session, Long userId, Instant expiresAt) {
        Connection previous = connections.get(session.getId());
        if (previous == null) {
            return;
        }
        connections.put(session.getId(), new Connection(previous.session(), userId, expiresAt, previous.openedAt()));
        byUser.computeIfAbsent(userId, id -> ConcurrentHashMap.newKeySet()).add(session.getId());
        send(previous.session(), Map.of("type", "ready"));
    }

    void closed(WebSocketSession session) {
        Connection connection = connections.remove(session.getId());
        if (connection != null && connection.userId() != null) {
            Set<String> sessions = byUser.get(connection.userId());
            if (sessions != null) {
                sessions.remove(session.getId());
                if (sessions.isEmpty()) {
                    byUser.remove(connection.userId(), sessions);
                }
            }
        }
    }

    void reply(WebSocketSession session, Map<String, Object> event) {
        Connection connection = connections.get(session.getId());
        if (connection != null) {
            send(connection.session(), event);
        }
    }

    /** Sends now. Prefer {@link #publishAfterCommit} from inside a transaction. */
    public void publish(Long userId, Map<String, Object> event) {
        Set<String> sessions = byUser.get(userId);
        if (sessions == null) {
            return;
        }
        for (String id : sessions) {
            Connection connection = connections.get(id);
            if (connection != null) {
                send(connection.session(), event);
            }
        }
    }

    /** Sends once the current transaction commits (immediately when there is none). */
    public void publishAfterCommit(Long userId, Map<String, Object> event) {
        if (userId == null) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish(userId, event);
                }
            });
        } else {
            publish(userId, event);
        }
    }

    public boolean isConnected(Long userId) {
        Set<String> sessions = byUser.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    /** Drops sockets that never authenticated, and ones whose token has expired. */
    @Scheduled(fixedDelay = 15_000)
    void sweep() {
        long now = System.currentTimeMillis();
        Instant instant = Instant.ofEpochMilli(now);
        for (Connection connection : connections.values()) {
            if (connection.userId() == null && now - connection.openedAt() > AUTH_GRACE_MILLIS) {
                close(connection.session(), CloseStatus.POLICY_VIOLATION);
            } else if (connection.expiresAt() != null && connection.expiresAt().isBefore(instant)) {
                close(connection.session(), TOKEN_EXPIRED);
            }
        }
    }

    private void send(WebSocketSession session, Map<String, Object> event) {
        if (!session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(json.writeValueAsString(event)));
        } catch (IOException | RuntimeException e) {
            log.debug("Realtime send to {} failed: {}", session.getId(), e.getMessage());
        }
    }

    static void close(WebSocketSession session, CloseStatus status) {
        try {
            session.close(status);
        } catch (IOException ignored) {
            // Already gone.
        }
    }
}
