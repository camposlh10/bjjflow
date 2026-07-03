package com.bjjflow.backend.messages;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findAllByConversationIdOrderByCreatedAtAsc(Long conversationId);

    Message findTopByConversationIdOrderByCreatedAtDesc(Long conversationId);

    /** Unread = messages after my last-read instant that I didn't send. */
    long countByConversationIdAndSenderIdNotAndCreatedAtAfter(Long conversationId, Long senderId, Instant after);

    long countByConversationIdAndSenderIdNot(Long conversationId, Long senderId);
}
