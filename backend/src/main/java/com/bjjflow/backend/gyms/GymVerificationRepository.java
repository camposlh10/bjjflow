package com.bjjflow.backend.gyms;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymVerificationRepository extends JpaRepository<GymVerification, Long> {

    Optional<GymVerification> findByGymId(Long gymId);

    List<GymVerification> findAllByStatusOrderByCreatedAtAsc(String status);
}
