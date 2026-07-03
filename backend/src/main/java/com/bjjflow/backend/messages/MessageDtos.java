package com.bjjflow.backend.messages;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class MessageDtos {

    /** The other participant, as shown in the inbox / conversation header. */
    public record ParticipantDto(Long id, String username, String displayName, boolean pro, String avatarUrl) {
    }

    public record ConversationDto(
            Long id,
            ParticipantDto other,
            String lastMessage,
            boolean lastFromMe,
            Instant lastMessageAt,
            long unread) {
    }

    public record MessageDto(Long id, Long senderId, boolean fromMe, String content, Instant createdAt) {
    }

    public record StartConversationRequest(Long userId) {
    }

    public record SendMessageRequest(@NotBlank @Size(max = 2000) String content) {
    }
}
