package com.bjjflow.backend.gyms;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.common.ApiException;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class GymVerificationController {

    private final GymVerificationService verificationService;
    private final GymService gymService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    /** Owner submits CNPJ + certificate + establishment photos; runs AI triage. */
    @PostMapping("/gyms/me/verification")
    public GymDtos.GymDto submit(Authentication auth,
            @Valid @RequestBody GymDtos.SubmitVerificationRequest request) {
        Long uid = userId(auth);
        verificationService.submit(uid, request);
        return gymService.getMyGym(uid)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "Você não está em uma academia"));
    }

    /** Admin (config-gated): submissions the AI couldn't decide. */
    @GetMapping("/admin/verifications")
    public List<GymDtos.VerificationAdminDto> review(Authentication auth) {
        // gated inside decide(); listing is admin-only too — reuse the same guard by
        // attempting it through the service, which checks the caller. Listing itself
        // is harmless metadata, but keep it admin-only for consistency:
        return verificationService.listForReviewAsAdmin(userId(auth));
    }

    @PostMapping("/admin/verifications/{id}/decision")
    public GymDtos.VerificationAdminDto decide(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody GymDtos.AdminDecisionRequest request) {
        return verificationService.decide(userId(auth), id, request.approve(), request.notes());
    }
}
