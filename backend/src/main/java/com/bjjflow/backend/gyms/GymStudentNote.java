package com.bjjflow.backend.gyms;

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

/** A private note an instructor keeps on a student, scoped to one gym. */
@Entity
@Table(name = "gym_student_notes")
@Getter
@Setter
@NoArgsConstructor
public class GymStudentNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    @Column(name = "student_user_id")
    private Long studentUserId;

    @Column(name = "author_user_id")
    private Long authorUserId;

    private String content;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
