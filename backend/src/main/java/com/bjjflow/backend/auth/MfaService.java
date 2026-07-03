package com.bjjflow.backend.auth;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.auth.MfaDtos.EnrollResponse;
import com.bjjflow.backend.auth.MfaDtos.MfaStatusDto;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MfaService {

    private static final int RECOVERY_COUNT = 8;

    private final UserRepository userRepository;
    private final MfaRecoveryCodeRepository recoveryRepository;
    private final PasswordEncoder passwordEncoder;

    /** Generate a secret + recovery codes. MFA is NOT active until {@link #enable} confirms a code. */
    @Transactional
    public EnrollResponse enroll(Long userId) {
        User u = requireUser(userId);
        String secret = Totp.generateSecret();
        u.setTotpSecret(secret);
        u.setMfaEnabled(false);
        userRepository.save(u);

        recoveryRepository.deleteByUserId(userId);
        String[] codes = Totp.recoveryCodes(RECOVERY_COUNT);
        for (String c : codes) {
            MfaRecoveryCode rc = new MfaRecoveryCode();
            rc.setUserId(userId);
            rc.setCodeHash(passwordEncoder.encode(c));
            recoveryRepository.save(rc);
        }
        return new EnrollResponse(secret, Totp.otpauthUri("BJJ Flow", u.getEmail(), secret), List.of(codes));
    }

    @Transactional
    public MfaStatusDto enable(Long userId, String code) {
        User u = requireUser(userId);
        if (u.getTotpSecret() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MFA_NOT_ENROLLED", "Start MFA enrollment first");
        }
        if (!Totp.verify(u.getTotpSecret(), code)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MFA_CODE", "Invalid authenticator code");
        }
        u.setMfaEnabled(true);
        userRepository.save(u);
        return new MfaStatusDto(true);
    }

    @Transactional
    public MfaStatusDto disable(Long userId, String password) {
        User u = requireUser(userId);
        if (!passwordEncoder.matches(password, u.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WRONG_PASSWORD", "Password is incorrect");
        }
        u.setMfaEnabled(false);
        u.setTotpSecret(null);
        userRepository.save(u);
        recoveryRepository.deleteByUserId(userId);
        return new MfaStatusDto(false);
    }

    /** Verify a login-challenge code: a current TOTP, or a single-use recovery code (consumed on match). */
    @Transactional
    public boolean verifyChallenge(User user, String code) {
        if (Totp.verify(user.getTotpSecret(), code)) {
            return true;
        }
        for (MfaRecoveryCode rc : recoveryRepository.findByUserIdAndUsedFalse(user.getId())) {
            if (passwordEncoder.matches(code.trim(), rc.getCodeHash())) {
                rc.setUsed(true);
                recoveryRepository.save(rc);
                return true;
            }
        }
        return false;
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
    }
}
