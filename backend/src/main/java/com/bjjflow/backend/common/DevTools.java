package com.bjjflow.backend.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Guards TEMP dev/testing endpoints (role/verify/pro toggles, the seed bot). Enabled
 * only when {@code app.dev-tools=true} — set under the dev + test profiles — so
 * production (which doesn't set it) returns 404 and can't be privilege-escalated.
 */
@Component
public class DevTools {

    private final boolean enabled;

    public DevTools(@Value("${app.dev-tools:false}") boolean enabled) {
        this.enabled = enabled;
    }

    public boolean enabled() {
        return enabled;
    }

    /** Throws 404 (endpoint hidden) when dev tools are disabled. */
    public void require() {
        if (!enabled) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Not found");
        }
    }
}
