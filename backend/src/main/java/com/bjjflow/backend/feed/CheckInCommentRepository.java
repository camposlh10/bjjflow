package com.bjjflow.backend.feed;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CheckInCommentRepository extends JpaRepository<CheckInComment, Long> {

    List<CheckInComment> findAllByCheckInIdOrderByCreatedAtAsc(Long checkInId);

    @Query("select c.checkInId, count(c) from CheckInComment c where c.checkInId in :ids group by c.checkInId")
    List<Object[]> countByCheckInIds(@Param("ids") Collection<Long> ids);
}
