package com.bjjflow.backend.nudges;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * A member's training rhythm read from the 21 days before {@code today}: which
 * weekdays are habits, when they usually start, when they usually log (they're
 * holding the phone then), how far apart sessions are, and whether they're
 * still learning the app, active, slipping or gone quiet.
 */
public record Rhythm(
        LocalDate today,
        State state,
        int trainingDays,
        /** Bit (ISO weekday - 1) set when that weekday was trained in at least 2 of the 3 weeks. */
        int habitMask,
        /** Usual start per weekday, Monday first; null when unknown. */
        Integer[] startByWeekday,
        Integer usualStart,
        Integer usualLog,
        Integer medianGap,
        /** Their longer usual gaps (80th percentile): a Tuesday/Thursday trainer's 5 days. */
        Integer longGap,
        LocalDate lastTraining) {

    public static final int WINDOW_DAYS = 21;
    /** A weekday is a habit when trained on it in this many of the 3 weeks. */
    static final int HABIT_WEEKS = 2;
    /** Below this, there's no rhythm to read yet. */
    static final int MIN_OBSERVED_DAYS = 7;
    static final int MIN_SESSIONS = 3;

    public enum State {
        /** New, or too few sessions to know their rhythm. */
        LEARNING,
        /** Training within their usual gap. */
        ACTIVE,
        /** Past twice their usual gap: worth a gentle word. */
        LAPSING,
        /** Nothing for over 3 weeks: left alone. */
        DORMANT
    }

    /** One training day: when it likely started and when it was logged, in minutes after midnight (null = unknown). */
    public record Session(LocalDate date, Integer startMinute, Integer logMinute) {
    }

    public boolean isHabit(DayOfWeek day) {
        return (habitMask & (1 << (day.getValue() - 1))) != 0;
    }

    /** Usual start on this weekday, else their usual start overall. */
    public Integer startOn(DayOfWeek day) {
        Integer own = startByWeekday[day.getValue() - 1];
        return own != null ? own : usualStart;
    }

    public long daysSinceLast() {
        return lastTraining == null ? Long.MAX_VALUE : ChronoUnit.DAYS.between(lastTraining, today);
    }

    /**
     * Days without training after which a member counts as slipping: two more
     * than their longer usual gaps, and at least 4.
     */
    public int lapseAfter() {
        return Math.max(4, (longGap == null ? 2 : longGap) + 2);
    }

    /**
     * Reads the rhythm. {@code sessions} may include days outside the window
     * (they only count toward the last training date); {@code joinedOn} limits
     * how much history there can be.
     */
    public static Rhythm analyze(Collection<Session> sessions, LocalDate today, LocalDate joinedOn) {
        LocalDate from = today.minusDays(WINDOW_DAYS);
        Map<LocalDate, Session> byDay = new TreeMap<>();
        LocalDate last = null;
        for (Session s : sessions) {
            if (s.date().isAfter(today)) {
                continue;
            }
            if (s.date().isBefore(today) && (last == null || s.date().isAfter(last))) {
                last = s.date();
            }
            if (!s.date().isBefore(from) && s.date().isBefore(today)) {
                byDay.merge(s.date(), s, Rhythm::combine);
            }
        }

        // Weeks are the 3 blocks of 7 days before today, so every weekday appears once in each.
        int[] weeksPerWeekday = new int[7];
        boolean[][] seen = new boolean[3][7];
        List<List<Integer>> startsPerWeekday = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            startsPerWeekday.add(new ArrayList<>());
        }
        List<Integer> starts = new ArrayList<>();
        List<Integer> logs = new ArrayList<>();
        for (Session s : byDay.values()) {
            int week = (int) (ChronoUnit.DAYS.between(from, s.date()) / 7);
            int dow = s.date().getDayOfWeek().getValue() - 1;
            if (week >= 0 && week < 3 && !seen[week][dow]) {
                seen[week][dow] = true;
                weeksPerWeekday[dow]++;
            }
            if (s.startMinute() != null) {
                starts.add(s.startMinute());
                startsPerWeekday.get(dow).add(s.startMinute());
            }
            if (s.logMinute() != null) {
                logs.add(s.logMinute());
            }
        }
        int mask = 0;
        Integer[] startByWeekday = new Integer[7];
        for (int d = 0; d < 7; d++) {
            if (weeksPerWeekday[d] >= HABIT_WEEKS) {
                mask |= 1 << d;
            }
            startByWeekday[d] = median(startsPerWeekday.get(d));
        }

        List<LocalDate> dates = new ArrayList<>(byDay.keySet());
        List<Integer> gaps = new ArrayList<>();
        for (int i = 1; i < dates.size(); i++) {
            gaps.add((int) ChronoUnit.DAYS.between(dates.get(i - 1), dates.get(i)));
        }

        long observed = joinedOn == null ? WINDOW_DAYS : ChronoUnit.DAYS.between(joinedOn, today);
        Rhythm draft = new Rhythm(today, State.LEARNING, byDay.size(), mask, startByWeekday, median(starts),
                median(logs), median(gaps), percentile80(gaps), last);
        State state;
        if (observed < MIN_OBSERVED_DAYS || (byDay.size() < MIN_SESSIONS && last != null
                && !last.isBefore(from))) {
            state = State.LEARNING;
        } else if (last == null || draft.daysSinceLast() > WINDOW_DAYS) {
            state = State.DORMANT;
        } else if (draft.daysSinceLast() >= draft.lapseAfter()) {
            state = State.LAPSING;
        } else {
            state = State.ACTIVE;
        }
        return new Rhythm(today, state, byDay.size(), mask, startByWeekday, median(starts), median(logs),
                median(gaps), percentile80(gaps), last);
    }

    /** Two records of the same day: the earliest start and the first log. */
    private static Session combine(Session a, Session b) {
        return new Session(a.date(), min(a.startMinute(), b.startMinute()), min(a.logMinute(), b.logMinute()));
    }

    private static Integer min(Integer a, Integer b) {
        if (a == null) {
            return b;
        }
        return b == null ? a : Math.min(a, b);
    }

    static Integer median(List<Integer> values) {
        if (values.isEmpty()) {
            return null;
        }
        List<Integer> sorted = new ArrayList<>(values);
        sorted.sort(null);
        return sorted.get((sorted.size() - 1) / 2);
    }

    static Integer percentile80(List<Integer> values) {
        if (values.isEmpty()) {
            return null;
        }
        List<Integer> sorted = new ArrayList<>(values);
        sorted.sort(null);
        return sorted.get((int) Math.ceil(0.8 * sorted.size()) - 1);
    }

    /** "1140,,1170,…" for storage. */
    String startsAsText() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 7; i++) {
            if (i > 0) {
                sb.append(',');
            }
            if (startByWeekday[i] != null) {
                sb.append(startByWeekday[i]);
            }
        }
        return sb.toString();
    }
}
