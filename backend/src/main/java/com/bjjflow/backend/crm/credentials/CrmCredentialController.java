package com.bjjflow.backend.crm.credentials;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.credentials.CrmCredentialDtos.CredentialResponse;
import com.bjjflow.backend.crm.credentials.CrmCredentialDtos.EnrollCredentialRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/crm")
@RequiredArgsConstructor
public class CrmCredentialController {

    private final CrmCredentialService crmCredentialService;

    @PostMapping("/members/{userId}/credentials")
    public CredentialResponse enroll(Authentication auth, @PathVariable Long userId,
            @Valid @RequestBody EnrollCredentialRequest request) {
        return crmCredentialService.enroll(callerId(auth), userId, request);
    }

    @GetMapping("/members/{userId}/credentials")
    public List<CredentialResponse> forMember(Authentication auth, @PathVariable Long userId) {
        return crmCredentialService.forMember(callerId(auth), userId);
    }

    @PutMapping("/credentials/{credentialId}/revoke")
    public CredentialResponse revoke(Authentication auth, @PathVariable Long credentialId) {
        return crmCredentialService.revoke(callerId(auth), credentialId);
    }

    private static Long callerId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
