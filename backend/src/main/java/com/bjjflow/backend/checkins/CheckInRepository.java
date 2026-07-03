package com.bjjflow.backend.checkins;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CheckInRepository extends JpaRepository<CheckIn, Long> {

    List<CheckIn> findAllByUserIdAndCheckDateBetweenOrderByCheckDateAsc(Long userId, LocalDate from, LocalDate to);

    /** First page of the global Comunidade feed: newest public sessions (id desc ==
     *  insertion order == newest first, and gives a clean integer cursor). */
    List<CheckIn> findByVisibilityOrderByIdDesc(String visibility, Pageable pageable);

    /** Next page: public sessions older than the given check-in id (cursor pagination). */
    List<CheckIn> findByVisibilityAndIdLessThanOrderByIdDesc(String visibility, Long id, Pageable pageable);

    long countByUserId(Long userId);

    boolean existsByUserIdAndCheckDate(Long userId, LocalDate checkDate);

    @Query("select coalesce(sum(c.durationMinutes), 0) from CheckIn c where c.userId = :userId")
    long sumDurationMinutes(@Param("userId") Long userId);

    @Query("select count(distinct c.checkDate) from CheckIn c where c.userId = :userId and c.checkDate between :from and :to")
    long countDistinctDays(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select min(c.checkDate) from CheckIn c where c.userId = :userId")
    LocalDate minCheckDate(@Param("userId") Long userId);

    @Query("select distinct c.checkDate from CheckIn c where c.userId = :userId")
    List<LocalDate> distinctCheckDates(@Param("userId") Long userId);

    long countByUserIdAndCheckDateGreaterThanEqual(Long userId, LocalDate date);
}
