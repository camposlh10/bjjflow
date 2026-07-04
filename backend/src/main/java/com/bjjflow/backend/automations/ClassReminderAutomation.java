package com.bjjflow.backend.automations;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.springframework.stereotype.Service;

import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.bjjflow.backend.classes.GymClass;
import com.bjjflow.backend.classes.GymClassRepository;
import com.bjjflow.backend.notifications.NotificationType;

import lombok.RequiredArgsConstructor;

/**
 * Class reminders 24h and 1h before the next occurrence, plus cancellation
 * notices. There is no booking system yet, so the audience is everyone who
 * attended that class in the last 30 days.
 */
@Service
@RequiredArgsConstructor
public class ClassReminderAutomation {

    private static final int AUDIENCE_WINDOW_DAYS = 30;

    private final GymClassRepository gymClassRepository;
    private final ClassAttendanceRepository classAttendanceRepository;
    private final AutomationEvents automationEvents;

    public int run(Instant now) {
        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime reference = now.atZone(zone);
        int created = 0;

        for (GymClass gymClass : gymClassRepository.findAllByActiveTrue()) {
            ZonedDateTime occurrence = nextOccurrence(gymClass, reference);
            Duration until = Duration.between(reference, occurrence);

            if (until.compareTo(Duration.ofHours(23)) > 0 && until.compareTo(Duration.ofHours(24)) <= 0) {
                created += remind(gymClass, occurrence, "24h", "Aula amanhã",
                        "%s amanhã às %s. Já garante seu treino!".formatted(
                                gymClass.getName(), gymClass.getStartTime()));
            }
            if (until.compareTo(Duration.ofMinutes(30)) > 0 && until.compareTo(Duration.ofMinutes(90)) <= 0) {
                created += remind(gymClass, occurrence, "1h", "Aula em breve",
                        "%s começa às %s. Te esperamos no tatame!".formatted(
                                gymClass.getName(), gymClass.getStartTime()));
            }
        }
        return created;
    }

    /** Notifies the class audience that the class was cancelled/deactivated. */
    public int notifyCancelled(GymClass gymClass) {
        int created = 0;
        LocalDate since = LocalDate.now().minusDays(AUDIENCE_WINDOW_DAYS);
        for (Long userId : classAttendanceRepository.recentAttendeeIds(gymClass.getId(), since)) {
            if (automationEvents.fireOnce(gymClass.getGymId(), AutomationEvents.CLASS_CANCELLED,
                    "class-" + gymClass.getId() + "-cancelled-" + LocalDate.now() + "-" + userId,
                    userId, NotificationType.ACADEMY, "Aula cancelada",
                    "A aula %s (%s) foi cancelada pela academia.".formatted(
                            gymClass.getName(), gymClass.getStartTime()))) {
                created++;
            }
        }
        return created;
    }

    private int remind(GymClass gymClass, ZonedDateTime occurrence, String milestone, String title, String body) {
        int created = 0;
        LocalDate since = occurrence.toLocalDate().minusDays(AUDIENCE_WINDOW_DAYS);
        for (Long userId : classAttendanceRepository.recentAttendeeIds(gymClass.getId(), since)) {
            if (automationEvents.fireOnce(gymClass.getGymId(), AutomationEvents.CLASS_REMINDER,
                    "class-" + gymClass.getId() + "-" + occurrence.toLocalDate() + "-" + milestone + "-" + userId,
                    userId, NotificationType.ACADEMY, title, body)) {
                created++;
            }
        }
        return created;
    }

    private static ZonedDateTime nextOccurrence(GymClass gymClass, ZonedDateTime reference) {
        int daysAhead = Math.floorMod(gymClass.getDayOfWeek() - reference.getDayOfWeek().getValue(), 7);
        ZonedDateTime occurrence = ZonedDateTime.of(
                reference.toLocalDate().plusDays(daysAhead), gymClass.getStartTime(), reference.getZone());
        if (!occurrence.isAfter(reference)) {
            occurrence = occurrence.plusDays(7);
        }
        return occurrence;
    }
}
