package com.bjjflow.backend.crm.attendance;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;

public final class CrmAttendanceDtos {

    private CrmAttendanceDtos() {
    }

    public record MarkAttendanceRequest(
            @NotNull Long classId,
            @NotNull Long userId,
            @NotNull LocalDate date,
            String status,
            Boolean present) {
    }

    public record AttendanceChangeResponse(
            Long classId,
            Long userId,
            LocalDate date,
            boolean present,
            String status) {
    }

    public record AttendanceResponse(
            Long id,
            Long classId,
            String className,
            LocalDate date,
            Long userId,
            String displayName,
            String status,
            Long markedByUserId) {
    }

    public record AccessEventReviewResponse(
            Long id,
            Long deviceId,
            String deviceName,
            Long studentUserId,
            String displayName,
            String externalMemberId,
            Instant eventTime,
            String source,
            String status,
            boolean processed,
            Long matchedClassId,
            String notes) {
    }
}
