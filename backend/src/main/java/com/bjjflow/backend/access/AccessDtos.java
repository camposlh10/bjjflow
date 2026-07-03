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
            @Size(max = 500) String notes) {
    }

    /**
     * Payload posted directly by hardware (authenticated by device API key).
     * The device is implied by the key; eventTime defaults to now for simple
     * devices without a reliable clock.
     */
    public record HardwareAccessEventRequest(
            Long studentUserId,
            @Size(max = 100) String externalMemberId,
            Instant eventTime,
            AccessEventSource source,
            @Size(max = 500) String notes) {
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
            String notes) {
    }
}
