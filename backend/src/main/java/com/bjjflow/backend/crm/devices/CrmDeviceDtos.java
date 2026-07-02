package com.bjjflow.backend.crm.devices;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CrmDeviceDtos {

    private CrmDeviceDtos() {
    }

    public record CreateDeviceRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Size(max = 40) String type,
            @Size(max = 100) String provider,
            @Size(max = 150) String location) {
    }

    public record UpdateDeviceRequest(
            @Size(max = 100) String name,
            @Size(max = 40) String type,
            @Size(max = 100) String provider,
            @Size(max = 150) String location,
            Boolean active) {
    }

    public record DeviceResponse(
            Long id,
            Long gymId,
            String name,
            String type,
            String provider,
            String location,
            boolean active,
            Instant createdAt,
            Instant lastSeenAt) {
    }

    /** Returned only on registration and key rotation; the key is not stored. */
    public record DeviceWithKeyResponse(
            DeviceResponse device,
            String apiKey) {
    }
}
