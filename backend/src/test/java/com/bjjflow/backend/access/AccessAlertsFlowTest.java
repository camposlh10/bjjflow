package com.bjjflow.backend.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import org.springframework.data.domain.PageRequest;

import com.bjjflow.backend.access.bridge.AccessBridge;
import com.bjjflow.backend.access.bridge.AccessBridgeRepository;
import com.bjjflow.backend.access.bridge.BridgeHealthMonitor;
import com.bjjflow.backend.notifications.Notification;
import com.bjjflow.backend.notifications.NotificationRepository;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class AccessAlertsFlowTest {

    private static final ZoneId GYM_ZONE = ZoneId.of("America/Sao_Paulo");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private BridgeHealthMonitor bridgeHealthMonitor;

    @Autowired
    private AccessBridgeRepository bridgeRepository;

    @Test
    void presenceOverdueAlertsAndBridgeOfflineAlerts() throws Exception {
        Account owner = register("alerts-owner@bjjflow.com", "Alerts Owner", "adult-black");
        GymInfo gym = createGym(owner.token(), "Alerts Academy");
        Account paid = register("alerts-paid@bjjflow.com", "Paid Member", "adult-blue");
        joinGym(paid.token(), gym.inviteCode());
        Account late = register("alerts-late@bjjflow.com", "Late Payer", "adult-blue");
        joinGym(late.token(), gym.inviteCode());
        Account leaver = register("alerts-leaver@bjjflow.com", "Early Leaver", "adult-white");
        joinGym(leaver.token(), gym.inviteCode());

        String deviceJson = mockMvc.perform(post("/api/v1/crm/devices").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Catraca\", \"type\": \"TURNSTILE\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String deviceKey = JsonPath.read(deviceJson, "$.apiKey");

        // An invoice that was due yesterday and is still unpaid.
        LocalDate today = LocalDate.now(GYM_ZONE);
        mockMvc.perform(post("/api/v1/crm/invoices").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"memberUserId\": %d, \"description\": \"Mensalidade\", \"amount\": 150.00, \"dueDate\": \"%s\"}"
                        .formatted(late.userId(), today.minusDays(1))))
                .andExpect(status().isOk());

        Instant now = Instant.now();
        scan(deviceKey, paid.userId(), now.minusSeconds(600), "ENTRY");
        scan(deviceKey, late.userId(), now.minusSeconds(300), "ENTRY");
        scan(deviceKey, late.userId(), now.minusSeconds(120), "ENTRY"); // came back in: one alert only
        scan(deviceKey, leaver.userId(), now.minusSeconds(900), "ENTRY");
        scan(deviceKey, leaver.userId(), now.minusSeconds(60), "EXIT");

        mockMvc.perform(get("/api/v1/crm/presence").header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2))
                .andExpect(jsonPath("$.exitsTracked").value(true))
                .andExpect(jsonPath("$.members[0].userId").value(late.userId()))
                .andExpect(jsonPath("$.members[0].overdue").value(true))
                .andExpect(jsonPath("$.members[0].deviceName").value("Catraca"))
                .andExpect(jsonPath("$.members[1].userId").value(paid.userId()))
                .andExpect(jsonPath("$.members[1].overdue").value(false));
        mockMvc.perform(get("/api/v1/crm/presence").header("Authorization", bearer(paid.token())))
                .andExpect(status().isForbidden());

        List<Notification> ownerNotes = notificationRepository.findByUserIdOrderByCreatedAtDesc(owner.userId(),
                PageRequest.of(0, 20));
        assertThat(ownerNotes).filteredOn(n -> n.getTitle().contains("mensalidade em atraso")).hasSize(1);
        Notification overdue = ownerNotes.stream().filter(n -> n.getTitle().contains("mensalidade em atraso"))
                .findFirst().orElseThrow();
        assertThat(overdue.getTitle()).isEqualTo("Late Payer entrou com mensalidade em atraso");
        assertThat(overdue.getPayload()).isEqualTo("user:" + late.userId());
        assertThat(overdue.getBody()).contains(String.format("%02d/%02d", today.minusDays(1).getDayOfMonth(),
                today.minusDays(1).getMonthValue()));

        // Bridge: silent for longer than the window -> one offline alert; back -> one online alert.
        String bridgeJson = mockMvc.perform(post("/api/v1/crm/bridges").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Recepção\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String bridgeKey = JsonPath.read(bridgeJson, "$.apiKey");
        long bridgeId = ((Number) JsonPath.read(bridgeJson, "$.bridge.id")).longValue();
        mockMvc.perform(post("/api/v1/access/bridge/heartbeat").header("X-Bridge-Key", bridgeKey)
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isOk());

        Instant later = Instant.now().plus(BridgeHealthMonitor.OFFLINE_AFTER).plusSeconds(5);
        assertThat(bridgeHealthMonitor.check(Instant.now())).isZero();
        assertThat(bridgeHealthMonitor.check(later)).isEqualTo(1);
        assertThat(bridgeHealthMonitor.check(later.plusSeconds(60))).isZero();
        assertThat(titles(owner)).contains("Bridge offline: Recepção");

        AccessBridge bridge = bridgeRepository.findById(bridgeId).orElseThrow();
        bridge.setLastSeenAt(later.plusSeconds(90));
        bridgeRepository.save(bridge);
        assertThat(bridgeHealthMonitor.check(later.plusSeconds(100))).isEqualTo(1);
        assertThat(titles(owner)).contains("Bridge online de novo: Recepção");
        assertThat(bridgeRepository.findById(bridgeId).orElseThrow().getOfflineAlertedAt()).isNull();
    }

    private List<String> titles(Account account) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(account.userId(), PageRequest.of(0, 20))
                .stream().map(Notification::getTitle).toList();
    }

    private void scan(String key, long userId, Instant at, String direction) throws Exception {
        mockMvc.perform(post("/api/v1/access/hardware/events").header("X-Device-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentUserId\": %d, \"eventTime\": \"%s\", \"direction\": \"%s\"}"
                        .formatted(userId, at, direction)))
                .andExpect(status().isOk());
    }

    private GymInfo createGym(String token, String name) throws Exception {
        String response = mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"%s\"}".formatted(name)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new GymInfo(
                ((Number) JsonPath.read(response, "$.id")).longValue(),
                JsonPath.read(response, "$.inviteCode"));
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

    private record GymInfo(long id, String inviteCode) {
    }
}
