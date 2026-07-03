package com.bjjflow.backend.feed;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CheckInLikeRepository extends JpaRepository<CheckInLike, Long> {

    boolean existsByCheckInIdAndUserId(Long checkInId, Long userId);

    long countByCheckInId(Long checkInId);

    void deleteByCheckInIdAndUserId(Long checkInId, Long userId);

    @Query("select l.checkInId, count(l) from CheckInLike l where l.checkInId in :ids group by l.checkInId")
    List<Object[]> countByCheckInIds(@Param("ids") Collection<Long> ids);

    @Query("select l.checkInId from CheckInLike l where l.userId = :userId and l.checkInId in :ids")
    List<Long> likedCheckInIds(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);
}
