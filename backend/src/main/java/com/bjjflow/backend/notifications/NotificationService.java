package com.bjjflow.backend.notifications;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.jobs.JobQueue;
import com.bjjflow.backend.realtime.RealtimeHub;
import com.bjjflow.backend.notifications.NotificationDtos.NotificationDto;
import com.bjjflow.backend.notifications.NotificationDtos.NotificationListDto;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int DEFAULT_LIMIT = 30;
    /** Recipients per fan-out job. */
    private static final int FANOUT_BATCH = 200;

    private final NotificationRepository notificationRepository;
    private final PushTokenRepository pushTokenRepository;
    private final UserRepository userRepository;
    private final PushDispatcher pushDispatcher;
    private final JobQueue jobQueue;
    private final RealtimeHub realtimeHub;

    /**
     * Record a notification for a user, honoring their notify_* preferences. Never throws on
     * self-notification or missing prefs — it's a side effect of other flows, not a gate.
     * The same message also goes to the user's phone (a push job written in this
     * transaction, see PushJobHandler) and to the open app (a realtime event sent
     * after commit), so a rolled-back notification never reaches anyone.
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
        n = notificationRepository.save(n);
        if (pushDispatcher.isEnabled() && pushTokenRepository.existsByUserId(userId)) {
            Map<String, Object> push = new HashMap<>();
            push.put("userId", userId);
            push.put("title", title);
            push.put("body", body == null ? "" : body);
            jobQueue.enqueue(PushJobHandler.TYPE, push);
        }
        Map<String, Object> event = new HashMap<>();
        event.put("type", "notification");
        event.put("id", n.getId());
        event.put("notificationType", type.name());
        event.put("title", title);
        if (body != null) {
            event.put("body", body);
        }
        if (payload != null) {
            event.put("link", payload);
        }
        realtimeHub.publishAfterCommit(userId, event);
    }

    /**
     * Notifies many users in the background (announcements, staff posts): the
     * caller's request returns at once, and recipients are processed in batches.
     */
    @Transactional
    public void notifyMany(Collection<Long> userIds, NotificationType type, String title, String body,
            String link) {
        List<Long> ids = new ArrayList<>(userIds);
        for (int start = 0; start < ids.size(); start += FANOUT_BATCH) {
            Map<String, Object> job = new HashMap<>();
            job.put("userIds", ids.subList(start, Math.min(start + FANOUT_BATCH, ids.size())));
            job.put("notificationType", type.name());
            job.put("title", title);
            job.put("body", body);
            job.put("link", link);
            jobQueue.enqueue(NotifyFanoutJobHandler.TYPE, job);
        }
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
