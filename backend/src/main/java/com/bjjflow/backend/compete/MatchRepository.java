package com.bjjflow.backend.compete;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatchRepository extends JpaRepository<Match, Long> {

    /** A member's matches in the given states, newest first. */
    @Query("""
            select m from Match m
            where (m.challengerId = :userId or m.opponentId = :userId) and m.status in :statuses
            order by m.createdAt desc
            """)
    List<Match> findForUser(@Param("userId") Long userId, @Param("statuses") Collection<String> statuses,
            Pageable pageable);

    @Query("""
            select count(m) from Match m
            where (m.challengerId = :userId or m.opponentId = :userId) and m.status in :statuses
            """)
    long countForUser(@Param("userId") Long userId, @Param("statuses") Collection<String> statuses);

    /** Matches between two members in the given states, newest first. */
    @Query("""
            select m from Match m
            where ((m.challengerId = :a and m.opponentId = :b) or (m.challengerId = :b and m.opponentId = :a))
              and m.status in :statuses
            order by m.createdAt desc
            """)
    List<Match> findBetween(@Param("a") Long a, @Param("b") Long b, @Param("statuses") Collection<String> statuses);

    @Query("select m.id from Match m where m.status in :statuses")
    List<Long> findIdsByStatusIn(@Param("statuses") Collection<String> statuses);
}
