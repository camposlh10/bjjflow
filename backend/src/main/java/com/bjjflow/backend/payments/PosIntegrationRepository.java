package com.bjjflow.backend.payments;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PosIntegrationRepository extends JpaRepository<PosIntegration, Long> {

    Optional<PosIntegration> findByApiKeyHashAndActiveTrue(String apiKeyHash);

    Optional<PosIntegration> findByIdAndGymId(Long id, Long gymId);

    List<PosIntegration> findAllByGymIdOrderByIdAsc(Long gymId);
}
