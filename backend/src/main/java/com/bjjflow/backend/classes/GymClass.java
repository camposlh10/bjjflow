package com.bjjflow.backend.classes;

import java.time.Instant;
import java.time.LocalTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "gym_classes")
@Getter
@Setter
@NoArgsConstructor
public class GymClass {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    private String name;

    @Column(name = "instructor_user_id")
    private Long instructorUserId;

    /** ISO day of week: 1 = Monday … 7 = Sunday. */
    @Column(name = "day_of_week")
    private Integer dayOfWeek;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "session_type")
    private SessionType sessionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "restriction_mode")
    private RestrictionMode restrictionMode = RestrictionMode.ALL;

    /** Comma-separated belt slugs when restrictionMode = BELTS. */
    @Column(name = "allowed_belt_slugs")
    private String allowedBeltSlugs;

    private Boolean active = true;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
