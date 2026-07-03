package com.bjjflow.backend.pain;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface PainAssessmentAreaRepository extends JpaRepository<PainAssessmentArea, Long> {

    List<PainAssessmentArea> findByAssessmentIdOrderByIntensityDesc(Long assessmentId);

    List<PainAssessmentArea> findByAssessmentIdIn(Collection<Long> assessmentIds);

    @Transactional
    void deleteByAssessmentId(Long assessmentId);
}
