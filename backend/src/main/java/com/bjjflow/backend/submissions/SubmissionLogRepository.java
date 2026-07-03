package com.bjjflow.backend.submissions;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubmissionLogRepository extends JpaRepository<SubmissionLog, Long> {

    /** Submissions for a batch of check-ins (feed rendering, avoids N+1). */
    List<SubmissionLog> findByCheckInIdIn(Collection<Long> checkInIds);

    /** [submission, totalQty] grouped, for a user/direction within a date range. */
    @Query("select s.submission, sum(s.qty) from SubmissionLog s "
            + "where s.userId = :uid and s.direction = :dir and s.occurredAt between :from and :to "
            + "group by s.submission")
    List<Object[]> aggregate(@Param("uid") Long userId, @Param("dir") String direction,
            @Param("from") LocalDate from, @Param("to") LocalDate to);
}
