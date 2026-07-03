package com.bjjflow.backend.messages;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findByUserAIdAndUserBId(Long userAId, Long userBId);

    /** My conversations, most recently active first (nulls — never-messaged — last via the service sort). */
    List<Conversation> findByUserAIdOrUserBIdOrderByLastMessageAtDesc(Long userAId, Long userBId);
}
