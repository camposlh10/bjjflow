package com.bjjflow.backend.access.enrollment;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.access.enrollment.EnrollmentDtos.CreateEnrollmentRequest;
import com.bjjflow.backend.access.enrollment.EnrollmentDtos.EnrollmentResponse;
import com.bjjflow.backend.access.enrollment.EnrollmentDtos.MemberAccessResponse;
import com.bjjflow.backend.access.enrollment.EnrollmentDtos.RecordConsentRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** A member's device access in the CRM: face consent and device registrations. */
@RestController
@RequestMapping("/api/v1/crm/members/{userId}/access")
@RequiredArgsConstructor
public class CrmEnrollmentController {

    private final EnrollmentService enrollmentService;

    @GetMapping
    public MemberAccessResponse get(Authentication auth, @PathVariable Long userId) {
        return enrollmentService.memberAccess(callerId(auth), userId);
    }

    @PostMapping("/face-consent")
    public MemberAccessResponse recordConsent(Authentication auth, @PathVariable Long userId,
            @Valid @RequestBody RecordConsentRequest request) {
        return enrollmentService.recordConsent(callerId(auth), userId, request);
    }

    @DeleteMapping("/face-consent")
    public MemberAccessResponse revokeConsent(Authentication auth, @PathVariable Long userId) {
        return enrollmentService.revokeConsent(callerId(auth), userId);
    }

    @PostMapping("/enrollments")
    public EnrollmentResponse enroll(Authentication auth, @PathVariable Long userId,
            @Valid @RequestBody CreateEnrollmentRequest request) {
        return enrollmentService.enroll(callerId(auth), userId, request);
    }

    @DeleteMapping("/enrollments/{enrollmentId}")
    public EnrollmentResponse remove(Authentication auth, @PathVariable Long userId,
            @PathVariable Long enrollmentId) {
        return enrollmentService.remove(callerId(auth), userId, enrollmentId);
    }

    private static Long callerId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
