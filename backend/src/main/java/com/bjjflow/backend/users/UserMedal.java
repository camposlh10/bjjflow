package com.bjjflow.backend.users;

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

/** A competition medal a user shows off on their profile (mirrors gym_medals). */
@Entity
@Table(name = "user_medals")
@Getter
@Setter
@NoArgsConstructor
public class UserMedal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    private String competition;

    /** GOLD, SILVER or BRONZE */
    private String tier;

    @Column(name = "medal_count")
    private Integer count;

    private Integer position;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
