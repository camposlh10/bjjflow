package com.bjjflow.backend.pain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One painful body region within a PainAssessment (region + type + intensity). */
@Entity
@Table(name = "pain_assessment_areas")
@Getter
@Setter
@NoArgsConstructor
public class PainAssessmentArea {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assessment_id")
    private Long assessmentId;

    private String region;

    @Column(name = "pain_type")
    private String painType;

    private Integer intensity;

    private String note;
}
