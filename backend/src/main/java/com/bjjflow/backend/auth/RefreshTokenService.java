package com.bjjflow.backend.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Server-side refresh tokens: opaque, stored hashed, rotated on every use and
 * revocable (logout, password change).
 *
 * Reuse handling: presenting a token that was already rotated normally means it
 * leaked, so the whole family is revoked. A short grace window is the exception:
 * a phone that fires two refreshes at once, or loses the response on a bad
 * connection, legitimately retries the old token seconds later.
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration REUSE_GRACE = Duration.ofSeconds(60);

    public record Rotation(Long userId, String refreshToken) {
    }

    private final RefreshTokenRepository repository;
    private final Duration ttl;

    public RefreshTokenService(RefreshTokenRepository repository,
            @Value("${app.jwt.refresh-ttl-days}") long refreshTtlDays) {
        this.repository = repository;
        this.ttl = Duration.ofDays(refreshTtlDays);
    }

    /** Starts a new session (login / register / OAuth) and returns the raw token. */
    @Transactional
    public String issue(Long userId) {
        return create(userId, UUID.randomUUID().toString());
    }

    /**
     * Exchanges a refresh token for the next one in its family. Empty when the
     * token is unknown, expired, revoked or reused. Never throws, so a family
     * revocation triggered by reuse is committed rather than rolled back.
     */
    @Transactional
    public Optional<Rotation> rotate(String rawToken) {
        RefreshToken current = repository.findByTokenHashForUpdate(hash(rawToken)).orElse(null);
        Instant now = Instant.now();
        if (current == null || current.getRevokedAt() != null || !current.getExpiresAt().isAfter(now)) {
            return Optional.empty();
        }
        if (current.getRotatedAt() != null) {
            if (current.getRotatedAt().plus(REUSE_GRACE).isBefore(now)) {
                int revoked = repository.revokeFamily(current.getFamilyId(), now);
                log.warn("Refresh token reuse for user {}: revoked {} token(s) in the session",
                        current.getUserId(), revoked);
                return Optional.empty();
            }
        } else {
            current.setRotatedAt(now);
            repository.save(current);
        }
        return Optional.of(new Rotation(current.getUserId(), create(current.getUserId(), current.getFamilyId())));
    }

    /** Ends the session the given token belongs to (logout). Unknown tokens are ignored. */
    @Transactional
    public void revokeSession(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        repository.findByTokenHash(hash(rawToken))
                .ifPresent(token -> repository.revokeFamily(token.getFamilyId(), Instant.now()));
    }

    /**
     * Ends every session of the user. Pass the caller's own refresh token as
     * {@code keepRawToken} to keep the device that made the change signed in.
     */
    @Transactional
    public void revokeAllForUser(Long userId, String keepRawToken) {
        String keepFamily = null;
        if (keepRawToken != null && !keepRawToken.isBlank()) {
            keepFamily = repository.findByTokenHash(hash(keepRawToken))
                    .filter(token -> token.getUserId().equals(userId))
                    .map(RefreshToken::getFamilyId)
                    .orElse(null);
        }
        if (keepFamily == null) {
            repository.revokeAllForUser(userId, Instant.now());
        } else {
            repository.revokeAllForUserExcept(userId, keepFamily, Instant.now());
        }
    }

    /** Housekeeping: rows are useless once past their expiry. */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeExpired() {
        int deleted = repository.deleteExpiredBefore(Instant.now().minus(Duration.ofDays(1)));
        if (deleted > 0) {
            log.info("Purged {} expired refresh token(s)", deleted);
        }
    }

    private String create(Long userId, String familyId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken token = new RefreshToken();
        token.setUserId(userId);
        token.setFamilyId(familyId);
        token.setTokenHash(hash(raw));
        token.setExpiresAt(Instant.now().plus(ttl));
        repository.save(token);
        return raw;
    }

    static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
