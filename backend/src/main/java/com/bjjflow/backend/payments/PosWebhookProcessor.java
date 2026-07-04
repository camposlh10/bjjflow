package com.bjjflow.backend.payments;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.automations.AutomationEvents;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.notifications.NotificationType;
import com.bjjflow.backend.payments.PosWebhookDtos.PosWebhookRequest;

import lombok.RequiredArgsConstructor;

/**
 * Turns raw POS/gateway callbacks into paid invoices. Auto-settlement only
 * happens when the invoice is found and the amount matches exactly; anything
 * ambiguous is kept for manual review in the CRM.
 */
@Service
@RequiredArgsConstructor
public class PosWebhookProcessor {

    private final PosIntegrationRepository posIntegrationRepository;
    private final PosWebhookEventRepository posWebhookEventRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final GymMemberRepository gymMemberRepository;
    private final AutomationEvents automationEvents;

    @Transactional
    public PosWebhookEvent ingest(PosIntegration integration, PosWebhookRequest request) {
        integration.setLastSeenAt(Instant.now());
        posIntegrationRepository.save(integration);

        // Providers retry webhooks until they get a 2xx — replays are answered
        // with the original event instead of being processed twice.
        PosWebhookEvent existing = posWebhookEventRepository
                .findByGymIdAndExternalTransactionId(integration.getGymId(),
                        request.externalTransactionId().trim())
                .orElse(null);
        if (existing != null) {
            return existing;
        }

        PosWebhookEvent event = new PosWebhookEvent();
        event.setGymId(integration.getGymId());
        event.setIntegrationId(integration.getId());
        event.setExternalTransactionId(request.externalTransactionId().trim());
        event.setPaymentReference(blankToNull(request.paymentReference()));
        event.setInvoiceId(request.invoiceId());
        event.setAmount(request.amount());
        event.setPaymentMethod(parseMethod(request.paymentMethod()));
        event.setCardBrand(blankToNull(request.cardBrand()));
        event.setInstallments(request.installments());
        event.setAuthorizationCode(blankToNull(request.authorizationCode()));
        event.setPaidAt(request.paidAt() == null ? Instant.now() : request.paidAt());
        event = posWebhookEventRepository.save(event);

        Invoice invoice = findInvoice(event);
        if (invoice == null) {
            complete(event, PosWebhookStatus.UNRESOLVED_INVOICE,
                    "Nenhuma fatura encontrada para a referência informada");
        } else {
            event.setInvoiceId(invoice.getId());
            settle(event, invoice, false);
        }
        return posWebhookEventRepository.save(event);
    }

    /** Manual resolution from the CRM review queue: the owner picks the invoice. */
    @Transactional
    public PosWebhookEvent linkInvoice(PosWebhookEvent event, Invoice invoice) {
        event.setInvoiceId(invoice.getId());
        settle(event, invoice, true);
        return posWebhookEventRepository.save(event);
    }

    private Invoice findInvoice(PosWebhookEvent event) {
        if (event.getInvoiceId() != null) {
            return invoiceRepository.findByIdAndGymId(event.getInvoiceId(), event.getGymId()).orElse(null);
        }
        if (event.getPaymentReference() != null) {
            return invoiceRepository
                    .findByGymIdAndPaymentReferenceIgnoreCase(event.getGymId(), event.getPaymentReference())
                    .orElse(null);
        }
        return null;
    }

    private void settle(PosWebhookEvent event, Invoice invoice, boolean manualOverride) {
        if (invoice.getStatus() == PaymentStatus.PAID) {
            complete(event, PosWebhookStatus.ALREADY_PAID, "A fatura já estava paga");
            return;
        }
        if (invoice.getStatus() == PaymentStatus.CANCELLED) {
            complete(event, PosWebhookStatus.FAILED, "A fatura está cancelada");
            return;
        }
        if (!manualOverride && invoice.getAmount().compareTo(event.getAmount()) != 0) {
            complete(event, PosWebhookStatus.AMOUNT_MISMATCH,
                    "Valor esperado %s, recebido %s".formatted(
                            money(invoice.getAmount()), money(event.getAmount())));
            return;
        }

        invoice.setStatus(PaymentStatus.PAID);
        invoice.setProvider(PaymentProvider.CARD);
        invoice.setPaidAt(event.getPaidAt());
        invoiceRepository.save(invoice);

        if (paymentTransactionRepository.findByInvoiceId(invoice.getId()).isEmpty()) {
            String providerName = posIntegrationRepository.findById(event.getIntegrationId())
                    .map(PosIntegration::getProviderName).orElse(null);
            PaymentTransaction transaction = new PaymentTransaction();
            transaction.setGymId(invoice.getGymId());
            transaction.setInvoiceId(invoice.getId());
            transaction.setAmount(event.getAmount());
            transaction.setProvider(PaymentProvider.CARD);
            transaction.setExternalTransactionId(event.getExternalTransactionId());
            transaction.setPaymentMethod(event.getPaymentMethod());
            transaction.setCardBrand(event.getCardBrand());
            transaction.setInstallments(event.getInstallments());
            transaction.setAuthorizationCode(event.getAuthorizationCode());
            transaction.setProviderName(providerName);
            transaction.setPaidAt(event.getPaidAt());
            transaction.setNotes(manualOverride && invoice.getAmount().compareTo(event.getAmount()) != 0
                    ? "Vinculado manualmente no CRM; valor da fatura difere do valor recebido"
                    : "Pagamento na maquininha confirmado via webhook");
            paymentTransactionRepository.save(transaction);
        }

        clearDelinquencyIfSettled(invoice.getGymId(), invoice.getMemberUserId());
        automationEvents.fireOnce(invoice.getGymId(), AutomationEvents.PAYMENT_CONFIRMED,
                "pos-" + event.getId(), invoice.getMemberUserId(), NotificationType.SYSTEM,
                "Pagamento confirmado",
                "Recebemos seu pagamento de %s (%s) no cartão. Obrigado!".formatted(
                        money(event.getAmount()), invoice.getDescription()));
        complete(event, PosWebhookStatus.PROCESSED, null);
    }

    private void clearDelinquencyIfSettled(Long gymId, Long memberUserId) {
        gymMemberRepository.findByGymIdAndUserId(gymId, memberUserId).ifPresent(member -> {
            if (member.getDelinquentSince() != null
                    && !invoiceRepository.existsByGymIdAndMemberUserIdAndStatus(
                            gymId, memberUserId, PaymentStatus.OVERDUE)) {
                member.setDelinquentSince(null);
                gymMemberRepository.save(member);
            }
        });
    }

    private static void complete(PosWebhookEvent event, PosWebhookStatus status, String note) {
        event.setStatus(status);
        event.setProcessedAt(Instant.now());
        if (note != null) {
            event.setNotes(note);
        }
    }

    private static PaymentMethod parseMethod(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return PaymentMethod.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return PaymentMethod.OTHER;
        }
    }

    private static String money(BigDecimal amount) {
        return NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(amount);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
