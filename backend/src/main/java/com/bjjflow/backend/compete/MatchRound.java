package com.bjjflow.backend.compete;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A settled week of a match: training days for each player and who took it (null = tied). */
@Entity
@Table(name = "match_rounds")
@Getter
@Setter
@NoArgsConstructor
public class MatchRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id")
    private Long matchId;

    @Column(name = "round_no")
    private int roundNo;

    @Column(name = "starts_on")
    private LocalDate startsOn;

    @Column(name = "ends_on")
    private LocalDate endsOn;

    @Column(name = "challenger_days")
    private int challengerDays;

    @Column(name = "opponent_days")
    private int opponentDays;

    @Column(name = "winner_id")
    private Long winnerId;
}
