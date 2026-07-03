package com.bjjflow.backend.auth;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import com.bjjflow.backend.auth.AuthDtos.AuthResponse;
import com.bjjflow.backend.auth.AuthDtos.ForgotPasswordRequest;
import com.bjjflow.backend.auth.AuthDtos.LoginRequest;
import com.bjjflow.backend.auth.AuthDtos.OAuthRequest;
import com.bjjflow.backend.auth.AuthDtos.RefreshRequest;
import com.bjjflow.backend.auth.AuthDtos.RegisterRequest;
import com.bjjflow.backend.auth.AuthDtos.ResetPasswordRequest;
import com.bjjflow.backend.auth.MfaDtos.MfaChallengeRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** Sign in or sign up with a Google/Apple ID token. */
    @PostMapping("/oauth")
    public AuthResponse oauth(@Valid @RequestBody OAuthRequest request) {
        return authService.oauthLogin(request);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request.refreshToken());
    }

    @PostMapping("/mfa")
    public AuthResponse completeMfa(@Valid @RequestBody MfaChallengeRequest request) {
        return authService.completeMfa(request.mfaToken(), request.code());
    }

    /** Always 200 (no account enumeration); emails a reset code if the account exists. */
    @PostMapping("/forgot-password")
    public Map<String, Boolean> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request.email());
        return Map.of("ok", true);
    }

    @PostMapping("/reset-password")
    public Map<String, Boolean> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.email(), request.code(), request.newPassword());
        return Map.of("ok", true);
    }
}
