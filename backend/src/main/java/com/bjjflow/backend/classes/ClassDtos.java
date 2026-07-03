package com.bjjflow.backend.classes;

import java.time.LocalDate;
import java.util.List;

import com.bjjflow.backend.gyms.GymDtos.BeltSummary;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ClassDtos {

    public record CreateClassRequest(
            @NotBlank @Size(max = 100) String name,
            Long instructorUserId,
            @NotNull @Min(1) @Max(7) Integer dayOfWeek,
            @NotBlank String startTime,
            @NotBlank String endTime,
            @NotBlank String sessionType,
            String restrictionMode,
            List<String> allowedBeltSlugs) {
    }

    public record ClassDto(
            Long id,
            String name,
            String instructorName,
            int dayOfWeek,
            String startTime,
            String endTime,
            String sessionType,
            String restrictionMode,
            String restrictionLabel) {
    }

    public record AgendaOccurrenceDto(
            Long classId,
            String name,
            String instructorName,
            String sessionType,
            String startTime,
            String endTime,
            LocalDate date,
            String restrictionLabel,
            boolean eligible,
            boolean checkedIn,
            boolean canCheckIn,
            boolean reserved,
            boolean canReserve,
            long attendeeCount) {
    }

    public record AttendeeDto(Long userId, String displayName, BeltSummary belt, String status) {
    }

    public record ReserveRequest(@NotNull LocalDate date) {
    }

    public record RosterEntryDto(Long userId, String displayName, BeltSummary belt, boolean present) {
    }

    public record MarkAttendanceRequest(@NotNull LocalDate date, @NotNull Long userId, boolean present) {
    }

    public record CheckInClassRequest(@NotNull LocalDate date) {
    }
}
