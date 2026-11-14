package com.bjjflow.backend.storage;

import java.net.URI;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Reads from a private bucket: {@code GET /media/<key>} answers with a redirect
 * to a short-lived signed URL. The app keeps one stable URL per file (good for
 * image caches and the offline cache) while the bucket itself stays private.
 * Keys are random, so like a public bucket, knowing the URL is what grants access.
 */
@RestController
@ConditionalOnProperty(name = "app.media.provider", havingValue = "s3")
public class MediaReadController {

    /** Keys look like {@code posts/3f2a….jpg}: no traversal, no odd characters. */
    private static final Pattern KEY = Pattern.compile("[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*(\\.[A-Za-z0-9]+)?");

    private final S3MediaStorage storage;

    public MediaReadController(S3MediaStorage storage) {
        this.storage = storage;
    }

    @GetMapping("/media/**")
    public ResponseEntity<Void> read(HttpServletRequest request) {
        String key = request.getRequestURI().substring(request.getContextPath().length() + "/media/".length());
        if (!storage.isPrivate() || !KEY.matcher(key).matches()) {
            return ResponseEntity.notFound().build();
        }
        // Cached well inside the signed URL's lifetime, so a cached redirect never points at an expired URL.
        long cacheMinutes = S3MediaStorage.READ_URL_TTL.toMinutes() - 10;
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(storage.presignRead(key)))
                .cacheControl(CacheControl.maxAge(cacheMinutes, TimeUnit.MINUTES).cachePrivate())
                .build();
    }
}
