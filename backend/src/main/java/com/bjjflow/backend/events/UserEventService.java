package com.bjjflow.backend.events;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserEventService {

    static final Set<Integer> TRAINING_MILESTONES = Set.of(10, 25, 50, 100, 150, 200, 300, 500, 1000);
    static final Set<Integer> STREAK_MILESTONES = Set.of(7, 14, 30, 60, 100, 180, 365);

    private final UserEventRepository userEventRepository;

    /**
     * Idempotently emits the milestone/first-training/streak events that a single
     * check-in may have crossed. Safe to call on every check-in (duplicate/same-day
     * included) — the existsBy guard prevents re-emitting the same milestone.
     */
    @Transactional
    public void recordTrainingProgress(Long userId, Long gymId, LocalDate date, long totalTrainings, int currentStreak) {
        Instant when = date.atStartOfDay(ZoneOffset.UTC).toInstant();

        if (totalTrainings == 1 && !exists(userId, EventType.FIRST_TRAINING, 0)) {
            save(userId, gymId, EventType.FIRST_TRAINING, 0, null, null, when);
        }
        int total = (int) Math.min(totalTrainings, Integer.MAX_VALUE);
        if (TRAINING_MILESTONES.contains(total) && !exists(userId, EventType.TRAINING_MILESTONE, total)) {
            save(userId, gymId, EventType.TRAINING_MILESTONE, total, null, null, when);
        }
        if (STREAK_MILESTONES.contains(currentStreak) && !exists(userId, EventType.STREAK_MILESTONE, currentStreak)) {
            save(userId, gymId, EventType.STREAK_MILESTONE, currentStreak, null, null, when);
        }
    }

    @Transactional
    public UserEvent record(Long userId, Long gymId, String type, Integer value, String text, String beltSlug,
            Instant occurredAt) {
        return save(userId, gymId, type, value, text, beltSlug, occurredAt);
    }

    private boolean exists(Long userId, String type, Integer value) {
        return userEventRepository.existsByUserIdAndTypeAndValue(userId, type, value);
    }

    private UserEvent save(Long userId, Long gymId, String type, Integer value, String text, String beltSlug,
            Instant occurredAt) {
        UserEvent e = new UserEvent();
        e.setUserId(userId);
        e.setGymId(gymId);
        e.setType(type);
        e.setValue(value);
        e.setText(text);
        e.setBeltSlug(beltSlug);
        e.setOccurredAt(occurredAt);
        return userEventRepository.save(e);
    }
}
