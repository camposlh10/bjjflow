package com.bjjflow.backend.crm.notifications;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CrmNotificationDtos {

    private CrmNotificationDtos() {
    }

    public record AnnouncementRequest(
            /** null = broadcast to every member of the gym */
            Long memberUserId,
            @NotBlank @Size(max = 150) String title,
            @NotBlank @Size(max = 500) String message) {
    }

    public record AnnouncementResponse(
            int recipientCount) {
    }

    public record AutomationEventResponse(
            Long id,
            String type,
            Long memberUserId,
            String memberName,
            String title,
            String body,
            Instant createdAt) {
    }

    public record RunAutomationsResponse(
            int createdEvents) {
    }
}
