package com.bjjflow.backend.events;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

public class EventDtos {

    /** One row in the academy community feed. */
    public record ActivityItemDto(
            String type,
            Long userId,
            String userName,
            String beltSlug,
            Integer value,
            String text,
            Instant occurredAt) {
    }

    /** One entry in the personal journey timeline. */
    public record TimelineItemDto(
            String type,
            Integer value,
            String text,
            String beltSlug,
            Instant occurredAt) {
    }

    public record BeltProgressDto(
            String slug,
            String namePt,
            String colorHex,
            int stripes,
            Instant beltSince,
            long trainingsSinceBelt) {
    }

    public record JourneyDto(List<TimelineItemDto> timeline, BeltProgressDto belt) {
    }

    public record LogCompetitionRequest(
            @NotBlank @Size(max = 120) String name,
            @Min(1) @Max(99) Integer placement,
            @NotNull @PastOrPresent LocalDate date) {
    }
}
