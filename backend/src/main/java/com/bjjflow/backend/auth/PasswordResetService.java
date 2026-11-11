package com.bjjflow.backend.auth;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * "Forgot password" via a one-time 6-digit code emailed to the user. Requesting a
 * code never reveals whether the email exists; reset verifies the latest unused,
 * non-expired code (15-minute TTL) and rotates the password.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TTL_MINUTES = 15;
    private static final int MAX_ATTEMPTS = 5;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.bjjflow.backend.jobs.JobQueue jobQueue;
    private final RefreshTokenService refreshTokenService;

    /** Always succeeds (no account enumeration). Emails a code only if the account exists. */
    @Transactional
    public void requestReset(String rawEmail) {
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        userRepository.findByEmail(email).ifPresent(user -> {
            String code = String.format("%06d", RANDOM.nextInt(1_000_000));
            PasswordResetToken token = new PasswordResetToken();
            token.setUserId(user.getId());
            token.setCodeHash(passwordEncoder.encode(code));
            token.setExpiresAt(Instant.now().plus(TTL_MINUTES, ChronoUnit.MINUTES));
            token.setUsed(false);
            tokenRepository.save(token);
            // Sent by a background job: the request answers at once (no timing hint
            // about whether the account exists) and delivery is retried on failure.
            jobQueue.enqueue(com.bjjflow.backend.email.EmailJobHandler.TYPE, java.util.Map.of(
                    "to", email,
                    "subject", "Seu código de redefinição — BJJ Flow",
                    "html", emailHtml(code)));
        });
    }

    // noRollbackFor: a wrong guess must still persist its attempt count.
    @Transactional(noRollbackFor = ApiException.class)
    public void resetPassword(String rawEmail, String code, String newPassword) {
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email).orElseThrow(PasswordResetService::invalid);
        PasswordResetToken token = tokenRepository
                .findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(user.getId())
                .orElseThrow(PasswordResetService::invalid);
        int attempts = token.getAttempts() == null ? 0 : token.getAttempts();
        if (token.getExpiresAt().isBefore(Instant.now()) || attempts >= MAX_ATTEMPTS) {
            throw invalid();
        }
        if (!passwordEncoder.matches(code, token.getCodeHash())) {
            token.setAttempts(attempts + 1);
            tokenRepository.save(token);
            throw invalid();
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setCredentialsChangedAt(Instant.now());
        userRepository.save(user);
        token.setUsed(true);
        tokenRepository.save(token);
        // Whoever knew the old password is signed out everywhere.
        refreshTokenService.revokeAllForUser(user.getId(), null);
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESET_CODE", "Invalid or expired reset code");
    }

    private static String emailHtml(String code) {
        return """
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
                  <h2 style="color:#E63946">BJJ Flow</h2>
                  <p>Use o código abaixo para redefinir sua senha. Ele expira em 15 minutos.</p>
                  <p style="font-size:32px;font-weight:bold;letter-spacing:6px">%s</p>
                  <p style="color:#777;font-size:13px">Se você não solicitou, ignore este e-mail.</p>
                </div>
                """.formatted(code);
    }
}
