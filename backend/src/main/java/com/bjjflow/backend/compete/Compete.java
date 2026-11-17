package com.bjjflow.backend.compete;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

import com.bjjflow.backend.automations.GymZones;

/** The rules of rating and matches, in one place. */
final class Compete {

    /** The app's day boundary for trainings, rounds and months. */
    static final ZoneId ZONE = GymZones.DEFAULT;

    static final int START_RATING = 1000;
    /** Rating for each training day, and once a week for reaching the weekly goal. */
    static final int TRAINING_POINTS = 5;
    static final int WEEKLY_GOAL_POINTS = 5;
    /** The weekly bonus needs at least this many days, whatever goal is set. */
    static final int MIN_WEEKLY_GOAL = 2;
    /** A training logged more than this many days after its date earns no rating. */
    static final int LATE_DAYS = 2;
    /** Elo K-factor: equal ratings exchange K/2 = 20 for a win. */
    static final int K = 40;

    static final int ROUND_DAYS = 7;
    static final int ROUNDS_TO_WIN = 3;
    static final int MAX_ROUNDS = 5;
    /** Pending plus active matches a member can have at once. */
    static final int MAX_OPEN = 3;
    static final Duration CHALLENGE_TTL = Duration.ofHours(48);
    /**
     * A training counts in a match when logged by this time the next morning,
     * and a round is settled at this time the day after it ends.
     */
    static final LocalTime LOG_GRACE = LocalTime.of(6, 0);

    private Compete() {
    }

    static LocalDate today(Instant now) {
        return now.atZone(ZONE).toLocalDate();
    }

    static Instant settlesAt(LocalDate lastDay) {
        return lastDay.plusDays(1).atTime(LOG_GRACE).atZone(ZONE).toInstant();
    }

    static Instant monthStart(Instant now) {
        return today(now).withDayOfMonth(1).atStartOfDay(ZONE).toInstant();
    }

    /** First and last day of round {@code n} (1-based) of a match that starts on {@code startsOn}. */
    static LocalDate roundStart(LocalDate startsOn, int n) {
        return startsOn.plusDays((long) (n - 1) * ROUND_DAYS);
    }

    static LocalDate roundEnd(LocalDate startsOn, int n) {
        return roundStart(startsOn, n).plusDays(ROUND_DAYS - 1);
    }

    /**
     * Rating change for player A against B (B's change is the negative).
     * {@code scoreA} is 1 for a win, 0.5 for a draw, 0 for a loss.
     */
    static int elo(int ratingA, int ratingB, double scoreA) {
        double expectedA = 1.0 / (1.0 + Math.pow(10, (ratingB - ratingA) / 400.0));
        return (int) Math.round(K * (scoreA - expectedA));
    }
}
