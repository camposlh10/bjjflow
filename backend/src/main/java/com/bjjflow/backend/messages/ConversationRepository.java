package com.bjjflow.backend.messages;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findByUserAIdAndUserBId(Long userAId, Long userBId);

    /** My conversations, most recently active first (nulls — never-messaged — last via the service sort). */
    List<Conversation> findByUserAIdOrUserBIdOrderByLastMessageAtDesc(Long userAId, Long userBId);

    /** The inbox: my conversations that have at least one message, most recent first. */
    @org.springframework.data.jpa.repository.Query("""
            select c from Conversation c
            where (c.userAId = :me or c.userBId = :me) and c.lastMessageAt is not null
            order by c.lastMessageAt desc
            """)
    List<Conversation> inbox(@org.springframework.data.repository.query.Param("me") Long me,
            org.springframework.data.domain.Pageable pageable);
}
