package com.bjjflow.backend.common.idempotency;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Remembers the outcome of writes sent with an {@code Idempotency-Key}, per
 * user, for a week. Each method runs in its own short auto-commit statement, so
 * the reservation is visible to a concurrent duplicate before the request's own
 * transaction finishes.
 */
@Service
public class IdempotencyStore {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyStore.class);
    static final Duration RETENTION = Duration.ofDays(7);
    /** A reservation older than this belongs to a request that died; it may be taken over. */
    static final Duration STALE_IN_PROGRESS = Duration.ofMinutes(2);

    /** A request seen before: either finished (replay it) or still running. */
    public record Existing(String state, String method, String path, Integer status, String contentType,
            String body, Instant createdAt) {

        boolean done() {
            return "DONE".equals(state);
        }
    }

    private final JdbcTemplate jdbc;

    public IdempotencyStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Reserves the key for this request. Empty means the caller owns it and must
     * later {@link #complete} or {@link #release} it; otherwise the earlier record.
     */
    public Optional<Existing> reserve(long userId, String key, String method, String path) {
        // ON CONFLICT DO NOTHING (rather than catching a duplicate-key error) keeps
        // any surrounding transaction usable on PostgreSQL.
        int inserted = jdbc.update("INSERT INTO idempotency_records (user_id, idem_key, method, path, state, created_at) "
                + "VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?) ON CONFLICT DO NOTHING",
                userId, key, method, path, Timestamp.from(Instant.now()));
        if (inserted == 1) {
            return Optional.empty();
        }
        Optional<Existing> existing = find(userId, key);
        if (existing.isPresent() && !existing.get().done()
                && existing.get().createdAt().isBefore(Instant.now().minus(STALE_IN_PROGRESS))) {
            // The first attempt never finished (server restarted mid-request): take over.
            int taken = jdbc.update("UPDATE idempotency_records SET created_at = ? "
                    + "WHERE user_id = ? AND idem_key = ? AND state = 'IN_PROGRESS' AND created_at = ?",
                    Timestamp.from(Instant.now()), userId, key, Timestamp.from(existing.get().createdAt()));
            if (taken == 1) {
                return Optional.empty();
            }
            return find(userId, key);
        }
        return existing;
    }

    public void complete(long userId, String key, int status, String contentType, String body) {
        jdbc.update("UPDATE idempotency_records SET state = 'DONE', status = ?, content_type = ?, response_body = ? "
                + "WHERE user_id = ? AND idem_key = ?", status, contentType, body, userId, key);
    }

    /** Forgets a reservation whose request failed on the server side, so a retry can run again. */
    public void release(long userId, String key) {
        jdbc.update("DELETE FROM idempotency_records WHERE user_id = ? AND idem_key = ? AND state = 'IN_PROGRESS'",
                userId, key);
    }

    Optional<Existing> find(long userId, String key) {
        List<Existing> rows = jdbc.query("SELECT state, method, path, status, content_type, response_body, created_at "
                + "FROM idempotency_records WHERE user_id = ? AND idem_key = ?",
                (rs, n) -> new Existing(rs.getString(1), rs.getString(2), rs.getString(3),
                        (Integer) rs.getObject(4), rs.getString(5), rs.getString(6),
                        rs.getTimestamp(7).toInstant()),
                userId, key);
        return rows.stream().findFirst();
    }

    @Scheduled(cron = "0 45 4 * * *")
    public void purgeOld() {
        int purged = jdbc.update("DELETE FROM idempotency_records WHERE created_at < ?",
                Timestamp.from(Instant.now().minus(RETENTION)));
        if (purged > 0) {
            log.info("Purged {} idempotency record(s)", purged);
        }
    }
}
