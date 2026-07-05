package com.bjjflow.backend.notifications;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Remote push delivery via the Expo Push API. The in-app notification center
 * is the source of truth; this fans the same message out to the member's
 * phone. Delivery is best-effort, asynchronous, and fires only after the
 * surrounding transaction commits — a rolled-back notification never pushes.
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
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public PushDispatcher(PushTokenRepository pushTokenRepository,
            RestClient.Builder restClientBuilder,
            @Value("${app.push.enabled:true}") boolean enabled) {
        this.pushTokenRepository = pushTokenRepository;
        this.restClient = restClientBuilder.build();
        this.enabled = enabled;
    }

    public void sendToUser(Long userId, String title, String body) {
        if (!enabled || userId == null) {
            return;
        }
        List<String> tokens = pushTokenRepository.findAllByUserId(userId).stream()
                .map(PushToken::getToken)
                .filter(PushDispatcher::isExpoToken)
                .toList();
        if (tokens.isEmpty()) {
            return;
        }
        Runnable dispatch = () -> executor.submit(() -> deliver(tokens, title, body));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatch.run();
                }
            });
        } else {
            dispatch.run();
        }
    }

    private void deliver(List<String> tokens, String title, String body) {
        for (int start = 0; start < tokens.size(); start += CHUNK_SIZE) {
            List<String> chunk = tokens.subList(start, Math.min(start + CHUNK_SIZE, tokens.size()));
            try {
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
            } catch (Exception exception) {
                // Best-effort: the in-app notification already exists.
                log.warn("Expo push delivery failed for {} token(s): {}", chunk.size(),
                        exception.getMessage());
            }
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
