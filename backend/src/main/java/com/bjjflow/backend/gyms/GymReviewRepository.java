package com.bjjflow.backend.gyms;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymReviewRepository extends JpaRepository<GymReview, Long> {

    List<GymReview> findAllByGymIdOrderByCreatedAtDesc(Long gymId);

    Optional<GymReview> findByGymIdAndUserId(Long gymId, Long userId);
}
