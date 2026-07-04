package com.bjjflow.backend.payments;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class PosWebhookFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Test
    void cardMachinePaymentSettlesInvoiceThroughWebhook() throws Exception {
        Account owner = register("pos-owner@bjjflow.com", "Pos Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Pos Academy");
        Account member = register("pos-member@bjjflow.com", "Pos Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        InvoiceInfo invoice = createInvoice(owner.token(), member.userId(), "Mensalidade", "150.00");
        Assertions.assertTrue(invoice.paymentReference().startsWith("PGT-"));

        String integrationJson = mockMvc.perform(post("/api/v1/crm/pos-integrations")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Maquininha recepção\", \"providerName\": \"Stone\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.webhookKey", startsWith("bjjp_")))
                .andExpect(jsonPath("$.integration.active").value(true))
                .andReturn().getResponse().getContentAsString();
        String webhookKey = JsonPath.read(integrationJson, "$.webhookKey");
        long integrationId = ((Number) JsonPath.read(integrationJson, "$.integration.id")).longValue();

        // Card machine pays the invoice: provider webhook settles it.
        mockMvc.perform(post("/api/v1/payments/webhooks/pos")
                .header("X-Webhook-Key", webhookKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalTransactionId": "TX-001", "paymentReference": "%s",
                         "amount": 150.00, "paymentMethod": "credit_card", "cardBrand": "VISA",
                         "installments": 3, "authorizationCode": "AUTH-9911"}
                        """.formatted(invoice.paymentReference())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSED"))
                .andExpect(jsonPath("$.invoiceId").value(invoice.id()));

        mockMvc.perform(get("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == %d)].status".formatted(invoice.id())).value("PAID"))
                .andExpect(jsonPath("$[?(@.id == %d)].provider".formatted(invoice.id())).value("CARD"));

        var transaction = paymentTransactionRepository.findByInvoiceId(invoice.id()).orElseThrow();
        Assertions.assertEquals("TX-001", transaction.getExternalTransactionId());
        Assertions.assertEquals(PaymentMethod.CREDIT_CARD, transaction.getPaymentMethod());
        Assertions.assertEquals("VISA", transaction.getCardBrand());
        Assertions.assertEquals(3, transaction.getInstallments());
        Assertions.assertEquals("AUTH-9911", transaction.getAuthorizationCode());
        Assertions.assertEquals("Stone", transaction.getProviderName());
        Assertions.assertEquals("CONFIRMED", transaction.getStatus());

        // The student receives an in-app receipt.
        mockMvc.perform(get("/api/v1/users/me/notifications")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title", hasItem("Pagamento confirmado")));

        // Provider retry with the same transaction id is answered idempotently.
        mockMvc.perform(post("/api/v1/payments/webhooks/pos")
                .header("X-Webhook-Key", webhookKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalTransactionId": "TX-001", "paymentReference": "%s", "amount": 150.00}
                        """.formatted(invoice.paymentReference())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSED"));
        Assertions.assertEquals(1, paymentTransactionRepository.count());

        // Unknown reference lands in the review queue, then is linked manually.
        InvoiceInfo second = createInvoice(owner.token(), member.userId(), "Seminário", "75.00");
        String unresolvedJson = mockMvc.perform(post("/api/v1/payments/webhooks/pos")
                .header("X-Webhook-Key", webhookKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalTransactionId": "TX-002", "paymentReference": "PGT-NAOEXISTE",
                         "amount": 75.00, "paymentMethod": "DEBIT_CARD"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNRESOLVED_INVOICE"))
                .andReturn().getResponse().getContentAsString();
        long unresolvedId = ((Number) JsonPath.read(unresolvedJson, "$.eventId")).longValue();

        mockMvc.perform(put("/api/v1/crm/pos-events/" + unresolvedId + "/link-invoice/" + second.id())
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSED"))
                .andExpect(jsonPath("$.memberName").value("Pos Member"));
        mockMvc.perform(get("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$[?(@.id == %d)].status".formatted(second.id())).value("PAID"));

        // Amount mismatch never auto-settles.
        InvoiceInfo third = createInvoice(owner.token(), member.userId(), "Gi novo", "300.00");
        String mismatchJson = mockMvc.perform(post("/api/v1/payments/webhooks/pos")
                .header("X-Webhook-Key", webhookKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalTransactionId": "TX-003", "paymentReference": "%s", "amount": 250.00}
                        """.formatted(third.paymentReference())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AMOUNT_MISMATCH"))
                .andReturn().getResponse().getContentAsString();
        long mismatchId = ((Number) JsonPath.read(mismatchJson, "$.eventId")).longValue();
        mockMvc.perform(get("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$[?(@.id == %d)].status".formatted(third.id())).value("PENDING"));

        mockMvc.perform(put("/api/v1/crm/pos-events/" + mismatchId + "/ignore")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IGNORED"));

        mockMvc.perform(get("/api/v1/crm/pos-events")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));

        // Key hygiene: missing, invalid, and deactivated keys are all rejected.
        mockMvc.perform(post("/api/v1/payments/webhooks/pos")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"externalTransactionId\": \"TX-9\", \"amount\": 10.00}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("WEBHOOK_KEY_REQUIRED"));
        mockMvc.perform(post("/api/v1/payments/webhooks/pos")
                .header("X-Webhook-Key", "bjjp_wrong")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"externalTransactionId\": \"TX-9\", \"amount\": 10.00}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_WEBHOOK_KEY"));
        mockMvc.perform(put("/api/v1/crm/pos-integrations/" + integrationId + "/deactivate")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        mockMvc.perform(post("/api/v1/payments/webhooks/pos")
                .header("X-Webhook-Key", webhookKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"externalTransactionId\": \"TX-9\", \"amount\": 10.00}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_WEBHOOK_KEY"));

        // Members cannot manage integrations.
        mockMvc.perform(post("/api/v1/crm/pos-integrations")
                .header("Authorization", bearer(member.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"x\", \"providerName\": \"y\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_STAFF_ONLY"));
    }

    private InvoiceInfo createInvoice(String token, long memberUserId, String description, String amount)
            throws Exception {
        String response = mockMvc.perform(post("/api/v1/crm/invoices")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "description": "%s", "amount": %s, "dueDate": "%s"}
                        """.formatted(memberUserId, description, amount, LocalDate.now().plusDays(7))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new InvoiceInfo(
                ((Number) JsonPath.read(response, "$.id")).longValue(),
                JsonPath.read(response, "$.paymentReference"));
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

    private record InvoiceInfo(long id, String paymentReference) {
    }
}
