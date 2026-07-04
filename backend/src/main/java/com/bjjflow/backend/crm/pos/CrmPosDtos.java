package com.bjjflow.backend.crm.pos;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CrmPosDtos {

    private CrmPosDtos() {
    }

    public record CreateIntegrationRequest(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Size(max = 60) String providerName) {
    }

    public record IntegrationResponse(
            Long id,
            Long gymId,
            String name,
            String providerName,
            boolean active,
            Instant createdAt,
            Instant lastSeenAt) {
    }

    /** Returned only on registration and key rotation; the key is not stored. */
    public record IntegrationWithKeyResponse(
            IntegrationResponse integration,
            String webhookKey) {
    }

    public record PosEventResponse(
            Long id,
            String integrationName,
            String externalTransactionId,
            String paymentReference,
            Long invoiceId,
            String invoiceDescription,
            Long memberUserId,
            String memberName,
            BigDecimal amount,
            String paymentMethod,
            String cardBrand,
            Integer installments,
            String authorizationCode,
            String status,
            String notes,
            Instant paidAt,
            Instant createdAt) {
    }
}
