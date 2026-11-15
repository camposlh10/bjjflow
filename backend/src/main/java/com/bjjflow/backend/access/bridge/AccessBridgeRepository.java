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

public interface AccessBridgeRepository extends JpaRepository<AccessBridge, Long> {

    Optional<AccessBridge> findByApiKeyHashAndActiveTrue(String apiKeyHash);

    List<AccessBridge> findAllByGymIdOrderByIdAsc(Long gymId);

    Optional<AccessBridge> findByIdAndGymId(Long id, Long gymId);

    List<AccessBridge> findAllByActiveTrueAndLastSeenAtIsNotNull();
}
