package com.bjjflow.backend.belts;

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

@Entity
@Table(name = "belt_promotions")
@Getter
@Setter
@NoArgsConstructor
public class BeltPromotion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "gym_id")
    private Long gymId;

    @Column(name = "belt_rank_id")
    private Long beltRankId;

    private Integer stripes = 0;

    @Column(name = "promoted_by_user_id")
    private Long promotedByUserId;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
