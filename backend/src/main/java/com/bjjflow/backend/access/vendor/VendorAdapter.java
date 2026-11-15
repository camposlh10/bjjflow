package com.bjjflow.backend.access.vendor;

import java.util.List;

import com.bjjflow.backend.access.AccessDtos.HardwareAccessEventRequest;

/**
 * Translates one access-control brand's own notification format into our
 * scan events. Each brand gets one adapter; everything after translation
 * (member lookup, class matching, attendance) is shared.
 */
public interface VendorAdapter {

    /** Path segment that selects this adapter, e.g. "controlid". */
    String vendor();

    /**
     * @param endpoint the path the device posted to after the device key,
     *                 e.g. "dao" or "catra_event" (no leading slash)
     * @param body     raw request body; may be empty or not even valid JSON
     * @return scans to ingest; empty when the notification carries no entry
     *         (heartbeats, door states, denied attempts...)
     */
    List<HardwareAccessEventRequest> translate(String endpoint, String body);
}
