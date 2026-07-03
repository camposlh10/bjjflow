package com.bjjflow.backend.notifications;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.notifications.NotificationDtos.NotificationDto;
import com.bjjflow.backend.notifications.NotificationDtos.NotificationListDto;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int DEFAULT_LIMIT = 30;

    private final NotificationRepository notificationRepository;
    private final PushTokenRepository pushTokenRepository;
    private final UserRepository userRepository;

    /**
     * Record a notification for a user, honoring their notify_* preferences. Never throws on
     * self-notification or missing prefs — it's a side effect of other flows, not a gate.
     * Remote push delivery (Expo) is deferred to a dev build; this backs the in-app center.
     */
    @Transactional
    public void notify(Long userId, NotificationType type, String title, String body, String payload) {
        if (userId == null) {
            return;
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !prefsAllow(user, type)) {
            return;
        }
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type.name());
        n.setTitle(title);
        n.setBody(body);
        n.setPayload(payload);
        notificationRepository.save(n);
        // TODO: when a dev/EAS build + APNs/FCM keys exist, fan out to this user's push_tokens here.
    }

    @Transactional(readOnly = true)
    public NotificationListDto list(Long userId, Integer limit) {
        int size = (limit == null || limit < 1 || limit > 100) ? DEFAULT_LIMIT : limit;
        List<NotificationDto> items = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, size)).stream()
                .map(NotificationService::toDto).toList();
        return new NotificationListDto(notificationRepository.countByUserIdAndReadFalse(userId), items);
    }

    @Transactional
    public void markRead(Long userId, Long id) {
        Notification n = notificationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND",
                        "Notification not found"));
        n.setRead(true);
        notificationRepository.save(n);
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllRead(userId);
    }

    @Transactional
    public void registerToken(Long userId, String token, String platform) {
        PushToken pt = pushTokenRepository.findByToken(token).orElseGet(PushToken::new);
        pt.setUserId(userId);
        pt.setToken(token);
        pt.setPlatform(platform);
        pushTokenRepository.save(pt);
    }

    @Transactional
    public void removeToken(String token) {
        pushTokenRepository.deleteByToken(token);
    }

    private boolean prefsAllow(User user, NotificationType type) {
        return switch (type) {
            case MESSAGE -> Boolean.TRUE.equals(user.getNotifyMessages());
            case SOCIAL -> Boolean.TRUE.equals(user.getNotifyCommunity());
            case ACADEMY, COMPETITION -> Boolean.TRUE.equals(user.getNotifyPromotions());
            // Training nudges + performance insights are low-volume and high-value: always kept.
            case TRAINING, PERFORMANCE, SYSTEM -> true;
        };
    }

    private static NotificationDto toDto(Notification n) {
        return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getPayload(),
                Boolean.TRUE.equals(n.getRead()), n.getCreatedAt());
    }
}
