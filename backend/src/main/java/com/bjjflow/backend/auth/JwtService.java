package com.bjjflow.backend.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    public record ParsedToken(Long userId, String type) {
    }

    private final SecretKey key;
    private final long accessTtlMinutes;
    private final long refreshTtlDays;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-ttl-minutes}") long accessTtlMinutes,
            @Value("${app.jwt.refresh-ttl-days}") long refreshTtlDays) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtlMinutes = accessTtlMinutes;
        this.refreshTtlDays = refreshTtlDays;
    }

    public String createAccessToken(Long userId) {
        return createToken(userId, "access", Instant.now().plus(accessTtlMinutes, ChronoUnit.MINUTES));
    }

    public String createRefreshToken(Long userId) {
        return createToken(userId, "refresh", Instant.now().plus(refreshTtlDays, ChronoUnit.DAYS));
    }

    /** Short-lived token issued after password check, exchanged for real tokens once MFA is satisfied. */
    public String createMfaToken(Long userId) {
        return createToken(userId, "mfa", Instant.now().plus(5, ChronoUnit.MINUTES));
    }

    private String createToken(Long userId, String type, Instant expiresAt) {
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("type", type)
                .issuedAt(new Date())
                .expiration(Date.from(expiresAt))
                .signWith(key)
                .compact();
    }

    public Optional<ParsedToken> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(new ParsedToken(
                    Long.parseLong(claims.getSubject()),
                    claims.get("type", String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
