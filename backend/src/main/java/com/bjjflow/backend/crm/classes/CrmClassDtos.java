package com.bjjflow.backend.crm.classes;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class CrmClassDtos {

    private CrmClassDtos() {
    }

    public record CreateClassRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank String sessionType,
            @NotNull @Min(1) @Max(7) Integer dayOfWeek,
            @NotBlank String startTime,
            @NotBlank String endTime,
            Long instructorUserId) {
    }

    public record UpdateClassRequest(
            String name,
            String sessionType,
            Integer dayOfWeek,
            String startTime,
            String endTime,
            Long instructorUserId,
            Boolean active) {
    }

    public record ClassResponse(
            Long id,
            String name,
            String sessionType,
            Integer dayOfWeek,
            String startTime,
            String endTime,
            Long instructorUserId,
            boolean active) {
    }
}
