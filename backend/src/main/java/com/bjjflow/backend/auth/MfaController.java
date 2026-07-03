package com.bjjflow.backend.auth;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.auth.MfaDtos.DisableRequest;
import com.bjjflow.backend.auth.MfaDtos.EnableRequest;
import com.bjjflow.backend.auth.MfaDtos.EnrollResponse;
import com.bjjflow.backend.auth.MfaDtos.MfaStatusDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/users/me/mfa")
@RequiredArgsConstructor
public class MfaController {

    private final MfaService mfaService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @PostMapping("/enroll")
    public EnrollResponse enroll(Authentication auth) {
        return mfaService.enroll(userId(auth));
    }

    @PostMapping("/enable")
    public MfaStatusDto enable(Authentication auth, @Valid @RequestBody EnableRequest req) {
        return mfaService.enable(userId(auth), req.code());
    }

    @PostMapping("/disable")
    public MfaStatusDto disable(Authentication auth, @Valid @RequestBody DisableRequest req) {
        return mfaService.disable(userId(auth), req.password());
    }
}
