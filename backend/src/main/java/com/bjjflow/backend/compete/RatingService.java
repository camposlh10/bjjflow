package com.bjjflow.backend.compete;

import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.checkins.CheckInRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Each member's rating: 1000 to start, +5 per training day, +5 for reaching the
 * weekly goal, and the Elo exchange of every finished match. Every change is a
 * row in rating_events, keyed so the same award is never given twice.
 */
@Service
@RequiredArgsConstructor
public class RatingService {

    static final String TRAINING = "TRAINING";
    static final String WEEKLY_GOAL = "WEEKLY_GOAL";
    static final String MATCH = "MATCH";

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final CheckInRepository checkInRepository;
    private final UserRepository userRepository;

    /**
     * Awards a training on {@code date}: the day's points the first time, and the
     * week's bonus when this day reaches the goal. Returns the rating gained (0 when
     * already awarded or logged too late).
     */
    @Transactional
    public int awardTraining(Long userId, LocalDate date) {
        LocalDate today = Compete.today(Instant.now());
        if (date.isAfter(today) || date.isBefore(today.minusDays(Compete.LATE_DAYS))) {
            return 0;
        }
        int gained = 0;
        if (record(userId, Compete.TRAINING_POINTS, TRAINING, date.toString())) {
            gained += Compete.TRAINING_POINTS;
        }
        LocalDate monday = date.with(DayOfWeek.MONDAY);
        long days = checkInRepository.countDistinctDays(userId, monday, monday.plusDays(6));
        if (days >= weeklyGoal(userId)
                && record(userId, Compete.WEEKLY_GOAL_POINTS, WEEKLY_GOAL, monday.toString())) {
            gained += Compete.WEEKLY_GOAL_POINTS;
        }
        return gained;
    }

    /** Applies a finished match's exchange to both players (once per match). */
    @Transactional
    public void applyMatch(Long matchId, Long userA, int deltaA, Long userB, int deltaB) {
        record(userA, deltaA, MATCH, "match:" + matchId);
        record(userB, deltaB, MATCH, "match:" + matchId);
    }

    /** The weekly goal the bonus is measured against (never below 2). */
    public int weeklyGoal(Long userId) {
        int goal = userRepository.findById(userId).map(User::getWeeklyGoal).orElse(3);
        return Math.max(Compete.MIN_WEEKLY_GOAL, goal);
    }

    public boolean weekBonusEarned(Long userId, LocalDate monday) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM rating_events WHERE user_id = ? AND reason = ? AND ref_key = ?",
                Integer.class, userId, WEEKLY_GOAL, monday.toString());
        return n != null && n > 0;
    }

    public int rating(Long userId) {
        return ratings(List.of(userId)).getOrDefault(userId, Compete.START_RATING);
    }

    /** Ratings for many members; anyone without a row is at the starting rating. */
    public Map<Long, Integer> ratings(Collection<Long> userIds) {
        Map<Long, Integer> out = new HashMap<>();
        if (userIds.isEmpty()) {
            return out;
        }
        for (Long id : userIds) {
            out.put(id, Compete.START_RATING);
        }
        named.query("SELECT user_id, rating FROM player_ratings WHERE user_id IN (:ids)",
                new MapSqlParameterSource("ids", userIds),
                rs -> {
                    out.put(rs.getLong(1), rs.getInt(2));
                });
        return out;
    }

    /** Rating change since the start of this month, per member (absent = 0). */
    public Map<Long, Integer> monthDeltas(Collection<Long> userIds, Instant now) {
        Map<Long, Integer> out = new HashMap<>();
        if (userIds.isEmpty()) {
            return out;
        }
        named.query("SELECT user_id, SUM(delta) FROM rating_events "
                + "WHERE user_id IN (:ids) AND created_at >= :since GROUP BY user_id",
                new MapSqlParameterSource("ids", userIds)
                        .addValue("since", Timestamp.from(Compete.monthStart(now))),
                rs -> {
                    out.put(rs.getLong(1), rs.getInt(2));
                });
        return out;
    }

    public boolean acceptsChallenges(Long userId) {
        Boolean accepts = jdbc.query("SELECT accepts_challenges FROM player_ratings WHERE user_id = ?",
                rs -> rs.next() ? rs.getBoolean(1) : null, userId);
        return accepts == null || accepts;
    }

    @Transactional
    public void setAcceptsChallenges(Long userId, boolean accepts) {
        ensureRow(userId);
        jdbc.update("UPDATE player_ratings SET accepts_challenges = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                accepts, userId);
    }

    /** Writes one rating change; false when this award was already given. */
    private boolean record(Long userId, int delta, String reason, String refKey) {
        // The unique key (user, reason, ref) makes a repeat insert a no-op, so an
        // award can't be given twice even by two requests at once.
        int inserted = jdbc.update("INSERT INTO rating_events (user_id, delta, reason, ref_key, created_at) "
                + "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING", userId, delta, reason, refKey);
        if (inserted == 0) {
            return false;
        }
        ensureRow(userId);
        jdbc.update("UPDATE player_ratings SET rating = rating + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                delta, userId);
        return true;
    }

    /** Creates the member's rating row at the starting rating if it isn't there yet. */
    private void ensureRow(Long userId) {
        jdbc.update("INSERT INTO player_ratings (user_id, rating, accepts_challenges, updated_at) "
                + "VALUES (?, ?, TRUE, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING", userId, Compete.START_RATING);
    }
}
