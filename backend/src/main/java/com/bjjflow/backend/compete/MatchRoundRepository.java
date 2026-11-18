package com.bjjflow.backend.compete;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatchRoundRepository extends JpaRepository<MatchRound, Long> {

    List<MatchRound> findAllByMatchIdOrderByRoundNoAsc(Long matchId);
}
