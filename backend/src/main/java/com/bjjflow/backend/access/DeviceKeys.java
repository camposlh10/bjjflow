package com.bjjflow.backend.access;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * API key generation and hashing for machine integrations (access devices,
 * POS webhooks). Keys look like {@code <prefix>_<40 hex chars>}; only the
 * SHA-256 hash is persisted.
 */
public final class DeviceKeys {

    private static final SecureRandom RANDOM = new SecureRandom();

    private DeviceKeys() {
    }

    public static String generate() {
        return generate("bjjd");
    }

    public static String generate(String prefix) {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return prefix + "_" + HexFormat.of().formatHex(bytes);
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
