package com.bjjflow.backend.kids;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A student's emergency card, kept by one gym. */
@Entity
@Table(name = "student_health_info")
@Getter
@Setter
@NoArgsConstructor
public class StudentHealthInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    @Column(name = "student_user_id")
    private Long studentUserId;

    @Column(name = "blood_type")
    private String bloodType;

    private String allergies;

    private String conditions;

    private String medications;

    @Column(name = "health_plan")
    private String healthPlan;

    @Column(name = "emergency_notes")
    private String emergencyNotes;

    @Column(name = "updated_by_user_id")
    private Long updatedByUserId;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
