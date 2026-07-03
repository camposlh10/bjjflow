package com.bjjflow.backend.auth;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

public class MfaDtos {

    /** Returned on enrollment — show the QR (otpauthUri), the secret, and the recovery codes once. */
    public record EnrollResponse(String secret, String otpauthUri, List<String> recoveryCodes) {
    }

    public record EnableRequest(@NotBlank String code) {
    }

    public record DisableRequest(@NotBlank String password) {
    }

    /** Completes a login that was challenged for MFA. {@code code} is a TOTP or a recovery code. */
    public record MfaChallengeRequest(@NotBlank String mfaToken, @NotBlank String code) {
    }

    public record MfaStatusDto(boolean enabled) {
    }
}
