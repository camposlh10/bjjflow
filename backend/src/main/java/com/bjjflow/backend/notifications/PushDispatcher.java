package com.bjjflow.backend.notifications;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Remote push delivery via the Expo Push API. The in-app notification center
 * is the source of truth; this fans the same message out to the member's
 * phone.
 *
 * Called from the {@link PushJobHandler} background job, never inside a
 * request: a transport failure throws so the job is retried with backoff.
 *
 * Disable with app.push.enabled=false (tests do).
 */
@Service
public class PushDispatcher {

    private static final Logger log = LoggerFactory.getLogger(PushDispatcher.class);
    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    private static final int CHUNK_SIZE = 100;

    private final PushTokenRepository pushTokenRepository;
    private final RestClient restClient;
    private final boolean enabled;

    public PushDispatcher(PushTokenRepository pushTokenRepository,
            RestClient.Builder restClientBuilder,
            @Value("${app.push.enabled:true}") boolean enabled) {
        this.pushTokenRepository = pushTokenRepository;
        this.restClient = restClientBuilder.build();
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** Sends to every registered Expo token of the user. Throws if Expo cannot be reached. */
    public void sendToUser(Long userId, String title, String body) {
        if (!enabled || userId == null) {
            return;
        }
        List<String> tokens = pushTokenRepository.findAllByUserId(userId).stream()
                .map(PushToken::getToken)
                .filter(PushDispatcher::isExpoToken)
                .toList();
        for (int start = 0; start < tokens.size(); start += CHUNK_SIZE) {
            List<String> chunk = tokens.subList(start, Math.min(start + CHUNK_SIZE, tokens.size()));
            List<Map<String, Object>> messages = chunk.stream()
                    .map(token -> Map.<String, Object>of(
                            "to", token, "title", title, "body", body == null ? "" : body,
                            "sound", "default"))
                    .toList();
            ExpoPushResponse response = restClient.post()
                    .uri(EXPO_PUSH_URL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(messages)
                    .retrieve()
                    .body(ExpoPushResponse.class);
            handleTickets(chunk, response);
        }
    }

    private void handleTickets(List<String> chunk, ExpoPushResponse response) {
        if (response == null || response.data() == null) {
            return;
        }
        for (int index = 0; index < response.data().size() && index < chunk.size(); index++) {
            ExpoPushTicket ticket = response.data().get(index);
            if (ticket != null && "error".equalsIgnoreCase(ticket.status())) {
                String detail = ticket.details() == null ? null
                        : String.valueOf(ticket.details().get("error"));
                if ("DeviceNotRegistered".equals(detail)) {
                    // Stale token (app uninstalled / token rotated): stop trying.
                    pushTokenRepository.deleteByToken(chunk.get(index));
                } else {
                    // Per-device rejections are not retried: resending would not change them.
                    log.warn("Expo push ticket error: {} ({})", ticket.message(), detail);
                }
            }
        }
    }

    private static boolean isExpoToken(String token) {
        return token != null
                && (token.startsWith("ExponentPushToken") || token.startsWith("ExpoPushToken"));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ExpoPushResponse(List<ExpoPushTicket> data) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ExpoPushTicket(String status, String message, Map<String, Object> details) {
    }
}
