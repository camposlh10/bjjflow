package com.bjjflow.backend.automations;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.notifications.AutomationEvent;
import com.bjjflow.backend.notifications.AutomationEventRepository;
import com.bjjflow.backend.notifications.NotificationService;
import com.bjjflow.backend.notifications.NotificationType;

import lombok.RequiredArgsConstructor;

/**
 * Shared primitive for all automations: fire-once notification. The unique
 * (type, refKey) row is the idempotency guard — if the event was already
 * recorded, nothing is sent again.
 */
@Service
@RequiredArgsConstructor
public class AutomationEvents {

    public static final String PAYMENT_REMINDER = "PAYMENT_REMINDER";
    public static final String PAYMENT_OVERDUE = "PAYMENT_OVERDUE";
    public static final String PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED";
    public static final String DELINQUENT_FLAG = "DELINQUENT_FLAG";
    public static final String ENGAGEMENT_NUDGE = "ENGAGEMENT_NUDGE";
    public static final String COACH_FOLLOW_UP = "COACH_FOLLOW_UP";
    public static final String RETENTION_ALERT = "RETENTION_ALERT";
    public static final String CLASS_REMINDER = "CLASS_REMINDER";
    public static final String CLASS_CANCELLED = "CLASS_CANCELLED";
    public static final String ANNOUNCEMENT = "ANNOUNCEMENT";

    private final AutomationEventRepository automationEventRepository;
    private final NotificationService notificationService;

    /**
     * Records the event and notifies the target user, unless the same
     * (type, refKey) already fired. Returns true when the event was created.
     * Scheduled jobs call this outside a transaction, so each event gets its
     * own transaction and one bad record cannot sink a whole batch.
     */
    @Transactional
    public boolean fireOnce(Long gymId, String type, String refKey, Long targetUserId,
            NotificationType notificationType, String title, String body) {
        if (automationEventRepository.existsByTypeAndRefKey(type, refKey)) {
            return false;
        }
        AutomationEvent event = new AutomationEvent();
        event.setGymId(gymId);
        event.setType(type);
        event.setRefKey(refKey);
        event.setUserId(targetUserId);
        event.setTitle(title);
        event.setBody(body);
        automationEventRepository.save(event);
        if (targetUserId != null && notificationType != null) {
            notificationService.notify(targetUserId, notificationType, title, body, null);
        }
        return true;
    }
}
