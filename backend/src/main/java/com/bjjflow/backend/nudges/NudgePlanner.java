package com.bjjflow.backend.nudges;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

/**
 * Chooses at most one phone reminder for a member's day, and when to send it.
 * Pure: everything it needs comes in {@link Context}, so the rules are easy to
 * read and to test.
 *
 * <p>The rules, most important first; the first that applies wins:
 * <ol>
 * <li>MATCH: a match round ends today or tomorrow and is within one day either way.</li>
 * <li>STREAK: a run of 3+ days ends tonight unless they train.</li>
 * <li>GOAL: they usually reach their weekly goal and today is the last day it's still possible.</li>
 * <li>HABIT: today is one of their usual days and they're slipping (missed it last week, or behind on the week).</li>
 * <li>COMEBACK: two days past their longer usual gaps without training (once then, once at 10 and at 21 days).</li>
 * </ol>
 *
 * <p>And the limits that keep it quiet: nothing for members still being learned
 * (except MATCH / STREAK / GOAL, which need no history), at most 3 a week, 1 a
 * week after two ignored in a row, none for 14 days after three ignored in a row,
 * never two days running (except MATCH / STREAK), and only between 08:00 and 21:30.
 */
public final class NudgePlanner {

    public enum Kind { MATCH, STREAK, GOAL, HABIT, COMEBACK }

    static final int WEEKLY_CAP = 3;
    static final int FATIGUED_CAP = 1;
    static final int PAUSE_DAYS = 14;
    static final LocalTime EARLIEST = LocalTime.of(8, 0);
    static final LocalTime LATEST = LocalTime.of(21, 30);
    /** How long before their usual start a training-day reminder goes out. */
    static final int LEAD_MINUTES = 75;

    /** The member's open match round, seen from their side. */
    public record MatchRound(String opponent, int myDays, int theirDays, LocalDate endsOn) {
    }

    /** A class at their gym today close to their usual start. */
    public record GymClass(String name, LocalTime start) {
    }

    /** Recent reminders: how many sent in the last 7 days, when the last went out, and how many in a row went unanswered. */
    public record History(int sentLast7Days, LocalDate lastSentOn, int ignoredInARow) {
    }

    public record Context(
            Rhythm rhythm,
            int streak,
            int weeklyGoal,
            /** Distinct days trained this week before today. */
            int doneThisWeek,
            /** Whether they reached the goal in any of the last 3 full weeks. */
            boolean reachedGoalRecently,
            /** Whether they trained on today's weekday last week. */
            boolean trainedSameDayLastWeek,
            MatchRound match,
            GymClass gymClass,
            History history) {
    }

    public record Plan(Kind kind, LocalTime at, String title, String body) {
    }

    private NudgePlanner() {
    }

    public static Optional<Plan> plan(Context c) {
        Rhythm r = c.rhythm();
        LocalDate today = r.today();
        History h = c.history();

        // Three ignored in a row: leave them alone for two weeks.
        if (h.ignoredInARow() >= 3 && h.lastSentOn() != null && h.lastSentOn().plusDays(PAUSE_DAYS).isAfter(today)) {
            return Optional.empty();
        }
        int cap = h.ignoredInARow() >= 2 ? FATIGUED_CAP : WEEKLY_CAP;
        if (h.sentLast7Days() >= cap) {
            return Optional.empty();
        }
        boolean sentYesterday = today.minusDays(1).equals(h.lastSentOn());

        Optional<Plan> plan = match(c).or(() -> streak(c));
        if (plan.isPresent()) {
            return plan;
        }
        if (sentYesterday) {
            return Optional.empty();
        }
        plan = goal(c);
        if (plan.isPresent() || r.state() == Rhythm.State.LEARNING) {
            return plan;
        }
        return habit(c).or(() -> comeback(c));
    }

    private static Optional<Plan> match(Context c) {
        MatchRound m = c.match();
        LocalDate today = c.rhythm().today();
        if (m == null || m.endsOn().isBefore(today) || m.endsOn().isAfter(today.plusDays(1))
                || Math.abs(m.myDays() - m.theirDays()) > 1) {
            return Optional.empty();
        }
        boolean lastDay = m.endsOn().equals(today);
        String score = m.myDays() + "×" + m.theirDays();
        String title = lastDay ? "A rodada fecha hoje" : "A rodada fecha amanhã";
        String body = m.myDays() == m.theirDays()
                ? "Você e " + m.opponent() + " estão " + score + ". Um treino hoje desempata."
                : m.myDays() > m.theirDays()
                        ? "Você lidera " + score + " contra " + m.opponent() + ". Um treino hoje garante a vantagem."
                        : m.opponent() + " está na frente, " + score + ". Um treino hoje empata.";
        return Optional.of(new Plan(Kind.MATCH, beforeTraining(c, LocalTime.of(12, 0)), title, body));
    }

