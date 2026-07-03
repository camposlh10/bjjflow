package com.bjjflow.backend.pain;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class PainDtos {

    /** One region's current pain state for the body map. */
    public record PainEntryDto(String region, int intensity, String note, LocalDate occurredAt) {
    }

    public record LogPainRequest(
            @NotBlank @Size(max = 30) String region,
            @NotNull @Min(0) @Max(10) Integer intensity,
            @Size(max = 300) String note) {
    }

    public record PainHistoryDto(Long id, String region, int intensity, String note, LocalDate occurredAt) {
    }

    public record PainMapDto(List<PainEntryDto> regions) {
    }

    /** One region's monthly aggregate: peak intensity + how many days it hurt. */
    public record MonthlyRegionDto(String region, int intensity, int days) {
    }

    public record PainMonthlyDto(String month, List<MonthlyRegionDto> regions) {
    }
}
