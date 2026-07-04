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

@Entity
@Table(name = "payment_transactions")
@Getter
@Setter
@NoArgsConstructor
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gym_id", nullable = false)
    private Long gymId;

    @Column(name = "invoice_id", nullable = false, unique = true)
    private Long invoiceId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentProvider provider = PaymentProvider.MANUAL;

    @Column(name = "external_transaction_id")
    private String externalTransactionId;

    // Card data from POS/gateway webhooks; null for manual payments.
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod;

    @Column(name = "card_brand")
    private String cardBrand;

    private Integer installments;

    @Column(nullable = false)
    private String status = "CONFIRMED";

    @Column(name = "authorization_code")
    private String authorizationCode;

    /** Gateway name (Stone, Cielo, Mercado Pago…), free-form. */
    @Column(name = "provider_name")
    private String providerName;

    @Column(name = "paid_at", nullable = false)
    private Instant paidAt;

    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (paidAt == null) {
            paidAt = Instant.now();
        }
        createdAt = Instant.now();
    }
}
