package com.bjjflow.backend.nudges;

import java.time.Duration;
import java.time.Instant;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.bjjflow.backend.jobs.SchedulerLocks;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Every 15 minutes: plans the day for members whose morning has started, then
 * sends the reminders that are due. One instance runs it at a time.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NudgeScheduler {

    private final NudgeService nudgeService;
    private final SchedulerLocks schedulerLocks;

    @Scheduled(cron = "0 */15 * * * *")
    public void run() {
        if (!schedulerLocks.tryLock("smart-reminders", Duration.ofMinutes(12))) {
            return;
        }
        runAt(Instant.now());
    }

    public void runAt(Instant now) {
        int planned = 0;
        for (Long userId : nudgeService.candidates()) {
            try {
                if (nudgeService.planIfDue(userId, now).isPresent()) {
                    planned++;
                }
            } catch (RuntimeException e) {
                // One member's bad data must not stop everyone else's reminders.
                log.warn("Could not plan smart reminders for user {}", userId, e);
            }
        }
        int sent = nudgeService.dispatchDue(now);
        if (planned > 0 || sent > 0) {
            log.info("Smart reminders: {} planned, {} sent", planned, sent);
        }
    }
}
