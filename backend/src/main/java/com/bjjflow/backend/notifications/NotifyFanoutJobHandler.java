package com.bjjflow.backend.notifications;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.bjjflow.backend.jobs.JobHandler;

import lombok.RequiredArgsConstructor;

/**
 * Sends the same notification to a batch of users (gym announcements, staff
 * posts), so the request that triggered it returns without waiting.
 * Payload: userIds, notificationType, title, body, link.
 *
 * Runs in one transaction per batch: a retry re-sends the whole batch, which
 * is acceptable for announcements (rare, and a failure mid-batch rolls back).
 */
@Component
@RequiredArgsConstructor
public class NotifyFanoutJobHandler implements JobHandler {

    public static final String TYPE = "notify.fanout";

    private final NotificationService notificationService;

    @Override
    public String type() {
        return TYPE;
    }

    @Override
    public void handle(Map<String, Object> payload) {
        NotificationType notificationType = NotificationType.valueOf(JobHandler.stringArg(payload, "notificationType"));
        String title = JobHandler.stringArg(payload, "title");
        String body = JobHandler.stringArg(payload, "body");
        String link = JobHandler.stringArg(payload, "link");
        @SuppressWarnings("unchecked")
        List<Number> userIds = (List<Number>) payload.get("userIds");
        for (Number userId : userIds) {
            notificationService.notify(userId.longValue(), notificationType, title, body, link);
        }
    }
}
