package com.bjjflow.backend.email;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

/**
 * Sends email through Resend (https://resend.com). Built only when
 * {@code resend.api-key} is configured (see {@link EmailConfig}).
 *
 * Runs from the {@link EmailJobHandler} background job, so a failure throws:
 * the job is retried with backoff, and the request that asked for the email
 * (e.g. "forgot password") has already answered without revealing anything.
 */
public class ResendEmailSender implements EmailSender {

    private final RestClient http = RestClient.builder().baseUrl("https://api.resend.com").build();
    private final String apiKey;
    private final String from;

    public ResendEmailSender(String apiKey, String from) {
        this.apiKey = apiKey;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String html) {
        http.post().uri("/emails")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("from", from, "to", List.of(to), "subject", subject, "html", html))
                .retrieve()
                .toBodilessEntity();
    }
}
