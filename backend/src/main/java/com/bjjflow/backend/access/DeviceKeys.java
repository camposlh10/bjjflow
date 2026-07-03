package com.bjjflow.backend.access;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Device API key generation and hashing. Keys look like
 * {@code bjjd_<40 hex chars>}; only the SHA-256 hash is persisted.
 */
public final class DeviceKeys {

    private static final SecureRandom RANDOM = new SecureRandom();

    private DeviceKeys() {
    }

    public static String generate() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return "bjjd_" + HexFormat.of().formatHex(bytes);
    }

    public static String hash(String apiKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(apiKey.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 not available", exception);
        }
    }
}
