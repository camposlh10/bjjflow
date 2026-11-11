package com.bjjflow.backend.storage;

import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/** Generates storage keys. The same shape is used by every provider. */
public final class MediaKeys {

    private static final Pattern SAFE_EXTENSION = Pattern.compile("\\.[a-z0-9]{1,5}");

    private MediaKeys() {
    }

    /** A fresh, unguessable key such as {@code posts/3f2a….jpg}. */
    public static String newKey(String contentType, String originalFilename) {
        return "posts/" + UUID.randomUUID() + extensionFor(contentType, originalFilename);
    }

    static String extensionFor(String contentType, String originalFilename) {
        if (contentType != null) {
            switch (contentType.toLowerCase(Locale.ROOT)) {
                case "image/jpeg":
                    return ".jpg";
                case "image/png":
                    return ".png";
                case "image/webp":
                    return ".webp";
                case "image/heic":
                    return ".heic";
                case "video/mp4":
                    return ".mp4";
                case "video/quicktime":
                    return ".mov";
                default:
                    break;
            }
        }
        if (originalFilename != null && originalFilename.contains(".")) {
            String ext = originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase(Locale.ROOT);
            // The filename is client-supplied: only a plain short extension may reach the key.
            if (SAFE_EXTENSION.matcher(ext).matches()) {
                return ext;
            }
        }
        return "";
    }
}
