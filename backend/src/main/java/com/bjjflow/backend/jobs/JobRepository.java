package com.bjjflow.backend.jobs;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JobRepository extends JpaRepository<Job, Long> {

    /** Jobs ready to run, plus RUNNING ones whose worker died (claim expired). */
    @Query("""
            select j.id from Job j
            where (j.status = 'PENDING' and j.runAt <= :now)
               or (j.status = 'RUNNING' and j.lockedUntil < :now)
            order by j.runAt
            """)
    List<Long> findDueIds(@Param("now") Instant now, Pageable pageable);

    /**
     * Claims one job. Conditional on the job still being claimable, so when
     * several instances race for the same row exactly one gets 1 back.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update Job j set j.status = 'RUNNING', j.lockedUntil = :until, j.attempts = j.attempts + 1
            where j.id = :id
              and ((j.status = 'PENDING' and j.runAt <= :now) or (j.status = 'RUNNING' and j.lockedUntil < :now))
            """)
    int claim(@Param("id") Long id, @Param("now") Instant now, @Param("until") Instant until);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update Job j set j.status = 'DONE', j.payload = null, j.lockedUntil = null,
                j.lastError = null, j.finishedAt = :now
            where j.id = :id
            """)
    int markDone(@Param("id") Long id, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update Job j set j.status = 'PENDING', j.runAt = :runAt, j.lockedUntil = null, j.lastError = :error
            where j.id = :id
            """)
    int markRetry(@Param("id") Long id, @Param("runAt") Instant runAt, @Param("error") String error);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update Job j set j.status = 'FAILED', j.lockedUntil = null, j.lastError = :error, j.finishedAt = :now
            where j.id = :id
            """)
    int markFailed(@Param("id") Long id, @Param("error") String error, @Param("now") Instant now);

    @Modifying
    @Query("delete from Job j where j.status = 'DONE' and j.finishedAt < :cutoff")
    int purgeDoneBefore(@Param("cutoff") Instant cutoff);

    long countByStatus(String status);
}
