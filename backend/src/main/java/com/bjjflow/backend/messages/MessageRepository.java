package com.bjjflow.backend.messages;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, Long> {

    java.util.Optional<Message> findBySenderIdAndClientId(Long senderId, String clientId);

    /** Newest first; callers reverse to chronological order. */
    List<Message> findByConversationIdOrderByIdDesc(Long conversationId, Pageable pageable);

    /** The page of older messages before {@code beforeId}, newest first. */
    List<Message> findByConversationIdAndIdLessThanOrderByIdDesc(Long conversationId, Long beforeId,
            Pageable pageable);

    /** Only what arrived after {@code afterId} (cheap polling), oldest first. */
    List<Message> findByConversationIdAndIdGreaterThanOrderByIdAsc(Long conversationId, Long afterId,
            Pageable pageable);

    /** Unread = messages after my last-read instant that I didn't send. */
    long countByConversationIdAndSenderIdNotAndCreatedAtAfter(Long conversationId, Long senderId, Instant after);

    long countByConversationIdAndSenderIdNot(Long conversationId, Long senderId);

    /**
     * Unread counts for every conversation of {@code me} in one query:
     * rows of [conversationId, count]. Conversations with nothing unread are absent.
     */
    @Query("""
            select m.conversationId, count(m)
            from Message m join Conversation c on c.id = m.conversationId
            where (c.userAId = :me or c.userBId = :me)
              and m.senderId <> :me
              and m.createdAt > coalesce(
                    case when c.userAId = :me then c.userALastReadAt else c.userBLastReadAt end, :epoch)
            group by m.conversationId
            """)
    List<Object[]> unreadCounts(@Param("me") Long me, @Param("epoch") Instant epoch);
}
