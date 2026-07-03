package com.bjjflow.backend.gyms;

/** CNPJ (Brazilian company registry) helpers: normalize, checksum-validate, format. */
public final class Cnpj {

    private Cnpj() {
    }

    /** Strips everything but digits. */
    public static String digits(String raw) {
        return raw == null ? "" : raw.replaceAll("\\D", "");
    }

    /** Validates the 14-digit CNPJ including its two check digits. */
    public static boolean isValid(String raw) {
        String c = digits(raw);
        if (c.length() != 14) {
            return false;
        }
        // reject sequences like 00000000000000 / 11111111111111
        if (c.chars().distinct().count() == 1) {
            return false;
        }
        return checkDigit(c, 12) == c.charAt(12) - '0' && checkDigit(c, 13) == c.charAt(13) - '0';
    }

    private static int checkDigit(String c, int len) {
        int[] weights12 = { 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
        int[] weights13 = { 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
        int[] w = len == 12 ? weights12 : weights13;
        int sum = 0;
        for (int i = 0; i < len; i++) {
            sum += (c.charAt(i) - '0') * w[i];
        }
        int mod = sum % 11;
        return mod < 2 ? 0 : 11 - mod;
    }

    /** Formats as 12.345.678/0001-90 (returns the raw digits if not 14 long). */
    public static String format(String raw) {
        String c = digits(raw);
        if (c.length() != 14) {
            return c;
        }
        return c.substring(0, 2) + "." + c.substring(2, 5) + "." + c.substring(5, 8)
                + "/" + c.substring(8, 12) + "-" + c.substring(12);
    }
}
