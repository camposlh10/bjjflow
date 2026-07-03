package com.bjjflow.backend.gyms;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "gym_verifications")
@Getter
@Setter
@NoArgsConstructor
public class GymVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    /** PENDING, NEEDS_REVIEW, APPROVED, REJECTED */
    private String status;

    private String cnpj;

    @Column(name = "ai_confidence")
    private Double aiConfidence;

    @Column(name = "ai_summary")
    private String aiSummary;

    @Column(name = "ai_raw")
    private String aiRaw;

    @Column(name = "review_notes")
    private String reviewNotes;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
