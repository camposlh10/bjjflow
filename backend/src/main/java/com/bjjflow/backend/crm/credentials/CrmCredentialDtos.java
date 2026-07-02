package com.bjjflow.backend.crm.credentials;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CrmCredentialDtos {

    private CrmCredentialDtos() {
    }

    public record EnrollCredentialRequest(
            @NotBlank String type,
            @NotBlank @Size(max = 150) String value,
            @Size(max = 100) String label) {
    }

    public record CredentialResponse(
            Long id,
            Long gymId,
            Long userId,
            String type,
            String value,
            String label,
            boolean active,
            Instant createdAt,
            Instant revokedAt) {
    }
}
