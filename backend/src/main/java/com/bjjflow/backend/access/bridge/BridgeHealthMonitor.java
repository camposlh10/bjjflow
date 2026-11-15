package com.bjjflow.backend.access.bridge;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.automations.GymZones;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.jobs.SchedulerLocks;
import com.bjjflow.backend.notifications.NotificationService;
import com.bjjflow.backend.notifications.NotificationType;

import lombok.RequiredArgsConstructor;

/**
 * Tells the gym's owners when a bridge stops checking in (the front-desk PC
 * is off, or its internet is down) and when it is back. Passages are not lost
 * meanwhile: devices keep working and the bridge holds what they send.
 */
@Service
@RequiredArgsConstructor
public class BridgeHealthMonitor {

    /** Silent this long = offline (it checks in every 5 seconds). */
    public static final Duration OFFLINE_AFTER = Duration.ofMinutes(3);
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    private final AccessBridgeRepository bridgeRepository;
    private final GymMemberRepository gymMemberRepository;
    private final NotificationService notificationService;
    private final GymZones gymZones;
    private final SchedulerLocks schedulerLocks;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void scheduled() {
        if (schedulerLocks.tryLock("bridge-health", Duration.ofSeconds(50))) {
            check(Instant.now());
        }
    }

    /** Returns how many alerts went out. */
    @Transactional
    public int check(Instant now) {
        int sent = 0;
        for (AccessBridge bridge : bridgeRepository.findAllByActiveTrueAndLastSeenAtIsNotNull()) {
            boolean offline = bridge.getLastSeenAt().isBefore(now.minus(OFFLINE_AFTER));
            if (offline && bridge.getOfflineAlertedAt() == null) {
                ZoneId zone = gymZones.zoneOf(bridge.getGymId());
                notifyOwners(bridge.getGymId(), "Bridge offline: " + bridge.getName(),
                        "Sem contato desde " + HM.format(bridge.getLastSeenAt().atZone(zone))
                                + ". Verifique o computador da recepção e a internet. As passagens ficam"
                                + " guardadas e chegam quando ela voltar.");
                bridge.setOfflineAlertedAt(now);
                bridgeRepository.save(bridge);
                sent++;
            } else if (!offline && bridge.getOfflineAlertedAt() != null) {
                notifyOwners(bridge.getGymId(), "Bridge online de novo: " + bridge.getName(),
                        "A conexão voltou. As passagens guardadas estão sendo enviadas.");
                bridge.setOfflineAlertedAt(null);
                bridgeRepository.save(bridge);
                sent++;
            }
        }
        return sent;
    }

    private void notifyOwners(Long gymId, String title, String body) {
        List<GymMember> owners = gymMemberRepository.findAllByGymIdAndRole(gymId, GymRole.OWNER);
        for (GymMember owner : owners) {
            notificationService.notify(owner.getUserId(), NotificationType.ACADEMY, title, body, "/dispositivos");
        }
    }
}
