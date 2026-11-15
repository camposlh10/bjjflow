package com.bjjflow.backend.access.bridge;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface BridgeCommandRepository extends JpaRepository<BridgeCommand, Long> {

    /** Locked so two overlapping heartbeats never hand out the same command. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select c from BridgeCommand c
            where c.bridgeId = :bridgeId
              and (c.status = com.bjjflow.backend.access.bridge.BridgeCommand.Status.PENDING
                or (c.status = com.bjjflow.backend.access.bridge.BridgeCommand.Status.SENT
                    and c.sentAt < :staleBefore))
            order by c.id asc
            """)
    List<BridgeCommand> lockDeliverable(@Param("bridgeId") Long bridgeId,
            @Param("staleBefore") Instant staleBefore, Pageable page);

    List<BridgeCommand> findAllByBridgeIdOrderByIdDesc(Long bridgeId, Pageable page);

    Optional<BridgeCommand> findByIdAndBridgeId(Long id, Long bridgeId);
}
