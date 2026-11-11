package com.bjjflow.backend.automations;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymRepository;
import com.bjjflow.backend.jobs.SchedulerLocks;

import lombok.RequiredArgsConstructor;

/**
 * Schedules the automations.
 *
 * Daily ladders (payment reminders, engagement) run at 08:00 in each gym's own
 * time zone: the job wakes every hour and picks the gyms where it is now 8
 * o'clock. Class reminders run hourly. A scheduler lock makes each run happen on
 * one server instance only, and every event is fire-once anyway (backed by the
 * automation_events unique constraint), so a repeated run is harmless.
 */
@Service
@RequiredArgsConstructor
public class AutomationRunner {

    private static final Logger log = LoggerFactory.getLogger(AutomationRunner.class);
    /** Local hour at which the daily ladders run. */
    static final int DAILY_HOUR = 8;
    /** Shorter than the hourly interval, longer than any clock skew between instances. */
    private static final Duration HOURLY_LOCK = Duration.ofMinutes(50);

    private final PaymentReminderAutomation paymentReminderAutomation;
    private final EngagementAutomation engagementAutomation;
    private final ClassReminderAutomation classReminderAutomation;
    private final GymRepository gymRepository;
    private final SchedulerLocks schedulerLocks;

    /** Every hour on the hour: daily ladders for gyms where it is now 08:xx. */
    @Scheduled(cron = "0 0 * * * *")
    public void runDailyJobs() {
        if (!schedulerLocks.tryLock("automations-daily", HOURLY_LOCK)) {
            return;
        }
        int created = runDailyDue(Instant.now());
        if (created > 0) {
            log.info("Daily automations fired {} event(s)", created);
        }
    }

    /** Class reminders — hourly at minute 5. */
    @Scheduled(cron = "0 5 * * * *")
    public void runHourlyJobs() {
        if (!schedulerLocks.tryLock("automations-class-reminders", HOURLY_LOCK)) {
            return;
        }
        int created = classReminderAutomation.run(Instant.now());
        if (created > 0) {
            log.info("Class reminders fired {} event(s)", created);
        }
    }

    /** Runs the daily ladders for every gym whose local hour is {@link #DAILY_HOUR} at {@code now}. */
    int runDailyDue(Instant now) {
        int created = 0;
        for (Gym gym : gymRepository.findAll()) {
            ZonedDateTime local = now.atZone(GymZones.zoneOf(gym));
            if (local.getHour() == DAILY_HOUR) {
                created += runDaily(gym.getId(), local.toLocalDate(), local.getZone());
            }
        }
        return created;
    }

    /** The CRM's "run automations now": every automation, for one gym, at its local date. */
    public int runForGym(Long gymId) {
        Instant now = Instant.now();
        Gym gym = gymRepository.findById(gymId).orElse(null);
        ZoneId zone = GymZones.zoneOf(gym);
        return runDaily(gymId, now.atZone(zone).toLocalDate(), zone)
                + classReminderAutomation.runForGym(now, gymId);
    }

    private int runDaily(Long gymId, LocalDate today, ZoneId zone) {
        return paymentReminderAutomation.run(gymId, today) + engagementAutomation.run(gymId, today, zone);
    }
}
