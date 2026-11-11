package com.bjjflow.backend.config;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Per-IP request cap on the unauthenticated auth endpoints (login, register,
 * password reset, MFA, OAuth, refresh): slows credential stuffing and reset-code
 * guessing.
 *
 * Fixed one-minute windows, counted in memory, so the cap is per instance. That
 * is enough for a single instance; move the counters to a shared store before
 * running several.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final String AUTH_PREFIX = "/api/v1/auth/";
    private static final long WINDOW_MILLIS = 60_000;

    private record Key(String ip, boolean refresh, long window) {
    }

    private final ConcurrentHashMap<Key, AtomicInteger> counters = new ConcurrentHashMap<>();
    private final boolean enabled;
    private final int sensitiveLimit;
    private final int refreshLimit;

    public AuthRateLimitFilter(
            @Value("${app.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.rate-limit.auth-per-minute:20}") int sensitiveLimit,
            @Value("${app.rate-limit.refresh-per-minute:60}") int refreshLimit) {
        this.enabled = enabled;
        this.sensitiveLimit = sensitiveLimit;
        this.refreshLimit = refreshLimit;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || !"POST".equalsIgnoreCase(request.getMethod())
                || !request.getRequestURI().startsWith(AUTH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        // Refresh and logout are routine traffic (many phones can share one
        // carrier IP), so they get a looser budget than credential endpoints.
        String path = request.getRequestURI();
        boolean routine = path.endsWith("/refresh") || path.endsWith("/logout");
        long now = System.currentTimeMillis();
        Key key = new Key(request.getRemoteAddr(), routine, now / WINDOW_MILLIS);
        int count = counters.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet();
        if (count > (routine ? refreshLimit : sensitiveLimit)) {
            long retryAfter = Math.max(1, (WINDOW_MILLIS - now % WINDOW_MILLIS) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"code\":\"RATE_LIMITED\",\"message\":\"Too many attempts. Try again in a minute.\",\"fields\":null}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    /** Drops counters from past windows so the map cannot grow without bound. */
    @Scheduled(fixedDelay = WINDOW_MILLIS)
    void evictOldWindows() {
        long current = System.currentTimeMillis() / WINDOW_MILLIS;
        counters.keySet().removeIf(key -> key.window() < current);
    }
}
