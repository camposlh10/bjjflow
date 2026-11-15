package com.bjjflow.backend.access.enrollment;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BiometricConsentRepository extends JpaRepository<BiometricConsent, Long> {

    Optional<BiometricConsent> findFirstByGymIdAndUserIdAndRevokedAtIsNullOrderByIdDesc(Long gymId, Long userId);
}
