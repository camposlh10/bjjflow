package com.bjjflow.backend.nudges;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.bjjflow.backend.nudges.NudgePlanner.Context;
import com.bjjflow.backend.nudges.NudgePlanner.History;
import com.bjjflow.backend.nudges.NudgePlanner.Kind;
import com.bjjflow.backend.nudges.NudgePlanner.Plan;

class NudgePlannerTest {

    /** A Tuesday. */
    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 24);
    private static final LocalDate JOINED = TUESDAY.minusDays(90);
    private static final History QUIET = new History(0, null, 0);

    /** Tuesdays and Thursdays at 19:30 (90 min, logged at 21:00) for the 3 weeks before {@code today}. */
    private static List<Rhythm.Session> tuesdaysAndThursdays(LocalDate today, boolean skipLastTuesday) {
        List<Rhythm.Session> out = new ArrayList<>();
        for (int d = 1; d <= 21; d++) {
            LocalDate day = today.minusDays(d);
            boolean lastTuesday = d == 7;
            if ((day.getDayOfWeek() == DayOfWeek.TUESDAY && !(lastTuesday && skipLastTuesday))
                    || day.getDayOfWeek() == DayOfWeek.THURSDAY) {
                out.add(new Rhythm.Session(day, 19 * 60 + 30, 21 * 60));
            }
        }
        return out;
    }

    private static Context context(Rhythm r, int streak, boolean trainedLastWeek, NudgePlanner.MatchRound match,
            History history) {
        return new Context(r, streak, 3, 0, false, trainedLastWeek, match, null, history);
    }

    @Test
    void readsHabitsStartTimesAndState() {
        Rhythm r = Rhythm.analyze(tuesdaysAndThursdays(TUESDAY, false), TUESDAY, JOINED);
        assertThat(r.state()).isEqualTo(Rhythm.State.ACTIVE);
        assertThat(r.trainingDays()).isEqualTo(6);
        assertThat(r.isHabit(DayOfWeek.TUESDAY)).isTrue();
        assertThat(r.isHabit(DayOfWeek.THURSDAY)).isTrue();
        assertThat(r.isHabit(DayOfWeek.MONDAY)).isFalse();
        assertThat(r.startOn(DayOfWeek.TUESDAY)).isEqualTo(19 * 60 + 30);
        assertThat(r.usualLog()).isEqualTo(21 * 60);
        assertThat(r.medianGap()).isEqualTo(2);
    }

    @Test
    void newMembersAreStillBeingLearnedAndAbsencesAreGraded() {
        assertThat(Rhythm.analyze(tuesdaysAndThursdays(TUESDAY, false), TUESDAY, TUESDAY.minusDays(3)).state())
                .isEqualTo(Rhythm.State.LEARNING);
        List<Rhythm.Session> eightDaysAgo = List.of(new Rhythm.Session(TUESDAY.minusDays(8), null, null),
                new Rhythm.Session(TUESDAY.minusDays(10), null, null),
                new Rhythm.Session(TUESDAY.minusDays(12), null, null));
        assertThat(Rhythm.analyze(eightDaysAgo, TUESDAY, JOINED).state()).isEqualTo(Rhythm.State.LAPSING);
        assertThat(Rhythm.analyze(List.of(new Rhythm.Session(TUESDAY.minusDays(30), null, null)), TUESDAY, JOINED)
                .state()).isEqualTo(Rhythm.State.DORMANT);
    }

    @Test
    void remindsOnAUsualDayOnlyWhenTheHabitIsSlipping() {
        Rhythm slipping = Rhythm.analyze(tuesdaysAndThursdays(TUESDAY, true), TUESDAY, JOINED);
        // Missed last Tuesday: remind 75 minutes before the usual 19:30.
        Optional<Plan> plan = NudgePlanner.plan(context(slipping, 0, false, null, QUIET));
        assertThat(plan).isPresent();
        assertThat(plan.get().kind()).isEqualTo(Kind.HABIT);
        assertThat(plan.get().at()).isEqualTo(LocalTime.of(18, 15));
        assertThat(plan.get().body()).contains("às terças").contains("19h30");

        // A class at their gym near that time is named instead.
        Context withClass = new Context(slipping, 0, 3, 0, false, false, null,
                new NudgePlanner.GymClass("Gi Avançado", LocalTime.of(19, 30)), QUIET);
        assertThat(NudgePlanner.plan(withClass).get().title()).isEqualTo("Gi Avançado às 19h30");

        // Trained last Tuesday and on pace: nothing to say.
        Rhythm steady = Rhythm.analyze(tuesdaysAndThursdays(TUESDAY, false), TUESDAY, JOINED);
        assertThat(NudgePlanner.plan(context(steady, 0, true, null, QUIET))).isEmpty();
    }

    @Test
    void aClosingMatchRoundAndAStreakComeFirst() {
        Rhythm slipping = Rhythm.analyze(tuesdaysAndThursdays(TUESDAY, true), TUESDAY, JOINED);
        NudgePlanner.MatchRound round = new NudgePlanner.MatchRound("Pedro", 2, 2, TUESDAY);
        Plan match = NudgePlanner.plan(context(slipping, 0, false, round, QUIET)).get();
        assertThat(match.kind()).isEqualTo(Kind.MATCH);
        assertThat(match.title()).isEqualTo("A rodada fecha hoje");
        assertThat(match.body()).contains("Pedro").contains("2×2");
        // Two days apart: not close enough to be worth it.
        NudgePlanner.MatchRound loose = new NudgePlanner.MatchRound("Pedro", 4, 1, TUESDAY);
        assertThat(NudgePlanner.plan(context(slipping, 0, false, loose, QUIET)).get().kind()).isEqualTo(Kind.HABIT);

        List<Rhythm.Session> daily = new ArrayList<>();
        for (int d = 1; d <= 5; d++) {
            daily.add(new Rhythm.Session(TUESDAY.minusDays(d), 7 * 60, 20 * 60));
        }
        Plan streak = NudgePlanner.plan(context(Rhythm.analyze(daily, TUESDAY, JOINED), 5, true, null, QUIET)).get();
        assertThat(streak.kind()).isEqualTo(Kind.STREAK);
        assertThat(streak.title()).isEqualTo("Sequência de 5 dias");
        assertThat(streak.at()).isEqualTo(LocalTime.of(18, 30));
    }

    @Test
    void theWeeklyGoalOnlyOnTheLastDayItIsStillPossible() {
        LocalDate saturday = LocalDate.of(2026, 11, 28);
        Rhythm r = Rhythm.analyze(tuesdaysAndThursdays(saturday, false), saturday, JOINED);
        Context twoLeftTwoDays = new Context(r, 0, 4, 2, true, true, null, null, QUIET);
        Plan goal = NudgePlanner.plan(twoLeftTwoDays).get();
        assertThat(goal.kind()).isEqualTo(Kind.GOAL);
        assertThat(goal.body()).isEqualTo("Faltam 2 treinos e 2 dias. O de hoje conta.");
        // Members who don't usually reach their goal aren't pushed toward it.
        assertThat(NudgePlanner.plan(new Context(r, 0, 4, 2, false, true, null, null, QUIET))).isEmpty();
        // Still slack in the week: no reminder yet.
        assertThat(NudgePlanner.plan(new Context(r, 0, 4, 3, true, true, null, null, QUIET))).isEmpty();
    }

    @Test
    void stepsBackWhenRemindersGoUnanswered() {
        Rhythm slipping = Rhythm.analyze(tuesdaysAndThursdays(TUESDAY, true), TUESDAY, JOINED);
        assertThat(NudgePlanner.plan(context(slipping, 0, false, null, new History(3, TUESDAY.minusDays(2), 0))))
                .isEmpty();
        // Two ignored in a row: one a week at most.
        assertThat(NudgePlanner.plan(context(slipping, 0, false, null, new History(1, TUESDAY.minusDays(3), 2))))
                .isEmpty();
        assertThat(NudgePlanner.plan(context(slipping, 0, false, null, new History(0, TUESDAY.minusDays(8), 2))))
                .isPresent();
        // Three ignored: two weeks of silence, even for a match.
        NudgePlanner.MatchRound round = new NudgePlanner.MatchRound("Pedro", 2, 2, TUESDAY);
        assertThat(NudgePlanner.plan(context(slipping, 0, false, round, new History(0, TUESDAY.minusDays(9), 3))))
                .isEmpty();
        assertThat(NudgePlanner.plan(context(slipping, 0, false, round, new History(0, TUESDAY.minusDays(15), 3))))
                .isPresent();
        // Never two days running, except for a match or a streak.
        assertThat(NudgePlanner.plan(context(slipping, 0, false, null, new History(1, TUESDAY.minusDays(1), 0))))
                .isEmpty();
        assertThat(NudgePlanner.plan(context(slipping, 0, false, round, new History(1, TUESDAY.minusDays(1), 0))))
                .isPresent();
    }

    @Test
    void comebackOnlyAtSetPointsAndNotForNewMembers() {
        List<Rhythm.Session> past = new ArrayList<>();
        for (int d = 0; d < 4; d++) {
            past.add(new Rhythm.Session(TUESDAY.minusDays(4 + 2 * d), null, 20 * 60));
        }
        // Gap 2 → slipping from 4 days.
        Plan back = NudgePlanner.plan(context(Rhythm.analyze(past, TUESDAY, JOINED), 0, false, null, QUIET)).get();
        assertThat(back.kind()).isEqualTo(Kind.COMEBACK);
        assertThat(back.title()).isEqualTo("4 dias sem treinar");
        assertThat(back.at()).isEqualTo(LocalTime.of(19, 0));
        // The next day: no repeat.
        assertThat(NudgePlanner.plan(context(Rhythm.analyze(past, TUESDAY.plusDays(1), JOINED), 0, false, null, QUIET)))
                .isEmpty();
        // Still being learned: no habit or comeback reminders.
        assertThat(NudgePlanner.plan(context(Rhythm.analyze(past, TUESDAY, TUESDAY.minusDays(5)), 0, false, null,
                QUIET))).isEmpty();
    }
}
