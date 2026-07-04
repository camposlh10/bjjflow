package com.bjjflow.backend.payments;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class PosWebhookDtos {

    private PosWebhookDtos() {
    }

    /**
     * Provider-agnostic webhook payload. Adapters for specific gateways
     * (Stone, Cielo, Mercado Pago…) can translate into this shape.
     */
    public record PosWebhookRequest(
            @NotBlank @Size(max = 150) String externalTransactionId,
            @Size(max = 40) String paymentReference,
            Long invoiceId,
            @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
            @Size(max = 20) String paymentMethod,
            @Size(max = 30) String cardBrand,
            @Min(1) @Max(48) Integer installments,
            @Size(max = 60) String authorizationCode,
            Instant paidAt) {
    }

    public record PosWebhookResponse(
            Long eventId,
            String status,
            Long invoiceId) {
    }
}
