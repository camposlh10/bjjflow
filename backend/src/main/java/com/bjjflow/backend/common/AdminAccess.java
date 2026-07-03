package com.bjjflow.backend.common;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Simple config-based admin gate until a real admin role/panel exists.
 * Emails listed in {@code app.admin-emails} (env APP_ADMIN_EMAILS, comma-separated)
 * may approve/reject gym verifications.
 */
@Component
public class AdminAccess {

    private final Set<String> admins;

    public AdminAccess(@Value("${app.admin-emails:}") String csv) {
        this.admins = Arrays.stream(csv.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    public boolean isAdminEmail(String email) {
        return email != null && admins.contains(email.toLowerCase(Locale.ROOT));
    }
}
