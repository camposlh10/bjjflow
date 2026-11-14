package com.bjjflow.backend.common.idempotency;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Makes any signed-in write safe to repeat. When a POST/PUT/PATCH/DELETE carries
 * an {@code Idempotency-Key} header:
 * <ul>
 * <li>first time: the request runs normally and its response is stored;</li>
 * <li>again with the same key: the stored response is returned as is (header
 * {@code Idempotent-Replayed: true}) and nothing runs a second time;</li>
 * <li>again while the first is still running: 409 {@code IDEMPOTENCY_IN_PROGRESS},
 * so the app retries a moment later;</li>
 * <li>the same key on a different endpoint: 422, a client bug.</li>
 * </ul>
 * Server errors (5xx) are not stored, so the request can genuinely be retried.
 * Requests without the header behave exactly as before.
 *
 * Registered in the security chain right after authentication (see SecurityConfig).
 */
public class IdempotencyFilter extends OncePerRequestFilter {

    public static final String HEADER = "Idempotency-Key";
    public static final String REPLAYED = "Idempotent-Replayed";
    private static final Set<String> WRITES = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final Pattern VALID_KEY = Pattern.compile("[A-Za-z0-9_.:-]{8,100}");
    /** Larger responses are not worth keeping; a replay then gets an empty 200-style body. */
    private static final int MAX_STORED_BODY = 256 * 1024;

    private final IdempotencyStore store;

    public IdempotencyFilter(IdempotencyStore store) {
        this.store = store;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!WRITES.contains(request.getMethod()) || request.getHeader(HEADER) == null) {
            return true;
        }
        String contentType = request.getContentType();
        // Uploads are streamed and huge; they are online-only in the app anyway.
        return contentType != null && contentType.toLowerCase().startsWith("multipart/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Long userId = currentUserId();
        if (userId == null) {
            // Not signed in (auth endpoints, webhooks): nothing to scope the key to.
            chain.doFilter(request, response);
            return;
        }
        String key = request.getHeader(HEADER).trim();
        if (!VALID_KEY.matcher(key).matches()) {
            error(response, 400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 8-100 safe characters");
            return;
        }
        String method = request.getMethod();
        String path = request.getRequestURI();

        Optional<IdempotencyStore.Existing> existing = store.reserve(userId, key, method, path);
        if (existing.isPresent()) {
            IdempotencyStore.Existing earlier = existing.get();
            if (!earlier.method().equals(method) || !earlier.path().equals(path)) {
                error(response, 422, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was used for another request");
            } else if (!earlier.done()) {
                error(response, 409, "IDEMPOTENCY_IN_PROGRESS", "The original request is still being processed");
            } else {
                replay(response, earlier);
            }
            return;
        }

        ContentCachingResponseWrapper wrapper = new ContentCachingResponseWrapper(response);
        boolean stored = false;
        try {
            chain.doFilter(request, wrapper);
            int status = wrapper.getStatus();
            if (status < 500) {
                byte[] body = wrapper.getContentAsByteArray();
                String text = body.length <= MAX_STORED_BODY ? new String(body, StandardCharsets.UTF_8) : null;
                store.complete(userId, key, status, wrapper.getContentType(), text);
                stored = true;
            }
        } finally {
            if (!stored) {
                store.release(userId, key);
            }
            wrapper.copyBodyToResponse();
        }
    }

    private static Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            return null;
        }
        try {
            return Long.parseLong(auth.getName());
        } catch (NumberFormatException notAUser) {
            return null;
        }
    }

    private static void replay(HttpServletResponse response, IdempotencyStore.Existing earlier) throws IOException {
        response.setStatus(earlier.status() == null ? 200 : earlier.status());
        response.setHeader(REPLAYED, "true");
        if (earlier.contentType() != null) {
            response.setContentType(earlier.contentType());
        }
        if (earlier.body() != null && !earlier.body().isEmpty()) {
            byte[] bytes = earlier.body().getBytes(StandardCharsets.UTF_8);
            response.setContentLength(bytes.length);
            response.getOutputStream().write(bytes);
        }
    }

    private static void error(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\",\"fields\":null}");
    }
}
