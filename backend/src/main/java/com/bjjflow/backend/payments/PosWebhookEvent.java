package com.bjjflow.backend.payments;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Raw POS/gateway callback, stored before processing. Mirrors the
 * RawAccessEvent pattern: nothing is lost, retries are deduplicated, and
 * ambiguous payments go to a manual review queue.
 */
@Entity
@Table(name = "pos_webhook_events")
@Getter
@Setter
@NoArgsConstructor
public class PosWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id", nullable = false)
    private Long gymId;

    @Column(name = "integration_id", nullable = false)
    private Long integrationId;

    @Column(name = "external_transaction_id", nullable = false)
    private String externalTransactionId;

    @Column(name = "payment_reference")
    private String paymentReference;

    @Column(name = "invoice_id")
    private Long invoiceId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod;

    @Column(name = "card_brand")
    private String cardBrand;

    private Integer installments;

    @Column(name = "authorization_code")
    private String authorizationCode;

    @Column(name = "paid_at", nullable = false)
    private Instant paidAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PosWebhookStatus status = PosWebhookStatus.RECEIVED;

    private String notes;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
