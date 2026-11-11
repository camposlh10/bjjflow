package com.bjjflow.backend.jobs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.automations.AutomationRunner;
import com.bjjflow.backend.automations.EngagementAutomation;
import com.bjjflow.backend.automations.PaymentReminderAutomation;
import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymRepository;

@SpringBootTest
@ActiveProfiles("test")
class SchedulingTest {

    @Autowired
    private SchedulerLocks schedulerLocks;
    @Autowired
    private AutomationRunner automationRunner;
    @Autowired
    private GymRepository gymRepository;
    @MockitoBean
    private PaymentReminderAutomation paymentReminderAutomation;
    @MockitoBean
    private EngagementAutomation engagementAutomation;

    @Test
    void aScheduledTaskLockIsHeldByOneCallerAtATime() {
        String name = "test-lock-" + UUID.randomUUID();
        assertThat(schedulerLocks.tryLock(name, Duration.ofMinutes(5))).isTrue();
        assertThat(schedulerLocks.tryLock(name, Duration.ofMinutes(5))).isFalse();
        // Another task is independent.
        assertThat(schedulerLocks.tryLock(name + "-other", Duration.ofMinutes(5))).isTrue();
    }

    @Test
    void anExpiredLockCanBeTakenAgain() throws Exception {
        String name = "test-lock-" + UUID.randomUUID();
        assertThat(schedulerLocks.tryLock(name, Duration.ofMillis(50))).isTrue();
        Thread.sleep(120);
        assertThat(schedulerLocks.tryLock(name, Duration.ofMinutes(5))).isTrue();
    }

    private Gym gym(String name, String timezone) {
        Gym gym = new Gym();
        gym.setName(name);
        gym.setInviteCode(UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        gym.setTimezone(timezone);
        return gymRepository.save(gym);
    }

    @Test
    @Transactional
    void dailyAutomationsRunAtEightInEachGymsOwnTimeZone() throws Exception {
        Gym saoPaulo = gym("Academia SP", "America/Sao_Paulo");
        Gym tokyo = gym("Academia Tokyo", "Asia/Tokyo");

        // 08:30 in São Paulo (UTC-3) is 20:30 in Tokyo.
        Instant spMorning = LocalDate.of(2026, 3, 10).atTime(8, 30).atZone(ZoneId.of("America/Sao_Paulo")).toInstant();
        var method = AutomationRunner.class.getDeclaredMethod("runDailyDue", Instant.class);
        method.setAccessible(true);
        method.invoke(automationRunner, spMorning);

        verify(paymentReminderAutomation).run(saoPaulo.getId(), LocalDate.of(2026, 3, 10));
        verify(engagementAutomation).run(eq(saoPaulo.getId()), eq(LocalDate.of(2026, 3, 10)),
                eq(ZoneId.of("America/Sao_Paulo")));
        verify(paymentReminderAutomation, never()).run(eq(tokyo.getId()), any());
        verify(engagementAutomation, never()).run(eq(tokyo.getId()), any(), any());

        // 08:10 in Tokyo is the previous evening in São Paulo; the date is Tokyo's.
        Instant tokyoMorning = LocalDate.of(2026, 3, 11).atTime(8, 10).atZone(ZoneId.of("Asia/Tokyo")).toInstant();
        method.invoke(automationRunner, tokyoMorning);
        verify(paymentReminderAutomation).run(tokyo.getId(), LocalDate.of(2026, 3, 11));
        verify(paymentReminderAutomation, never()).run(anyLong(), eq(LocalDate.of(2026, 3, 9)));
    }
}
