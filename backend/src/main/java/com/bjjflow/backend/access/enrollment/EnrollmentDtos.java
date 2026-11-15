package com.bjjflow.backend.access.enrollment;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class EnrollmentDtos {

    private EnrollmentDtos() {
    }

    /** Staff confirm the member agreed (e.g. signed the form) to this version of the terms. */
    public record RecordConsentRequest(
            @NotBlank @Size(max = 20) String termsVersion,
            @NotNull @AssertTrue(message = "the member's consent must be confirmed") Boolean memberAgreed) {
    }

    public record CreateEnrollmentRequest(
            @NotNull Long deviceId,
            @NotNull DeviceEnrollment.Method method,
            /* CARD only: the number as printed ("123.45678" = facility.card) or the raw value */
            @Size(max = 40) @Pattern(regexp = "^$|^[0-9]{1,20}([.,][0-9]{1,10})?$",
                    message = "must be digits, or facility.card") String cardValue) {
    }

    public record ConsentResponse(
            Long id,
            String termsVersion,
            Instant grantedAt,
            Long recordedByUserId) {
    }

    public record EnrollmentResponse(
            Long id,
            Long deviceId,
            String deviceName,
            String method,
            String cardValue,
            String status,
            String lastError,
            Instant createdAt,
            Instant updatedAt) {
    }

    /** Everything the CRM shows for a member's device access. */
    public record MemberAccessResponse(
            ConsentResponse faceConsent,
            String currentTermsVersion,
            List<EnrollmentResponse> enrollments) {
    }
}
