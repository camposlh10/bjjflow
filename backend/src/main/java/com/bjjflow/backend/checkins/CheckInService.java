package com.bjjflow.backend.checkins;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.checkins.CheckInDtos.CheckInDto;
import com.bjjflow.backend.checkins.CheckInDtos.CreateCheckInRequest;
import com.bjjflow.backend.checkins.CheckInDtos.StatsResponse;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.events.UserEventService;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.submissions.SubmissionLog;
import com.bjjflow.backend.submissions.SubmissionLogRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CheckInService {

    private final CheckInRepository checkInRepository;
    private final UserRepository userRepository;
    private final GymMemberRepository gymMemberRepository;
    private final UserEventService userEventService;
    private final SubmissionLogRepository submissionLogRepository;

    @Transactional
    public CheckInDto create(Long userId, CreateCheckInRequest request) {
        LocalDate today = LocalDate.now();
        if (request.date().isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FUTURE_DATE", "Cannot check in for a future date");
        }
        if (request.date().isBefore(today.minusDays(30))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DATE_TOO_OLD", "Check-in date is too far in the past");
        }

        CheckIn checkIn = new CheckIn();
        checkIn.setUserId(userId);
        checkIn.setCheckDate(request.date());
        checkIn.setSessionType(request.sessionType());
        checkIn.setDurationMinutes(request.durationMinutes());
        checkIn.setNotes(request.notes());
        checkIn.setVisibility(normalizeVisibility(request.visibility()));
        checkIn.setPhotoKey(blankToNull(request.photoKey()));
        checkIn = checkInRepository.save(checkIn);

        saveSubmissions(userId, checkIn.getId(), request.date(), request.submissions());

        int streak = updateStreak(userId, request.date());
        emitProgress(userId, request.date(), streak);

        return new CheckInDto(checkIn.getId(), checkIn.getCheckDate(), checkIn.getSessionType(),
                checkIn.getDurationMinutes(), checkIn.getNotes());
    }

    /** Defaults to PRIVATE; only an explicit "PUBLIC" shares the session to the feed. */
    private String normalizeVisibility(String visibility) {
        return "PUBLIC".equalsIgnoreCase(visibility == null ? "" : visibility.trim()) ? "PUBLIC" : "PRIVATE";
    }

    private String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private void saveSubmissions(Long userId, Long checkInId, LocalDate date,
            List<CheckInDtos.SubmissionInput> submissions) {
        if (submissions == null || submissions.isEmpty()) {
            return;
        }
        for (CheckInDtos.SubmissionInput s : submissions) {
            String direction = s.direction() == null ? "" : s.direction().trim().toUpperCase();
            if (!direction.equals("HIT") && !direction.equals("CONCEDED")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DIRECTION",
                        "Submission direction must be HIT or CONCEDED");
            }
            SubmissionLog log = new SubmissionLog();
            log.setUserId(userId);
            log.setCheckInId(checkInId);
            log.setSubmission(s.submission().trim());
            log.setDirection(direction);
            log.setQty(s.count());
            log.setOccurredAt(date);
            submissionLogRepository.save(log);
        }
    }

    /** Idempotently records any milestone/first-training/streak events this check-in crossed. */
    private void emitProgress(Long userId, LocalDate date, int streak) {
        Long gymId = gymMemberRepository.findFirstByUserId(userId).map(GymMember::getGymId).orElse(null);
        long total = checkInRepository.countByUserId(userId);
        userEventService.recordTrainingProgress(userId, gymId, date, total, streak);
    }

    /**
     * Ensures the user has a check-in for the given date (so attending a class
     * keeps the daily streak), without creating a duplicate when they already
     * logged that day. Used by the Agenda class check-in / attendance flow.
     */
    @Transactional
    public void ensureDailyCheckIn(Long userId, LocalDate date) {
        if (checkInRepository.existsByUserIdAndCheckDate(userId, date)) {
            return;
        }
        CheckIn checkIn = new CheckIn();
        checkIn.setUserId(userId);
        checkIn.setCheckDate(date);
        checkIn.setSessionType("CLASS");
        checkInRepository.save(checkIn);
        int streak = updateStreak(userId, date);
        emitProgress(userId, date, streak);
    }

    private int updateStreak(Long userId, LocalDate date) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "User not found"));
        LocalDate last = user.getLastCheckInDate();

        // Back-dated check-ins don't move the streak; same-day repeats count once
        if (last != null && !date.isAfter(last)) {
            return user.getCurrentStreak();
        }
        long gap = last == null ? Long.MAX_VALUE : ChronoUnit.DAYS.between(last, date);
        int current = gap == 1 ? user.getCurrentStreak() + 1 : 1;
        user.setCurrentStreak(current);
        user.setLongestStreak(Math.max(user.getLongestStreak(), current));
        user.setLastCheckInDate(date);
        userRepository.save(user);
        return current;
    }

    private static int sumMinutes(List<CheckInDtos.CheckInDto> checkIns) {
        return checkIns.stream().mapToInt(c -> c.durationMinutes() == null ? 0 : c.durationMinutes()).sum();
    }

    @Transactional(readOnly = true)
    public List<CheckInDto> list(Long userId, LocalDate from, LocalDate to) {
        return checkInRepository.findAllByUserIdAndCheckDateBetweenOrderByCheckDateAsc(userId, from, to).stream()
                .map(c -> new CheckInDto(c.getId(), c.getCheckDate(), c.getSessionType(), c.getDurationMinutes(),
                        c.getNotes()))
                .toList();
    }

    @Transactional(readOnly = true)
    public StatsResponse stats(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "User not found"));

        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(java.time.DayOfWeek.MONDAY);
        LocalDate sunday = monday.plusDays(6);

        // streak "viva" só se o último treino foi hoje ou ontem
        LocalDate last = user.getLastCheckInDate();
        boolean alive = last != null && !last.isBefore(today.minusDays(1));
        int currentStreak = alive ? user.getCurrentStreak() : 0;

        List<CheckInDtos.CheckInDto> week = list(userId, monday, sunday);
        List<Boolean> weekDays = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) {
            LocalDate day = monday.plusDays(i);
            weekDays.add(week.stream().anyMatch(c -> c.date().equals(day)));
        }

        // Training load: minutes trained this week vs last week.
        int weeklyMinutes = sumMinutes(week);
        int lastWeekMinutes = sumMinutes(list(userId, monday.minusWeeks(1), sunday.minusWeeks(1)));
        // BJJ MET ~10 → kcal ≈ MET × weightKg × hours.
        Long weeklyCalories = user.getWeightKg() == null ? null
                : Math.round(10.0 * user.getWeightKg().doubleValue() * (weeklyMinutes / 60.0));

        return new StatsResponse(
                currentStreak,
                user.getLongestStreak(),
                checkInRepository.countByUserId(userId),
                Math.round(checkInRepository.sumDurationMinutes(userId) / 60.0),
                user.getWeeklyGoal(),
                (int) checkInRepository.countDistinctDays(userId, monday, sunday),
                checkInRepository.existsByUserIdAndCheckDate(userId, today),
                weekDays,
                activeWeeks(userId),
                weeklyMinutes,
                lastWeekMinutes,
                weeklyCalories);
    }

    /** Distinct ISO weeks containing at least one check-in (portable; computed in Java). */
    private long activeWeeks(Long userId) {
        return checkInRepository.distinctCheckDates(userId).stream()
                .map(d -> d.get(java.time.temporal.IsoFields.WEEK_BASED_YEAR) * 100
                        + d.get(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR))
                .distinct()
                .count();
    }
}

