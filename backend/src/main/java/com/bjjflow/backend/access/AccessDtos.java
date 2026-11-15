package com.bjjflow.backend.access;

import java.time.Instant;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class AccessDtos {

    private AccessDtos() {
    }

    public record CreateAccessEventRequest(
            @NotNull Long deviceId,
            Long studentUserId,
            @Size(max = 100) String externalMemberId,
            @NotNull Instant eventTime,
            @NotNull AccessEventSource source,
            @Size(max = 500) String notes,
            @Size(max = 100) String deviceEventId,
            AccessDirection direction) {
    }

    /**
     * Payload posted directly by hardware (authenticated by device API key).
     * The device is implied by the key; eventTime defaults to now for simple
     * devices without a reliable clock. deviceEventId is the device's own id
     * for the event: a resend with the same id returns the original result
     * instead of counting again. direction is ENTRY or EXIT when known; only
     * entries (or unknown) mark attendance.
     */
    public record HardwareAccessEventRequest(
            Long studentUserId,
            @Size(max = 100) String externalMemberId,
            Instant eventTime,
            AccessEventSource source,
            @Size(max = 500) String notes,
            @Size(max = 100) String deviceEventId,
            AccessDirection direction) {
    }

    public record AccessEventResponse(
            Long id,
            Long gymId,
            Long deviceId,
            Long studentUserId,
            String externalMemberId,
            Instant eventTime,
            String source,
            String status,
            boolean processed,
            Instant processedAt,
            Long matchedClassId,
            String notes,
            String deviceEventId,
            String direction) {
    }
}
