package com.bjjflow.backend.classes;

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

@Entity
@Table(name = "class_attendances")
@Getter
@Setter
@NoArgsConstructor
public class ClassAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_class_id")
    private Long gymClassId;

    @Column(name = "class_date")
    private LocalDate classDate;

    @Column(name = "user_id")
    private Long userId;

    private String status = "PRESENT";

    @Column(name = "marked_by_user_id")
    private Long markedByUserId;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
