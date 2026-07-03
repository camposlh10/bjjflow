package com.bjjflow.backend.auth;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.bjjflow.backend.oauth.OAuthProvider;

public class AuthDtos {

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 100) String displayName,
            @Size(max = 60) String firstName,
            @Size(max = 60) String lastName,
            @Size(max = 30) String username,
            @Size(max = 20) String gender,
            @Size(max = 120) String city,
            @Size(max = 80) String country,
            @Size(max = 80) String state,
            @Size(max = 40) String favoriteArt,
            @Min(1900) @Max(2100) Integer trainingStartYear,
            @NotNull @Min(4) @Max(100) Integer age,
            @NotBlank String beltSlug,
            @Min(0) @Max(6) Integer stripes,
            @DecimalMin("20.0") @DecimalMax("250.0") BigDecimal weightKg,
            @Min(80) @Max(230) Integer heightCm) {
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record OAuthRequest(
            @NotNull OAuthProvider provider,
            @NotBlank String idToken,
            @Size(max = 100) String displayName) {
    }

    public record ForgotPasswordRequest(@NotBlank @Email String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Email String email,
            @NotBlank String code,
            @NotBlank @Size(min = 8, max = 72) String newPassword) {
    }

    public record BeltDto(String slug, String name, String namePt, String colorHex, Integer stripes) {
    }

    public record UserDto(Long id, String email, String username, String displayName, Integer age,
            BigDecimal weightKg, Integer heightCm, BeltDto belt, boolean admin, boolean pro) {
    }

    public record AuthResponse(String accessToken, String refreshToken, UserDto user, boolean mfaRequired,
            String mfaToken) {

        public static AuthResponse tokens(String accessToken, String refreshToken, UserDto user) {
            return new AuthResponse(accessToken, refreshToken, user, false, null);
        }

        public static AuthResponse mfaChallenge(String mfaToken) {
            return new AuthResponse(null, null, null, true, mfaToken);
        }
    }
}
