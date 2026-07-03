package com.bjjflow.backend.crm.payments;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.crm.payments.CrmPaymentDtos.CreateInvoiceRequest;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.CreatePaymentPlanRequest;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.GenerateInvoicesResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.InvoiceResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.MarkInvoicePaidRequest;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.PaymentPlanResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.PaymentSummaryResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.RevenueSeriesResponse;
import com.bjjflow.backend.crm.payments.CrmPaymentDtos.UpdatePaymentPlanRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/crm")
@RequiredArgsConstructor
public class CrmPaymentController {

    private final CrmPaymentService crmPaymentService;

    @PostMapping("/payment-plans")
    public PaymentPlanResponse createPaymentPlan(Authentication auth,
            @Valid @RequestBody CreatePaymentPlanRequest request) {
        return crmPaymentService.createPaymentPlan(userId(auth), request);
    }

    @GetMapping("/payment-plans")
    public List<PaymentPlanResponse> paymentPlans(Authentication auth) {
        return crmPaymentService.paymentPlans(userId(auth));
    }

    @GetMapping("/payment-plans/member/{userId}")
    public List<PaymentPlanResponse> paymentPlansForMember(Authentication auth, @PathVariable Long userId) {
        return crmPaymentService.paymentPlansForMember(userId(auth), userId);
    }

    @PutMapping("/payment-plans/{planId}")
    public PaymentPlanResponse updatePaymentPlan(Authentication auth, @PathVariable Long planId,
            @Valid @RequestBody UpdatePaymentPlanRequest request) {
        return crmPaymentService.updatePaymentPlan(userId(auth), planId, request);
    }

    @PutMapping("/payment-plans/{planId}/deactivate")
    public PaymentPlanResponse deactivatePaymentPlan(Authentication auth, @PathVariable Long planId) {
        return crmPaymentService.deactivatePaymentPlan(userId(auth), planId);
    }

    @PostMapping("/invoices")
    public InvoiceResponse createInvoice(Authentication auth, @Valid @RequestBody CreateInvoiceRequest request) {
        return crmPaymentService.createInvoice(userId(auth), request);
    }

    @PostMapping("/invoices/generate-due")
    public GenerateInvoicesResponse generateDueInvoices(Authentication auth) {
        return crmPaymentService.generateDueInvoices(userId(auth));
    }

    @GetMapping("/invoices")
    public List<InvoiceResponse> invoices(Authentication auth) {
        return crmPaymentService.invoices(userId(auth));
    }

    @GetMapping("/invoices/member/{userId}")
    public List<InvoiceResponse> invoicesForMember(Authentication auth, @PathVariable Long userId) {
        return crmPaymentService.invoicesForMember(userId(auth), userId);
    }

    @GetMapping("/invoices/overdue")
    public List<InvoiceResponse> overdueInvoices(Authentication auth) {
        return crmPaymentService.overdueInvoices(userId(auth));
    }

    @PutMapping("/invoices/{invoiceId}/mark-paid")
    public InvoiceResponse markPaid(Authentication auth, @PathVariable Long invoiceId,
            @Valid @RequestBody(required = false) MarkInvoicePaidRequest request) {
        return crmPaymentService.markPaid(userId(auth), invoiceId, request);
    }

    @PutMapping("/invoices/{invoiceId}/cancel")
    public InvoiceResponse cancelInvoice(Authentication auth, @PathVariable Long invoiceId) {
        return crmPaymentService.cancelInvoice(userId(auth), invoiceId);
    }

    @GetMapping("/payments/summary")
    public PaymentSummaryResponse summary(Authentication auth) {
        return crmPaymentService.summary(userId(auth));
    }

    @GetMapping("/payments/revenue-series")
    public RevenueSeriesResponse revenueSeries(Authentication auth,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Integer days) {
        return crmPaymentService.revenueSeries(userId(auth), days);
    }

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
