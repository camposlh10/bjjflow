package com.bjjflow.backend.checkins;

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
@Table(name = "check_ins")
@Getter
@Setter
@NoArgsConstructor
public class CheckIn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "check_date")
    private LocalDate checkDate;

    @Column(name = "session_type")
    private String sessionType;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    private String notes;

    /** PUBLIC (shown on the global Comunidade feed) or PRIVATE (default). */
    private String visibility = "PRIVATE";

    @Column(name = "photo_key")
    private String photoKey;

    @Column(name = "share_count")
    private Integer shareCount = 0;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
