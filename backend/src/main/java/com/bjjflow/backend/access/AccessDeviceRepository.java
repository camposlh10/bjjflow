package com.bjjflow.backend.access;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AccessDeviceRepository extends JpaRepository<AccessDevice, Long> {

    Optional<AccessDevice> findByIdAndActiveTrue(Long id);

    Optional<AccessDevice> findByApiKeyHashAndActiveTrue(String apiKeyHash);

    Optional<AccessDevice> findByIdAndGymId(Long id, Long gymId);

    List<AccessDevice> findAllByGymIdOrderByIdAsc(Long gymId);
}
