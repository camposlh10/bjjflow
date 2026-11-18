package com.bjjflow.backend.compete;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

/**
 * Who a member doesn't want challenges from: silenced for {@link #SILENCE}, or
 * blocked until they lift it. The challenger is only told the member isn't
 * accepting challenges, never that they were blocked.
 */
@Component
@RequiredArgsConstructor
class ChallengeBlocks {

    static final Duration SILENCE = Duration.ofDays(7);

    record Block(Long userId, Instant until) {
    }

    private final JdbcTemplate jdbc;

    /** True when {@code target} has silenced or blocked {@code challenger} right now. */
    boolean blocks(Long target, Long challenger) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM challenge_blocks WHERE user_id = ? AND blocked_user_id = ? "
                        + "AND (blocked_until IS NULL OR blocked_until > ?)",
                Integer.class, target, challenger, Timestamp.from(Instant.now()));
        return n != null && n > 0;
    }

    /** Silences (until {@code until}) or blocks ({@code until} null), replacing any earlier choice. */
    @Transactional
    void set(Long userId, Long blockedUserId, Instant until) {
        jdbc.update("DELETE FROM challenge_blocks WHERE user_id = ? AND blocked_user_id = ?", userId, blockedUserId);
        jdbc.update("INSERT INTO challenge_blocks (user_id, blocked_user_id, blocked_until, created_at) "
                + "VALUES (?, ?, ?, ?)", userId, blockedUserId, until == null ? null : Timestamp.from(until),
                Timestamp.from(Instant.now()));
    }

    @Transactional
    void remove(Long userId, Long blockedUserId) {
        jdbc.update("DELETE FROM challenge_blocks WHERE user_id = ? AND blocked_user_id = ?", userId, blockedUserId);
    }

    /** The member's current silences and blocks, newest first (expired silences left out). */
    List<Block> list(Long userId) {
        List<Block> out = new ArrayList<>();
        jdbc.query("SELECT blocked_user_id, blocked_until FROM challenge_blocks WHERE user_id = ? "
                + "AND (blocked_until IS NULL OR blocked_until > ?) ORDER BY created_at DESC",
                rs -> {
                    Timestamp until = rs.getTimestamp(2);
                    out.add(new Block(rs.getLong(1), until == null ? null : until.toInstant()));
                },
                userId, Timestamp.from(Instant.now()));
        return out;
    }
}
