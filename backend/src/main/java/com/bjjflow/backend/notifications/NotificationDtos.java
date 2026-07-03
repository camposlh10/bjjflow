package com.bjjflow.backend.notifications;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class NotificationDtos {

    public record NotificationDto(Long id, String type, String title, String body, String payload, boolean read,
            Instant createdAt) {
    }

    public record NotificationListDto(long unread, List<NotificationDto> items) {
    }

    public record RegisterTokenRequest(@NotBlank @Size(max = 255) String token, @Size(max = 20) String platform) {
    }

    public record RemoveTokenRequest(@NotBlank @Size(max = 255) String token) {
    }
}
