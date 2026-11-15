package com.bjjflow.backend.access.vendor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.bjjflow.backend.access.AccessDtos.HardwareAccessEventRequest;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Control iD devices (iDFace, iDAccess, iDFlex, iDBlock) in Monitor mode.
 *
 * The device POSTs to {@code http://<hostname>:<port>/<monitor.path>/<endpoint>}.
 * Monitor can't send headers, so monitor.path carries the device key:
 * {@code api/v1/access/vendors/controlid/<device key>}.
 *
 * Only {@code dao} notifications with inserted access_logs whose event is
 * 7 ("Access Granted") and that name a user become scans. The device's own
 * user_id is sent as the external member id and the access log id as the
 * device event id, so resends never count twice. Everything else (denied or
 * unidentified attempts, door and turnstile states, heartbeats) is
 * acknowledged and ignored.
 *
 * Source: Control iD Access API docs, "Monitor" and "List of Objects /
 * access_logs" (controlid.com.br/docs/access-api-en/).
 */
@Component
public class ControlIdAdapter implements VendorAdapter {

    private static final Logger log = LoggerFactory.getLogger(ControlIdAdapter.class);

    /** access_logs.event: Access Granted. */
    static final int EVENT_ACCESS_GRANTED = 7;

    private final JsonMapper json = JsonMapper.builder().build();

    @Override
    public String vendor() {
        return "controlid";
    }

    @Override
    public List<HardwareAccessEventRequest> translate(String endpoint, String body) {
        if (!"dao".equals(endpoint)) {
            return List.of();
        }
        JsonNode root;
        try {
            root = json.readTree(body == null ? "" : body);
        } catch (JacksonException invalid) {
            log.warn("Control iD: unreadable dao notification: {}", invalid.getOriginalMessage());
            return List.of();
        }
        List<HardwareAccessEventRequest> scans = new ArrayList<>();
        for (JsonNode change : root.path("object_changes")) {
            if (!"access_logs".equals(change.path("object").asString(""))
                    || !"inserted".equals(change.path("type").asString(""))) {
                continue;
            }
            JsonNode values = change.path("values");
            // Values arrive as strings ("7", "1532977090"); asLong/asInt accept both.
            if (values.path("event").asInt(-1) != EVENT_ACCESS_GRANTED) {
                continue;
            }
            long userId = values.path("user_id").asLong(0);
            if (userId <= 0) {
                continue;
            }
            long time = values.path("time").asLong(0);
            String logId = values.path("id").asString("");
            scans.add(new HardwareAccessEventRequest(
                    null,
                    Long.toString(userId),
                    time > 0 ? Instant.ofEpochSecond(time) : null,
                    null,
                    null,
                    logId.isBlank() ? null : "access_log:" + logId,
                    null));
        }
        return scans;
    }
}
