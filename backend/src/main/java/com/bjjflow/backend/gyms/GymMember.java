package com.bjjflow.backend.gyms;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "gym_members")
@Getter
@Setter
@NoArgsConstructor
public class GymMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id")
    private Long gymId;

    @Column(name = "user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    private GymRole role = GymRole.MEMBER;

    // Belt this gym has assigned the member. Null until the gym first grades them,
    // in which case displays fall back to the member's profile belt.
    @Column(name = "belt_rank_id")
    private Long beltRankId;

    @Column(name = "stripes")
    private Integer stripes = 0;

    @Column(name = "joined_at")
    private Instant joinedAt;

    @PrePersist
    void onCreate() {
        joinedAt = Instant.now();
    }
}
