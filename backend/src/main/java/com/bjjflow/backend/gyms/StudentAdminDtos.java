package com.bjjflow.backend.gyms;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.bjjflow.backend.auth.AuthDtos.BeltDto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class StudentAdminDtos {

    public record GraduationDto(
            long classesSincePromotion,
            int graduationTarget,
            boolean ready,
            Long daysInBelt,
            Instant lastPromotedAt) {
    }

    public record AttendanceDto(long totalClasses, long last30Days, LocalDate lastAttended, Instant memberSince) {
    }

    public record PromotionDto(String beltSlug, String beltNamePt, String colorHex, int stripes, Instant date) {
    }

    /** One entry in the instructor's class-attendance log for a student. */
    public record AttendanceEntryDto(LocalDate date, String className) {
    }

    public record StudentAdminDto(
            Long userId,
            String username,
            String displayName,
            String avatarUrl,
            boolean pro,
            String role,
            BeltDto belt,
            GraduationDto graduation,
            AttendanceDto attendance,
            List<PromotionDto> history,
            List<AttendanceEntryDto> recentAttendance) {
    }

    public record NoteDto(Long id, String authorName, String content, Instant createdAt) {
    }

    public record CreateNoteRequest(@NotBlank @Size(max = 2000) String content) {
    }
}
