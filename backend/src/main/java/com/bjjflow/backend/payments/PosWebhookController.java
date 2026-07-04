package com.bjjflow.backend.payments;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.access.DeviceKeys;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.payments.PosWebhookDtos.PosWebhookRequest;
import com.bjjflow.backend.payments.PosWebhookDtos.PosWebhookResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Public webhook endpoint for POS providers / payment gateways. The card
 * machine never talks to the desktop app: provider → this endpoint →
 * database → CRM. Authenticated by the integration's API key.
 */
@RestController
@RequestMapping("/api/v1/payments/webhooks")
@RequiredArgsConstructor
public class PosWebhookController {

    public static final String WEBHOOK_KEY_HEADER = "X-Webhook-Key";

    private final PosIntegrationRepository posIntegrationRepository;
    private final PosWebhookProcessor posWebhookProcessor;

    @PostMapping("/pos")
    public PosWebhookResponse receive(
            @RequestHeader(name = WEBHOOK_KEY_HEADER, required = false) String webhookKey,
            @Valid @RequestBody PosWebhookRequest request) {
        if (webhookKey == null || webhookKey.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "WEBHOOK_KEY_REQUIRED",
                    WEBHOOK_KEY_HEADER + " header is required");
        }
        PosIntegration integration = posIntegrationRepository
                .findByApiKeyHashAndActiveTrue(DeviceKeys.hash(webhookKey.trim()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_WEBHOOK_KEY",
                        "Unknown or inactive webhook key"));
        PosWebhookEvent event = posWebhookProcessor.ingest(integration, request);
        return new PosWebhookResponse(event.getId(), event.getStatus().name(), event.getInvoiceId());
    }
}
