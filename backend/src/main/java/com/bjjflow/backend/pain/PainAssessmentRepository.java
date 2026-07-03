package com.bjjflow.backend.pain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PainAssessmentRepository extends JpaRepository<PainAssessment, Long> {

    List<PainAssessment> findByUserIdOrderByAssessedOnDescIdDesc(Long userId, Pageable pageable);

    Optional<PainAssessment> findFirstByUserIdOrderByAssessedOnDescIdDesc(Long userId);

    Optional<PainAssessment> findByIdAndUserId(Long id, Long userId);
}
