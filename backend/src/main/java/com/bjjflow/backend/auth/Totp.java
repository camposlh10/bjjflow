package com.bjjflow.backend.auth;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Minimal, dependency-free TOTP (RFC 6238): SHA-1, 30s period, 6 digits — the
 * scheme every authenticator app (Google Authenticator, Authy, 1Password) uses.
 */
public final class Totp {

    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final String RECOVERY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int DIGITS = 6;
    private static final long PERIOD_SECONDS = 30;
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    /** A fresh base32-encoded 20-byte secret. */
    public static String generateSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32Encode(bytes);
    }

    /** The current 6-digit code — used by tests and code generation. */
    public static String currentCode(String base32Secret) {
        return code(base32Secret, System.currentTimeMillis() / 1000L / PERIOD_SECONDS);
    }

    /** True if {@code input} matches the current code within a ±1 step window. */
    public static boolean verify(String base32Secret, String input) {
        if (base32Secret == null || input == null) {
            return false;
        }
        String normalized = input.trim().replace(" ", "");
        if (!normalized.matches("\\d{6}")) {
            return false;
        }
        long counter = System.currentTimeMillis() / 1000L / PERIOD_SECONDS;
        for (long w = -1; w <= 1; w++) {
            if (code(base32Secret, counter + w).equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    /** otpauth:// URI for QR provisioning. */
    public static String otpauthUri(String issuer, String account, String base32Secret) {
        return "otpauth://totp/" + url(issuer) + ":" + url(account)
                + "?secret=" + base32Secret + "&issuer=" + url(issuer) + "&algorithm=SHA1&digits=6&period=30";
    }

    /** n single-use recovery codes shaped like "AB3D-7KQ9". */
    public static String[] recoveryCodes(int n) {
        String[] codes = new String[n];
        for (int i = 0; i < n; i++) {
            codes[i] = group() + "-" + group();
        }
        return codes;
    }

    private static String group() {
        StringBuilder sb = new StringBuilder(4);
        for (int i = 0; i < 4; i++) {
            sb.append(RECOVERY_CHARS.charAt(RANDOM.nextInt(RECOVERY_CHARS.length())));
        }
        return sb.toString();
    }

    private static String code(String base32Secret, long counter) {
        byte[] key = base32Decode(base32Secret);
        byte[] data = new byte[8];
        long c = counter;
        for (int i = 7; i >= 0; i--) {
            data[i] = (byte) (c & 0xff);
            c >>= 8;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(data);
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);
            int otp = binary % (int) Math.pow(10, DIGITS);
            return String.format("%0" + DIGITS + "d", otp);
        } catch (Exception e) {
            throw new IllegalStateException("TOTP generation failed", e);
        }
    }

    static String base32Encode(byte[] data) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0;
        int bitsLeft = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                sb.append(BASE32.charAt((buffer >> (bitsLeft - 5)) & 0x1f));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            sb.append(BASE32.charAt((buffer << (5 - bitsLeft)) & 0x1f));
        }
        return sb.toString();
    }

    static byte[] base32Decode(String s) {
        String clean = s.trim().replace("=", "").toUpperCase();
        int buffer = 0;
        int bitsLeft = 0;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (char c : clean.toCharArray()) {
            int val = BASE32.indexOf(c);
            if (val < 0) {
                continue;
            }
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out.write((buffer >> (bitsLeft - 8)) & 0xff);
                bitsLeft -= 8;
            }
        }
        return out.toByteArray();
    }

    private static String url(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
