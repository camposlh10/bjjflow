package com.bjjflow.backend.email;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

/**
 * Sends email through Resend (https://resend.com). Built only when
 * {@code resend.api-key} is configured (see {@link EmailConfig}). Failures are
 * logged rather than thrown so callers like "forgot password" stay non-revealing.
 */
public class ResendEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(ResendEmailSender.class);

    private final RestClient http = RestClient.builder().baseUrl("https://api.resend.com").build();
    private final String apiKey;
    private final String from;

    public ResendEmailSender(String apiKey, String from) {
        this.apiKey = apiKey;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String html) {
        try {
            http.post().uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("from", from, "to", List.of(to), "subject", subject, "html", html))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Resend email to {} failed: {}", to, e.getMessage());
        }
    }
}
