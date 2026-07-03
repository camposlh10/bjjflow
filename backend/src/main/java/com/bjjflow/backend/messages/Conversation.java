package com.bjjflow.backend.messages;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A 1:1 conversation. Participants are stored canonically: userAId < userBId. */
@Entity
@Table(name = "conversations")
@Getter
@Setter
@NoArgsConstructor
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_a_id")
    private Long userAId;

    @Column(name = "user_b_id")
    private Long userBId;

    @Column(name = "user_a_last_read_at")
    private Instant userALastReadAt;

    @Column(name = "user_b_last_read_at")
    private Instant userBLastReadAt;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
