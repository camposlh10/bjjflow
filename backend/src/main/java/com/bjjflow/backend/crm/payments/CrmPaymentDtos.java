package com.bjjflow.backend.crm.payments;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class CrmPaymentDtos {

    private CrmPaymentDtos() {
    }

    public record CreatePaymentPlanRequest(
            @NotNull Long memberUserId,
            @NotBlank @Size(max = 120) String name,
            @NotNull @DecimalMin(value = "0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
            @NotBlank String billingCycle,
            LocalDate startDate,
            LocalDate nextDueDate) {
    }

    public record UpdatePaymentPlanRequest(
            @Size(max = 120) String name,
            @DecimalMin(value = "0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
            String billingCycle,
            LocalDate nextDueDate,
            Boolean active) {
    }

    public record PaymentPlanResponse(
            Long id,
            Long gymId,
            Long memberUserId,
            String memberName,
            String name,
            BigDecimal amount,
            String billingCycle,
            LocalDate startDate,
            LocalDate nextDueDate,
            boolean active,
            Instant createdAt) {
    }

    public record CreateInvoiceRequest(
            Long memberUserId,
            Long paymentPlanId,
            @Size(max = 255) String description,
            @DecimalMin(value = "0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount,
            LocalDate dueDate) {
    }

    public record MarkInvoicePaidRequest(
            String provider,
            @Size(max = 150) String externalTransactionId,
            @Size(max = 500) String notes) {
    }

    public record InvoiceResponse(
            Long id,
            Long gymId,
            Long memberUserId,
            String memberName,
            Long paymentPlanId,
            String description,
            BigDecimal amount,
            LocalDate dueDate,
            String status,
            String provider,
            Instant paidAt,
            Long transactionId,
            Instant createdAt) {
    }

    public record GenerateInvoicesResponse(
            int createdCount,
            int skippedCount,
            List<InvoiceResponse> invoices) {
    }

    public record PaymentSummaryResponse(
            long activePlanCount,
            long pendingInvoiceCount,
            BigDecimal pendingInvoiceAmount,
            long overdueInvoiceCount,
            BigDecimal overdueInvoiceAmount,
            long paymentsThisMonthCount,
            BigDecimal collectedThisMonthAmount) {
    }
}
