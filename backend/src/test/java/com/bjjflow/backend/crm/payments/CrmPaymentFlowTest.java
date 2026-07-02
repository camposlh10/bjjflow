package com.bjjflow.backend.crm.payments;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;
import com.bjjflow.backend.payments.PaymentTransactionRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class CrmPaymentFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Test
    void ownerCanManageManualPlansInvoicesAndPayments() throws Exception {
        Account owner = register("payment-owner@bjjflow.com", "Payment Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Payment Academy");
        Account member = register("payment-member@bjjflow.com", "Payment Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        String planJson = mockMvc.perform(post("/api/v1/crm/payment-plans")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "name": "Monthly BJJ", "amount": 150.00,
                         "billingCycle": "MONTHLY", "startDate": "%s", "nextDueDate": "%s"}
                        """.formatted(member.userId(), LocalDate.now(), LocalDate.now())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memberName").value("Payment Member"))
                .andExpect(jsonPath("$.billingCycle").value("MONTHLY"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn().getResponse().getContentAsString();
        long planId = ((Number) JsonPath.read(planJson, "$.id")).longValue();

        mockMvc.perform(get("/api/v1/crm/payment-plans/member/" + member.userId())
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(planId));

        String overdueJson = mockMvc.perform(post("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"paymentPlanId": %d, "dueDate": "%s"}
                        """.formatted(planId, LocalDate.now().minusDays(1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OVERDUE"))
                .andExpect(jsonPath("$.provider").value("MANUAL"))
                .andExpect(jsonPath("$.description").value("Monthly BJJ"))
                .andReturn().getResponse().getContentAsString();
        long overdueInvoiceId = ((Number) JsonPath.read(overdueJson, "$.id")).longValue();

        mockMvc.perform(post("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "description": "Seminar fee", "amount": 75.00,
                         "dueDate": "%s"}
                        """.formatted(member.userId(), LocalDate.now().plusDays(10))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        mockMvc.perform(get("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        mockMvc.perform(get("/api/v1/crm/invoices/overdue")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(overdueInvoiceId));

        mockMvc.perform(put("/api/v1/crm/invoices/" + overdueInvoiceId + "/mark-paid")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.paidAt").isNotEmpty())
                .andExpect(jsonPath("$.transactionId").isNumber());

        mockMvc.perform(put("/api/v1/crm/invoices/" + overdueInvoiceId + "/mark-paid")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"));
        org.junit.jupiter.api.Assertions.assertEquals(1, paymentTransactionRepository.count());

        mockMvc.perform(get("/api/v1/crm/invoices/overdue")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(put("/api/v1/crm/members/" + member.userId())
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\": \"INSTRUCTOR\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/crm/invoices")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_OWNER_ONLY"));

        Account otherOwner = register("payment-other@bjjflow.com", "Other Payment Owner", "adult-black");
        createGym(otherOwner.token(), "Other Payment Academy");
        mockMvc.perform(get("/api/v1/crm/invoices")
                .header("Authorization", bearer(otherOwner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        mockMvc.perform(put("/api/v1/crm/invoices/" + overdueInvoiceId + "/mark-paid")
                .header("Authorization", bearer(otherOwner.token())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVOICE_NOT_FOUND"));
    }

    @Test
    void ownerCanUpdateAndDeactivatePaymentPlans() throws Exception {
        Account owner = register("plan-owner@bjjflow.com", "Plan Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Plan Academy");
        Account member = register("plan-member@bjjflow.com", "Plan Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        String planJson = mockMvc.perform(post("/api/v1/crm/payment-plans")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "name": "Monthly BJJ", "amount": 150.00, "billingCycle": "MONTHLY"}
                        """.formatted(member.userId())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long planId = ((Number) JsonPath.read(planJson, "$.id")).longValue();

        mockMvc.perform(put("/api/v1/crm/payment-plans/" + planId)
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Premium BJJ", "amount": 200.00, "billingCycle": "quarterly"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Premium BJJ"))
                .andExpect(jsonPath("$.billingCycle").value("QUARTERLY"))
                .andExpect(jsonPath("$.active").value(true));

        mockMvc.perform(put("/api/v1/crm/payment-plans/" + planId)
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"billingCycle\": \"FORTNIGHTLY\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_BILLING_CYCLE"));

        mockMvc.perform(put("/api/v1/crm/payment-plans/" + planId + "/deactivate")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(get("/api/v1/crm/payment-plans")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].active").value(false));

        mockMvc.perform(put("/api/v1/crm/payment-plans/" + planId)
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));

        Account otherOwner = register("plan-other@bjjflow.com", "Other Plan Owner", "adult-black");
        createGym(otherOwner.token(), "Other Plan Academy");
        mockMvc.perform(put("/api/v1/crm/payment-plans/" + planId + "/deactivate")
                .header("Authorization", bearer(otherOwner.token())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PAYMENT_PLAN_NOT_FOUND"));
    }

    @Test
    void generateDueInvoicesCatchesUpAndIsIdempotent() throws Exception {
        Account owner = register("gen-owner@bjjflow.com", "Gen Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Gen Academy");
        Account member = register("gen-member@bjjflow.com", "Gen Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        LocalDate twoMonthsAgo = LocalDate.now().minusMonths(2);
        String planJson = mockMvc.perform(post("/api/v1/crm/payment-plans")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "name": "Monthly BJJ", "amount": 150.00,
                         "billingCycle": "MONTHLY", "startDate": "%s", "nextDueDate": "%s"}
                        """.formatted(member.userId(), twoMonthsAgo, twoMonthsAgo)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long planId = ((Number) JsonPath.read(planJson, "$.id")).longValue();

        mockMvc.perform(post("/api/v1/crm/invoices/generate-due")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdCount").value(3))
                .andExpect(jsonPath("$.skippedCount").value(0))
                .andExpect(jsonPath("$.invoices", hasSize(3)))
                .andExpect(jsonPath("$.invoices[0].paymentPlanId").value(planId))
                .andExpect(jsonPath("$.invoices[0].description").value("Monthly BJJ"));

        mockMvc.perform(post("/api/v1/crm/invoices/generate-due")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdCount").value(0))
                .andExpect(jsonPath("$.skippedCount").value(0));

        mockMvc.perform(get("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));

        mockMvc.perform(get("/api/v1/crm/payment-plans")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nextDueDate").value(twoMonthsAgo.plusMonths(3).toString()));

        mockMvc.perform(post("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"paymentPlanId": %d, "dueDate": "%s"}
                        """.formatted(planId, twoMonthsAgo)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_INVOICE"));
    }

    @Test
    void invoicesCanBeCancelledButNotWhenPaid() throws Exception {
        Account owner = register("cancel-owner@bjjflow.com", "Cancel Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Cancel Academy");
        Account member = register("cancel-member@bjjflow.com", "Cancel Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        long invoiceId = createManualInvoice(owner.token(), member.userId(), "Seminar fee", "75.00");
        mockMvc.perform(put("/api/v1/crm/invoices/" + invoiceId + "/cancel")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(put("/api/v1/crm/invoices/" + invoiceId + "/cancel")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(put("/api/v1/crm/invoices/" + invoiceId + "/mark-paid")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVOICE_CANCELLED"));

        long paidInvoiceId = createManualInvoice(owner.token(), member.userId(), "Private class", "120.00");
        mockMvc.perform(put("/api/v1/crm/invoices/" + paidInvoiceId + "/mark-paid")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"));
        mockMvc.perform(put("/api/v1/crm/invoices/" + paidInvoiceId + "/cancel")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVOICE_ALREADY_PAID"));
    }

    @Test
    void markPaidRecordsProviderDetails() throws Exception {
        Account owner = register("provider-owner@bjjflow.com", "Provider Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Provider Academy");
        Account member = register("provider-member@bjjflow.com", "Provider Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        long invoiceId = createManualInvoice(owner.token(), member.userId(), "Monthly fee", "150.00");
        mockMvc.perform(put("/api/v1/crm/invoices/" + invoiceId + "/mark-paid")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"provider": "pix", "externalTransactionId": "E2E-12345", "notes": "Paid via PIX transfer"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.provider").value("PIX"))
                .andExpect(jsonPath("$.transactionId").isNumber());

        var transaction = paymentTransactionRepository.findByInvoiceId(invoiceId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("E2E-12345", transaction.getExternalTransactionId());
        org.junit.jupiter.api.Assertions.assertEquals("Paid via PIX transfer", transaction.getNotes());

        long otherInvoiceId = createManualInvoice(owner.token(), member.userId(), "Gi purchase", "300.00");
        mockMvc.perform(put("/api/v1/crm/invoices/" + otherInvoiceId + "/mark-paid")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"provider\": \"BITCOIN\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PROVIDER"));
    }

    @Test
    void summaryReflectsPaymentActivity() throws Exception {
        Account owner = register("summary-owner@bjjflow.com", "Summary Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Summary Academy");
        Account member = register("summary-member@bjjflow.com", "Summary Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        mockMvc.perform(post("/api/v1/crm/payment-plans")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "name": "Monthly BJJ", "amount": 150.00, "billingCycle": "MONTHLY"}
                        """.formatted(member.userId())))
                .andExpect(status().isOk());

        long overdueInvoiceId = createInvoiceDue(owner.token(), member.userId(), "Late fee", "100.00",
                LocalDate.now().minusDays(5));
        createInvoiceDue(owner.token(), member.userId(), "Upcoming fee", "50.00", LocalDate.now().plusDays(10));

        String summaryJson = mockMvc.perform(get("/api/v1/crm/payments/summary")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activePlanCount").value(1))
                .andExpect(jsonPath("$.pendingInvoiceCount").value(1))
                .andExpect(jsonPath("$.overdueInvoiceCount").value(1))
                .andExpect(jsonPath("$.paymentsThisMonthCount").value(0))
                .andReturn().getResponse().getContentAsString();
        org.junit.jupiter.api.Assertions.assertEquals(50.0,
                ((Number) JsonPath.read(summaryJson, "$.pendingInvoiceAmount")).doubleValue(), 0.001);
        org.junit.jupiter.api.Assertions.assertEquals(100.0,
                ((Number) JsonPath.read(summaryJson, "$.overdueInvoiceAmount")).doubleValue(), 0.001);

        mockMvc.perform(put("/api/v1/crm/invoices/" + overdueInvoiceId + "/mark-paid")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk());

        String paidSummaryJson = mockMvc.perform(get("/api/v1/crm/payments/summary")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overdueInvoiceCount").value(0))
                .andExpect(jsonPath("$.paymentsThisMonthCount").value(1))
                .andReturn().getResponse().getContentAsString();
        org.junit.jupiter.api.Assertions.assertEquals(100.0,
                ((Number) JsonPath.read(paidSummaryJson, "$.collectedThisMonthAmount")).doubleValue(), 0.001);
    }

    private long createManualInvoice(String token, long memberUserId, String description, String amount)
            throws Exception {
        return createInvoiceDue(token, memberUserId, description, amount, LocalDate.now().plusDays(7));
    }

    private long createInvoiceDue(String token, long memberUserId, String description, String amount,
            LocalDate dueDate) throws Exception {
        String response = mockMvc.perform(post("/api/v1/crm/invoices")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "description": "%s", "amount": %s, "dueDate": "%s"}
                        """.formatted(memberUserId, description, amount, dueDate)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.id")).longValue();
    }

    private String createGym(String token, String name) throws Exception {
        String response = mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"%s\"}".formatted(name)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.inviteCode");
    }

    private void joinGym(String token, String inviteCode) throws Exception {
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(inviteCode)))
                .andExpect(status().isOk());
    }

    private Account register(String email, String displayName, String beltSlug) throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 30, "beltSlug": "%s", "stripes": 0}
                        """.formatted(email, displayName, beltSlug)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new Account(
                JsonPath.read(response, "$.accessToken"),
                ((Number) JsonPath.read(response, "$.user.id")).longValue());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private record Account(String token, long userId) {
    }
}
