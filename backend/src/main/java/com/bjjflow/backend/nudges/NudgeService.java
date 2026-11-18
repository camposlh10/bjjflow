package com.bjjflow.backend.nudges;

import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.automations.GymZones;
import com.bjjflow.backend.compete.MatchService;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.jobs.JobQueue;
import com.bjjflow.backend.notifications.PushJobHandler;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Smart reminders: each morning (from 05:00 the member's time) reads their
 * rhythm and plans at most one push for the day; when the time comes it checks
 * again that the reminder still makes sense (not trained yet, nothing else
 * just sent) and sends it to their phone only, never to the in-app center.
 */
@Service
@RequiredArgsConstructor
public class NudgeService {

    public static final String PLANNED = "PLANNED";
    public static final String SENT = "SENT";
    public static final String SKIPPED = "SKIPPED";
    public static final String NONE = "NONE";

    /** Planning starts at this local time. */
    static final LocalTime PLAN_FROM = LocalTime.of(5, 0);
    /** A planned push this late is dropped rather than sent off-time. */
    static final Duration LATE_AFTER = Duration.ofMinutes(45);
    /** Another training push (class reminder, gym nudge) this recent cancels ours. */
    static final Duration RECENT_PUSH = Duration.ofHours(3);
    /** Training within this long after a push counts as answering it. */
    static final Duration ANSWER_WINDOW = Duration.ofHours(12);
    /** History read for the rhythm and the weekly goal. */
    private static final int HISTORY_DAYS = 28;

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final GymMemberRepository gymMemberRepository;
    private final GymZones gymZones;
    private final MatchService matchService;
    private final JobQueue jobQueue;

    /** Members who may get smart reminders: on, with a phone registered, and with their own login. */
    public List<Long> candidates() {
        return jdbc.queryForList("""
                SELECT DISTINCT u.id FROM users u JOIN push_tokens p ON p.user_id = u.id
                WHERE u.smart_reminders = TRUE AND (u.managed IS NULL OR u.managed = FALSE)
                """, Long.class);
    }

    public ZoneId zoneOf(Long userId) {
        return gymMemberRepository.findFirstByUserId(userId).map(GymMember::getGymId).map(gymZones::zoneOf)
                .orElse(GymZones.DEFAULT);
    }

    /**
     * Plans the member's day if it's past 05:00 for them and not planned yet.
     * Returns the plan made (empty when nothing was planned or it was already).
     */
    @Transactional
    public Optional<NudgePlanner.Plan> planIfDue(Long userId, Instant now) {
        ZoneId zone = zoneOf(userId);
        ZonedDateTime local = now.atZone(zone);
        LocalDate today = local.toLocalDate();
        if (local.toLocalTime().isBefore(PLAN_FROM) || alreadyPlanned(userId, today)) {
            return Optional.empty();
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Optional.empty();
        }

        List<Rhythm.Session> sessions = sessions(userId, today, zone);
        LocalDate joined = user.getCreatedAt() == null ? null : user.getCreatedAt().atZone(zone).toLocalDate();
        Rhythm rhythm = Rhythm.analyze(sessions, today, joined);
        saveRhythm(userId, rhythm, zone);

        Set<LocalDate> days = new HashSet<>();
        sessions.forEach(s -> days.add(s.date()));
        int goal = user.getWeeklyGoal() == null ? 3 : user.getWeeklyGoal();
        LocalDate monday = today.with(DayOfWeek.MONDAY);
        int doneThisWeek = (int) days.stream().filter(d -> !d.isBefore(monday) && d.isBefore(today)).count();
        boolean reachedRecently = false;
        for (int w = 1; w <= 3; w++) {
            LocalDate start = monday.minusWeeks(w);
            long count = days.stream().filter(d -> !d.isBefore(start) && d.isBefore(start.plusDays(7))).count();
            reachedRecently |= goal >= 2 && count >= goal;
        }

        NudgePlanner.MatchRound match = matchService.currentRound(userId, today)
                .map(r -> new NudgePlanner.MatchRound(r.opponentFirstName(), r.myDays(), r.theirDays(), r.endsOn()))
                .orElse(null);
        NudgePlanner.Context context = new NudgePlanner.Context(rhythm,
                user.getCurrentStreak() == null ? 0 : user.getCurrentStreak(), goal, doneThisWeek, reachedRecently,
                days.contains(today.minusDays(7)), match, gymClassNear(userId, today, rhythm), history(userId, now, zone));

        Optional<NudgePlanner.Plan> plan = NudgePlanner.plan(context);
        if (plan.isEmpty()) {
            insert(userId, today, "NONE", NONE, null, null, null);
            return Optional.empty();
        }
        NudgePlanner.Plan p = plan.get();
        Instant sendAt = today.atTime(p.at()).atZone(zone).toInstant();
        if (now.isAfter(sendAt.plus(LATE_AFTER))) {
            // Planned too late in the day (e.g. the phone was just registered): skip today.
            insert(userId, today, p.kind().name(), NONE, null, null, null);
            return Optional.empty();
        }
        insert(userId, today, p.kind().name(), PLANNED, sendAt, p.title(), p.body());
        return plan;
    }

    /** Sends every planned reminder whose time has come, if it still makes sense. Returns how many were sent. */
    @Transactional
    public int dispatchDue(Instant now) {
        List<Map<String, Object>> due = jdbc.queryForList(
                "SELECT id, user_id, local_date, kind, send_at, title, body FROM nudges "
                        + "WHERE status = ? AND send_at <= ? ORDER BY send_at",
                PLANNED, Timestamp.from(now));
        int sent = 0;
        for (Map<String, Object> row : due) {
            long id = ((Number) row.get("id")).longValue();
            Long userId = ((Number) row.get("user_id")).longValue();
            Instant sendAt = instantOf(row.get("send_at"));
            LocalDate day = dateOf(row.get("local_date"));
            String reason = skipReason(userId, day, String.valueOf(row.get("kind")), sendAt, now);
            if (reason != null) {
                jdbc.update("UPDATE nudges SET status = ?, skip_reason = ? WHERE id = ?", SKIPPED, reason, id);
                continue;
            }
            Map<String, Object> push = new HashMap<>();
            push.put("userId", userId);
            push.put("title", row.get("title"));
            push.put("body", row.get("body"));
            jobQueue.enqueue(PushJobHandler.TYPE, push);
            jdbc.update("UPDATE nudges SET status = ?, sent_at = ? WHERE id = ?", SENT, Timestamp.from(now), id);
            sent++;
        }
        return sent;
    }

    /** Why a due reminder shouldn't go out now, or null to send it. */
    private String skipReason(Long userId, LocalDate day, String kind, Instant sendAt, Instant now) {
        if (now.isAfter(sendAt.plus(LATE_AFTER))) {
            return "LATE";
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || Boolean.FALSE.equals(user.getSmartReminders())) {
            return "OFF";
        }
        if (trainedOn(userId, day)) {
            return "TRAINED";
        }
        Integer recent = jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'TRAINING' "
                + "AND created_at >= ?", Integer.class, userId, Timestamp.from(now.minus(RECENT_PUSH)));
        if (recent != null && recent > 0) {
            return "RECENT_PUSH";
        }
        if (NudgePlanner.Kind.MATCH.name().equals(kind) && matchService.currentRound(userId, day).isEmpty()) {
            return "NO_MATCH";
        }
        return null;
    }

    // ---------------------------------------------------------------- data

    /** PostgreSQL hands back Timestamp and Date; H2 (dev) OffsetDateTime and LocalDate. */
    static Instant instantOf(Object value) {
        if (value instanceof Timestamp ts) {
            return ts.toInstant();
        }
        if (value instanceof java.time.OffsetDateTime odt) {
            return odt.toInstant();
        }
        return (Instant) value;
    }

    static LocalDate dateOf(Object value) {
        return value instanceof Date d ? d.toLocalDate() : (LocalDate) value;
    }

    /** Training days in the last 4 weeks (plus the last one before that), with start and log times when known. */
    List<Rhythm.Session> sessions(Long userId, LocalDate today, ZoneId zone) {
        LocalDate from = today.minusDays(HISTORY_DAYS);
        List<Rhythm.Session> out = new ArrayList<>();
        jdbc.query("SELECT check_date, created_at, duration_minutes FROM check_ins "
                + "WHERE user_id = ? AND check_date BETWEEN ? AND ?", rs -> {
                    LocalDate date = rs.getDate(1).toLocalDate();
                    Timestamp created = rs.getTimestamp(2);
                    int duration = rs.getObject(3) == null ? 60 : rs.getInt(3);
                    Integer log = null;
                    Integer start = null;
                    if (created != null) {
                        ZonedDateTime at = created.toInstant().atZone(zone);
                        // Only a same-day log says when they trained and when they reach for the phone.
                        if (at.toLocalDate().equals(date)) {
                            log = at.getHour() * 60 + at.getMinute();
                            int guess = log - duration;
                            start = guess >= 5 * 60 ? guess : null;
                        }
                    }
                    out.add(new Rhythm.Session(date, start, log));
                }, userId, Date.valueOf(from), Date.valueOf(today));
        jdbc.query("""
                SELECT a.class_date, c.start_time FROM class_attendances a JOIN gym_classes c ON c.id = a.gym_class_id
                WHERE a.user_id = ? AND a.status IN ('PRESENT', 'LATE') AND a.class_date BETWEEN ? AND ?
                """, rs -> {
            Time start = rs.getTime(2);
            out.add(new Rhythm.Session(rs.getDate(1).toLocalDate(),
                    start == null ? null : start.toLocalTime().toSecondOfDay() / 60, null));
        }, userId, Date.valueOf(from), Date.valueOf(today));
        // The last training before the window, so a long absence is still seen.
        Date older = jdbc.queryForObject("SELECT MAX(check_date) FROM check_ins WHERE user_id = ? AND check_date < ?",
                Date.class, userId, Date.valueOf(from));
        if (older != null) {
            out.add(new Rhythm.Session(older.toLocalDate(), null, null));
        }
        return out;
    }

    private boolean trainedOn(Long userId, LocalDate day) {
        Integer n = jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM check_ins WHERE user_id = ? AND check_date = ?)
                     + (SELECT COUNT(*) FROM class_attendances WHERE user_id = ? AND class_date = ?
                          AND status IN ('PRESENT', 'LATE'))
                """, Integer.class, userId, Date.valueOf(day), userId, Date.valueOf(day));
        return n != null && n > 0;
    }

    /** A class at their gym today starting within 45 minutes of their usual time. */
    private NudgePlanner.GymClass gymClassNear(Long userId, LocalDate today, Rhythm rhythm) {
        Integer usual = rhythm.startOn(today.getDayOfWeek());
        Long gymId = gymMemberRepository.findFirstByUserId(userId).map(GymMember::getGymId).orElse(null);
        if (usual == null || gymId == null) {
            return null;
        }
        NudgePlanner.GymClass best = null;
        int bestDistance = 46;
        for (Map<String, Object> row : jdbc.queryForList("SELECT name, start_time FROM gym_classes "
                + "WHERE gym_id = ? AND day_of_week = ? AND active = TRUE", gymId, today.getDayOfWeek().getValue())) {
            Object raw = row.get("start_time");
            LocalTime start = raw instanceof Time t ? t.toLocalTime() : (LocalTime) raw;
            int distance = Math.abs(start.toSecondOfDay() / 60 - usual);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = new NudgePlanner.GymClass(String.valueOf(row.get("name")), start);
            }
        }
        return best;
    }

    /** Reminders sent recently, and how many of the latest went unanswered (no training within 12 hours). */
    NudgePlanner.History history(Long userId, Instant now, ZoneId zone) {
        List<Instant> sent = jdbc.queryForList("SELECT sent_at FROM nudges WHERE user_id = ? AND status = ? "
                + "ORDER BY sent_at DESC", Timestamp.class, userId, SENT).stream()
                .limit(10).map(Timestamp::toInstant).toList();
        int last7 = (int) sent.stream().filter(t -> t.isAfter(now.minus(7, ChronoUnit.DAYS))).count();
        int ignored = 0;
        for (Instant at : sent) {
            Integer answered = jdbc.queryForObject("""
                    SELECT (SELECT COUNT(*) FROM check_ins WHERE user_id = ? AND created_at BETWEEN ? AND ?)
                         + (SELECT COUNT(*) FROM class_attendances WHERE user_id = ? AND created_at BETWEEN ? AND ?)
                    """, Integer.class, userId, Timestamp.from(at), Timestamp.from(at.plus(ANSWER_WINDOW)),
                    userId, Timestamp.from(at), Timestamp.from(at.plus(ANSWER_WINDOW)));
            if (answered != null && answered > 0) {
                break;
            }
            ignored++;
        }
        LocalDate lastSentOn = sent.isEmpty() ? null : sent.get(0).atZone(zone).toLocalDate();
        return new NudgePlanner.History(last7, lastSentOn, ignored);
    }

    private boolean alreadyPlanned(Long userId, LocalDate day) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM nudges WHERE user_id = ? AND local_date = ?",
                Integer.class, userId, Date.valueOf(day));
        return n != null && n > 0;
    }

    private void insert(Long userId, LocalDate day, String kind, String status, Instant sendAt, String title,
            String body) {
        jdbc.update("INSERT INTO nudges (user_id, local_date, kind, status, send_at, title, body, created_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", userId, Date.valueOf(day), kind, status,
                sendAt == null ? null : Timestamp.from(sendAt), title, body, Timestamp.from(Instant.now()));
    }

    private void saveRhythm(Long userId, Rhythm r, ZoneId zone) {
        jdbc.update("DELETE FROM user_rhythms WHERE user_id = ?", userId);
        jdbc.update("INSERT INTO user_rhythms (user_id, computed_on, state, training_days, habit_mask, start_minutes, "
                + "usual_start, usual_log, median_gap, long_gap, last_training, zone) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                userId, Date.valueOf(r.today()), r.state().name(), r.trainingDays(), r.habitMask(), r.startsAsText(),
                r.usualStart(), r.usualLog(), r.medianGap(), r.longGap(),
                r.lastTraining() == null ? null : Date.valueOf(r.lastTraining()), zone.getId());
    }
}
