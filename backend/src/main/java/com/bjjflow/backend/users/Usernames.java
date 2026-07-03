package com.bjjflow.backend.users;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Username (@handle) sanitization + validation. Handles are stored lowercased. */
public final class Usernames {

    public static final int MAX_LENGTH = 30;
    private static final Pattern VALID = Pattern.compile("^[a-z0-9_]{3,30}$");

    private Usernames() {
    }

    /** Strips accents and any non [a-z0-9] character, lowercased and length-capped. */
    public static String sanitize(String input) {
        if (input == null) {
            return "";
        }
        String n = Normalizer.normalize(input, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        n = n.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return n.length() > MAX_LENGTH ? n.substring(0, MAX_LENGTH) : n;
    }

    public static boolean isValid(String username) {
        return username != null && VALID.matcher(username).matches();
    }
}
