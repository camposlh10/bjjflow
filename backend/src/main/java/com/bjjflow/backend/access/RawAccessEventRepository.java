package com.bjjflow.backend.access;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RawAccessEventRepository extends JpaRepository<RawAccessEvent, Long> {

    @Query("""
            select e from RawAccessEvent e
            where e.deviceId = :deviceId and e.eventTime = :eventTime and e.source = :source
              and ((:studentUserId is not null and e.studentUserId = :studentUserId)
                or (:studentUserId is null and e.studentUserId is null
                    and e.externalMemberId = :externalMemberId))
            order by e.id asc
            limit 1
            """)
    Optional<RawAccessEvent> findDuplicate(
            @Param("deviceId") Long deviceId,
            @Param("studentUserId") Long studentUserId,
            @Param("externalMemberId") String externalMemberId,
            @Param("eventTime") Instant eventTime,
            @Param("source") AccessEventSource source);

    Optional<RawAccessEvent> findByDeviceIdAndDeviceEventId(Long deviceId, String deviceEventId);

    boolean existsByGymIdAndStudentUserIdAndOverdueTrueAndEventTimeGreaterThanEqualAndIdNot(Long gymId,
            Long studentUserId, Instant since, Long id);

    List<RawAccessEvent> findAllByGymIdAndStudentUserIdIsNotNullAndEventTimeGreaterThanEqualAndStatusInOrderByEventTimeAscIdAsc(
            Long gymId, Instant since, Collection<AccessEventStatus> statuses);

    List<RawAccessEvent> findAllByGymIdAndStatusInOrderByEventTimeDescIdDesc(
            Long gymId, List<AccessEventStatus> statuses);
}
