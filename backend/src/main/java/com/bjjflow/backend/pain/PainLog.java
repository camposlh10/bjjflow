package com.bjjflow.backend.pain;

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

/** A pain/injury reading for one body region on one day (intensity 0-10). */
@Entity
@Table(name = "pain_logs")
@Getter
@Setter
@NoArgsConstructor
public class PainLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    private String region;

    private Integer intensity;

    private String note;

    @Column(name = "check_in_id")
    private Long checkInId;

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
