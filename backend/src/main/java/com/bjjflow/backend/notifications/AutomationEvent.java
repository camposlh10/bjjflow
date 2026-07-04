package com.bjjflow.backend.notifications;

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

/**
 * One row per automation firing (or manual announcement). The unique
 * (type, refKey) pair is the idempotency guard; the table doubles as the
 * CRM's notification activity log.
 */
@Entity
@Table(name = "automation_events")
@Getter
@Setter
@NoArgsConstructor
public class AutomationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id", nullable = false)
    private Long gymId;

    @Column(nullable = false)
    private String type;

    @Column(name = "ref_key", nullable = false)
    private String refKey;

    /** Target member when the event concerns one member; null for broadcasts. */
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private String title;

    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
