package com.bjjflow.backend.pain;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PainLogRepository extends JpaRepository<PainLog, Long> {

    /** Newest-first within a window, so the service can keep the latest reading per region. */
    List<PainLog> findByUserIdAndOccurredAtAfterOrderByOccurredAtDescCreatedAtDesc(Long userId, LocalDate after);

    /** A single day's entries, newest-first (latest reading per region wins). */
    List<PainLog> findByUserIdAndOccurredAtOrderByCreatedAtDesc(Long userId, LocalDate date);

    /** A month's entries, for the aggregate "bigger picture". */
    List<PainLog> findByUserIdAndOccurredAtBetween(Long userId, LocalDate start, LocalDate end);

    List<PainLog> findByUserIdOrderByOccurredAtDescCreatedAtDesc(Long userId, Pageable pageable);
}
