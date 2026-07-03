package com.bjjflow.backend.events;

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
 * A noteworthy moment that feeds the personal Journey timeline and the academy
 * Community feed. Only stores what isn't already recorded elsewhere
 * (milestones, streak achievements, competition results); promotions, joins and
 * first-trainings are derived live from their source tables.
 */
@Entity
@Table(name = "user_events")
@Getter
@Setter
@NoArgsConstructor
public class UserEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "gym_id")
    private Long gymId;

    /** see {@link EventType} */
    private String type;

    /** milestone N, streak length, competition placement... */
    @Column(name = "event_value")
    private Integer value;

    @Column(name = "detail")
    private String text;

    @Column(name = "belt_slug")
    private String beltSlug;

    @Column(name = "occurred_at")
    private Instant occurredAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (occurredAt == null) {
            occurredAt = createdAt;
        }
    }
}
