package com.bjjflow.backend.compete;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A match between two members: weekly rounds back to back from {@code startsOn},
 * each won by whoever trained on more days; first to 3 rounds wins (at most 5).
 */
@Entity
@Table(name = "matches")
@Getter
@Setter
@NoArgsConstructor
public class Match {

    public static final String PENDING = "PENDING";
    public static final String ACTIVE = "ACTIVE";
    public static final String FINISHED = "FINISHED";
    public static final String DECLINED = "DECLINED";
    public static final String CANCELLED = "CANCELLED";
    public static final String EXPIRED = "EXPIRED";

    public static final String FIRST_TO_3 = "FIRST_TO_3";
    public static final String ROUND_CAP = "ROUND_CAP";
    public static final String FORFEIT = "FORFEIT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenger_id")
    private Long challengerId;

    @Column(name = "opponent_id")
    private Long opponentId;

    private String status = PENDING;

    @Column(name = "starts_on")
    private LocalDate startsOn;

    @Column(name = "challenger_rounds")
    private int challengerRounds;

    @Column(name = "opponent_rounds")
    private int opponentRounds;

    @Column(name = "rounds_played")
    private int roundsPlayed;

    @Column(name = "winner_id")
    private Long winnerId;

    @Column(name = "end_reason")
    private String endReason;

    @Column(name = "challenger_delta")
    private Integer challengerDelta;

    @Column(name = "opponent_delta")
    private Integer opponentDelta;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Version
    private Long version;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public boolean involves(Long userId) {
        return challengerId.equals(userId) || opponentId.equals(userId);
    }

    public Long otherThan(Long userId) {
        return challengerId.equals(userId) ? opponentId : challengerId;
    }
}
