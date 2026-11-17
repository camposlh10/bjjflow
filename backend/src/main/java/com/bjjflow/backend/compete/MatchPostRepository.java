package com.bjjflow.backend.compete;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatchPostRepository extends JpaRepository<MatchPost, Long> {

    Optional<MatchPost> findByMatchIdAndUserId(Long matchId, Long userId);

    boolean existsByMatchId(Long matchId);

    List<MatchPost> findByCreatedAtAfterOrderByCreatedAtDesc(Instant since, Pageable pageable);

    List<MatchPost> findByUserIdInAndCreatedAtAfterOrderByCreatedAtDesc(Collection<Long> userIds, Instant since,
            Pageable pageable);

    /** How many times each original post was reposted. */
    @Query("select p.repostOfId, count(p) from MatchPost p where p.repostOfId in :ids group by p.repostOfId")
    List<Object[]> countReposts(@Param("ids") Collection<Long> ids);

    /** Which of these matches the user already posted or reposted. */
    @Query("select p.matchId from MatchPost p where p.userId = :userId and p.matchId in :matchIds")
    List<Long> matchIdsSharedBy(@Param("userId") Long userId, @Param("matchIds") Collection<Long> matchIds);
}
