package com.bjjflow.backend.checkins;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CheckInDtos {

    public record SubmissionInput(
            @jakarta.validation.constraints.NotBlank @Size(max = 40) String submission,
            @jakarta.validation.constraints.NotBlank @Size(max = 10) String direction,
            @Min(1) @Max(50) int count) {
    }

    public record CreateCheckInRequest(
            @NotNull LocalDate date,
            @Size(max = 20) String sessionType,
            @Min(5) @Max(600) Integer durationMinutes,
            @Size(max = 500) String notes,
            @Size(max = 10) String visibility,
            @Size(max = 255) String photoKey,
            @Size(max = 100) @jakarta.validation.Valid List<SubmissionInput> submissions) {
    }

    public record CheckInDto(Long id, LocalDate date, String sessionType, Integer durationMinutes, String notes) {
    }

    public record StatsResponse(
            int currentStreak,
            int longestStreak,
            long totalCheckIns,
            long totalHours,
            int weeklyGoal,
            int weeklyProgress,
            boolean checkedInToday,
            List<Boolean> weekDays,
            long activeWeeks,
            /** Training load: minutes trained this ISO week and last week. */
            int weeklyMinutes,
            int lastWeekMinutes,
            /** Estimated calories this week (null when no body weight on file). */
            Long weeklyCalories) {
    }
}
