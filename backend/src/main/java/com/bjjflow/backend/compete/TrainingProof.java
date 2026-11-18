package com.bjjflow.backend.compete;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.TreeMap;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * The training days that count in a match. A day counts when the gym confirmed
 * it (class attendance marked PRESENT, by the app, staff or a device) or the
 * member logged it with a photo by 06:00 the next morning, so a week can't be
 * filled in after the fact.
 */
@Component
@RequiredArgsConstructor
class TrainingProof {

    /** One counted day; {@code photoKey} is the logged photo, {@code gym} true when the gym confirmed it. */
    record ProvenDay(LocalDate date, String photoKey, boolean gym) {
    }

    private final JdbcTemplate jdbc;

    List<ProvenDay> days(Long userId, LocalDate from, LocalDate to) {
        TreeMap<LocalDate, ProvenDay> out = new TreeMap<>();
        if (to.isBefore(from)) {
            return List.of();
        }
        // Photo trainings logged by 06:00 the next morning (checked here rather than
        // in SQL so the same query runs on PostgreSQL and the H2 dev database).
        jdbc.query("""
                SELECT check_date, photo_key, created_at FROM check_ins
                WHERE user_id = ? AND check_date BETWEEN ? AND ? AND photo_key IS NOT NULL
                ORDER BY check_date, created_at
                """,
                rs -> {
                    LocalDate d = rs.getDate(1).toLocalDate();
                    java.sql.Timestamp created = rs.getTimestamp(3);
                    if (created == null || !created.toInstant().isBefore(Compete.settlesAt(d))) {
                        return;
                    }
                    out.putIfAbsent(d, new ProvenDay(d, rs.getString(2), false));
                },
                userId, Date.valueOf(from), Date.valueOf(to));
        jdbc.query("""
                SELECT DISTINCT class_date FROM class_attendances
                WHERE user_id = ? AND status = 'PRESENT' AND class_date BETWEEN ? AND ?
                """,
                rs -> {
                    LocalDate d = rs.getDate(1).toLocalDate();
                    ProvenDay photo = out.get(d);
                    out.put(d, new ProvenDay(d, photo == null ? null : photo.photoKey(), true));
                },
                userId, Date.valueOf(from), Date.valueOf(to));
        return List.copyOf(out.values());
    }

    int count(Long userId, LocalDate from, LocalDate to) {
        return days(userId, from, to).size();
    }
}
