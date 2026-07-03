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

/** A dated pain snapshot: context + a set of painful areas (pain_assessment_areas). */
@Entity
@Table(name = "pain_assessments")
@Getter
@Setter
@NoArgsConstructor
public class PainAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "assessed_on")
    private LocalDate assessedOn;

    @Column(name = "onset_date")
    private LocalDate onsetDate;

    private String trend;

    private String frequency;

    private String relieves;

    private String worsens;

    private String notes;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (assessedOn == null) {
            assessedOn = LocalDate.now();
        }
    }
}