    private static Optional<Plan> streak(Context c) {
        Rhythm r = c.rhythm();
        if (c.streak() < 3 || !r.today().minusDays(1).equals(r.lastTraining())) {
            return Optional.empty();
        }
        // Evening, a little before they usually log: late enough to matter, early enough to act.
        LocalTime at = r.usualLog() == null ? LocalTime.of(19, 0)
                : clamp(LocalTime.ofSecondOfDay((long) r.usualLog() * 60).minusMinutes(90),
                        LocalTime.of(17, 0), LocalTime.of(20, 30));
        return Optional.of(new Plan(Kind.STREAK, at, "Sequência de " + c.streak() + " dias",
                "Ela continua se você treinar hoje."));
    }

    private static Optional<Plan> goal(Context c) {
        LocalDate today = c.rhythm().today();
        int needed = c.weeklyGoal() - c.doneThisWeek();
        int daysLeft = DayOfWeek.SUNDAY.getValue() - today.getDayOfWeek().getValue() + 1;
        if (c.weeklyGoal() < 2 || !c.reachedGoalRecently() || needed <= 0 || needed > 3 || daysLeft != needed) {
            return Optional.empty();
        }
        String title = needed == 1 ? "Último dia para a meta" : "A meta da semana ainda dá";
        String body = needed == 1
                ? "Um treino hoje fecha a semana em " + c.weeklyGoal() + " de " + c.weeklyGoal() + "."
                : "Faltam " + needed + " treinos e " + needed + " dias. O de hoje conta.";
        return Optional.of(new Plan(Kind.GOAL, beforeTraining(c, LocalTime.of(12, 0)), title, body));
    }

    private static Optional<Plan> habit(Context c) {
        Rhythm r = c.rhythm();
        DayOfWeek day = r.today().getDayOfWeek();
        if (r.state() != Rhythm.State.ACTIVE || !r.isHabit(day) || r.startOn(day) == null) {
            return Optional.empty();
        }
        // Only when the habit is slipping: a reminder for something they'd do anyway is noise.
        int habitDaysSoFar = Integer.bitCount(r.habitMask() & ((1 << (day.getValue() - 1)) - 1));
        boolean behind = c.doneThisWeek() < habitDaysSoFar;
        if (c.trainedSameDayLastWeek() && !behind) {
            return Optional.empty();
        }
        String weekday = WEEKDAYS[day.getValue() - 1];
        LocalTime usual = LocalTime.ofSecondOfDay((long) r.startOn(day) * 60);
        GymClass g = c.gymClass();
        String title = g != null ? g.name() + " às " + hhmm(g.start()) : "Hoje é dia de treino";
        String body = g != null
                ? weekday + " costuma ser dia de tatame pra você."
                : "Você costuma treinar " + weekdayPhrase(day) + " por volta das " + hhmm(usual) + ".";
        LocalTime start = g != null ? g.start() : usual;
        return Optional.of(new Plan(Kind.HABIT, clamp(start.minusMinutes(LEAD_MINUTES), EARLIEST, LATEST), title,
                body));
    }

    private static Optional<Plan> comeback(Context c) {
        Rhythm r = c.rhythm();
        if (r.state() != Rhythm.State.LAPSING) {
            return Optional.empty();
        }
        long days = r.daysSinceLast();
        if (days != r.lapseAfter() && days != 10 && days != 21) {
            return Optional.empty();
        }
        LocalTime at = r.usualLog() == null ? LocalTime.of(18, 30)
                : clamp(LocalTime.ofSecondOfDay((long) r.usualLog() * 60).minusMinutes(60), LocalTime.of(11, 0),
                        LocalTime.of(20, 0));
        String title = days >= 21 ? "Seu lugar no tatame continua lá" : days + " dias sem treinar";
        String body = days >= 21 ? "Quando quiser voltar, um treino leve já recomeça o ritmo."
                : "Um treino essa semana já coloca o ritmo de volta.";
        return Optional.of(new Plan(Kind.COMEBACK, at, title, body));
    }

    /** Before their usual start today (or the fallback), within the allowed hours. */
    private static LocalTime beforeTraining(Context c, LocalTime fallback) {
        Integer start = c.rhythm().startOn(c.rhythm().today().getDayOfWeek());
        LocalTime at = start == null ? fallback : LocalTime.ofSecondOfDay((long) start * 60).minusMinutes(LEAD_MINUTES);
        return clamp(at, EARLIEST, LATEST);
    }

    static LocalTime clamp(LocalTime t, LocalTime min, LocalTime max) {
        return t.isBefore(min) ? min : t.isAfter(max) ? max : t;
    }

    private static final String[] WEEKDAYS = { "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
            "Domingo" };

    private static String weekdayPhrase(DayOfWeek day) {
        return switch (day) {
            case SATURDAY -> "aos sábados";
            case SUNDAY -> "aos domingos";
            default -> "às " + WEEKDAYS[day.getValue() - 1].toLowerCase() + "s";
        };
    }

    static String hhmm(LocalTime t) {
        return t.getMinute() == 0 ? t.getHour() + "h" : t.getHour() + "h" + String.format("%02d", t.getMinute());
    }
}
