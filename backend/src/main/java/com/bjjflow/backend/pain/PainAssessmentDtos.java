package com.bjjflow.backend.pain;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public class PainAssessmentDtos {

    /** One painful area as submitted from the body map. */
    public record AreaInput(
            @NotBlank @Size(max = 40) String region,
            @Size(max = 20) String painType,
            @Min(0) @Max(10) int intensity,
            @Size(max = 300) String note) {
    }

    public record CreateAssessmentRequest(
            LocalDate onsetDate,
            @Size(max = 10) String trend,
            @Size(max = 20) String frequency,
            @Size(max = 500) String relieves,
            @Size(max = 500) String worsens,
            @Size(max = 1000) String notes,
            @NotEmpty @Valid List<AreaInput> areas) {
    }

    public record AreaDto(String region, String painType, int intensity, String note) {
    }

    /** A full assessment with its areas + derived average intensity & predominant type. */
    public record AssessmentDto(
            Long id,
            LocalDate assessedOn,
            LocalDate onsetDate,
            String trend,
            String frequency,
            String relieves,
            String worsens,
            String notes,
            List<AreaDto> areas,
            double avgIntensity,
            String predominantType) {
    }

    /** Compact row for the history list. */
    public record AssessmentSummaryDto(
            Long id,
            LocalDate assessedOn,
            int areaCount,
            double avgIntensity,
            String trend,
            String predominantType) {
    }
}
