package com.bjjflow.backend.automations;

import java.time.Instant;
import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

/**
 * Schedules the Phase 1 automations. Every job is idempotent (backed by the
 * automation_events unique constraint), so overlapping or repeated runs are
 * harmless — including the manual "run now" trigger from the CRM.
 */
@Service
@RequiredArgsConstructor
public class AutomationRunner {

    private static final Logger log = LoggerFactory.getLogger(AutomationRunner.class);

    private final PaymentReminderAutomation paymentReminderAutomation;
    private final EngagementAutomation engagementAutomation;
    private final ClassReminderAutomation classReminderAutomation;

    /** Daily ladder jobs — 08:00 server time. */
    @Scheduled(cron = "0 0 8 * * *")
    public void runDailyJobs() {
        int created = paymentReminderAutomation.run(LocalDate.now())
                + engagementAutomation.run(LocalDate.now());
        log.info("Daily automations fired {} event(s)", created);
    }

    /** Class reminders — hourly at minute 5. */
    @Scheduled(cron = "0 5 * * * *")
    public void runHourlyJobs() {
        int created = classReminderAutomation.run(Instant.now());
        if (created > 0) {
            log.info("Class reminders fired {} event(s)", created);
        }
    }

    /** Manual trigger used by the CRM "run automations now" action. */
    public int runAll() {
        return paymentReminderAutomation.run(LocalDate.now())
                + engagementAutomation.run(LocalDate.now())
                + classReminderAutomation.run(Instant.now());
    }
}
