package com.bjjflow.backend.submissions;

import java.time.Instant;
import java.time.LocalDate;

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

/** A submission a user landed (HIT) or conceded (CONCEDED) during a logged training. */
@Entity
@Table(name = "submission_logs")
@Getter
@Setter
@NoArgsConstructor
public class SubmissionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "check_in_id")
    private Long checkInId;

    private String submission;

    /** HIT or CONCEDED */
    private String direction;

    @Column(name = "qty")
    private Integer qty;

    @Column(name = "occurred_at")
    private LocalDate occurredAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
