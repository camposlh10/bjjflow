package com.bjjflow.backend.access.bridge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

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
class BridgeFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private BridgeCommandRepository commandRepository;

    @Test
    void bridgesCheckInPickUpCommandsAndReportResults() throws Exception {
        Account owner = register("bridge-owner@bjjflow.com", "Bridge Owner", "adult-black");
        GymInfo gym = createGym(owner.token(), "Bridge Academy");
        Account member = register("bridge-member@bjjflow.com", "Bridge Member", "adult-blue");
        joinGym(member.token(), gym.inviteCode());

        // Only the owner registers bridges.
        mockMvc.perform(post("/api/v1/crm/bridges")
                .header("Authorization", bearer(member.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Rogue\"}"))
                .andExpect(status().isForbidden());

        String created = mockMvc.perform(post("/api/v1/crm/bridges")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Recepção\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apiKey", startsWith("bjjb_")))
                .andExpect(jsonPath("$.bridge.online").value(false))
                .andReturn().getResponse().getContentAsString();
        long bridgeId = ((Number) JsonPath.read(created, "$.bridge.id")).longValue();
        String key = JsonPath.read(created, "$.apiKey");

        mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("BRIDGE_KEY_REQUIRED"));
        mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                .header("X-Bridge-Key", "bjjb_wrong")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_BRIDGE_KEY"));

        // Nothing queued yet: the check-in only marks the bridge online.
        mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                .header("X-Bridge-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\": \"0.1.0\", \"queueDepth\": 3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commands", hasSize(0)))
                .andExpect(jsonPath("$.pollSeconds").value(5));
        mockMvc.perform(get("/api/v1/crm/bridges").header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].online").value(true))
                .andExpect(jsonPath("$[0].version").value("0.1.0"))
                .andExpect(jsonPath("$[0].queueDepth").value(3))
                .andExpect(jsonPath("$[0].apiKey").doesNotExist());

        // Staff can test the connection; the PING rides on the next check-in, once.
        String ping = mockMvc.perform(post("/api/v1/crm/bridges/" + bridgeId + "/ping")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        long commandId = ((Number) JsonPath.read(ping, "$.id")).longValue();
        mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                .header("X-Bridge-Key", key).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commands", hasSize(1)))
                .andExpect(jsonPath("$.commands[0].id").value(commandId))
                .andExpect(jsonPath("$.commands[0].type").value("PING"));
        mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                .header("X-Bridge-Key", key).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(jsonPath("$.commands", hasSize(0)));

        mockMvc.perform(post("/api/v1/access/bridge/commands/" + commandId + "/result")
                .header("X-Bridge-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content("{\"success\": true, \"result\": \"pong from bridge 0.1.0\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));
        // A late duplicate answer changes nothing.
        mockMvc.perform(post("/api/v1/access/bridge/commands/" + commandId + "/result")
                .header("X-Bridge-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content("{\"success\": false, \"result\": \"late\"}"))
                .andExpect(jsonPath("$.status").value("DONE"));
        mockMvc.perform(get("/api/v1/crm/bridges/" + bridgeId + "/commands")
                .header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$[0].status").value("DONE"))
                .andExpect(jsonPath("$[0].result").value("pong from bridge 0.1.0"));

        // A command handed out but never answered goes out again, then gives up.
        String lost = mockMvc.perform(post("/api/v1/crm/bridges/" + bridgeId + "/ping")
                .header("Authorization", bearer(owner.token())))
                .andReturn().getResponse().getContentAsString();
        long lostId = ((Number) JsonPath.read(lost, "$.id")).longValue();
        for (int attempt = 1; attempt <= BridgeService.MAX_ATTEMPTS; attempt++) {
            mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                    .header("X-Bridge-Key", key).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(jsonPath("$.commands[0].id").value(lostId));
            BridgeCommand command = commandRepository.findById(lostId).orElseThrow();
            command.setSentAt(Instant.now().minus(BridgeService.REDELIVER_AFTER).minusSeconds(1));
            commandRepository.save(command);
        }
        mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                .header("X-Bridge-Key", key).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(jsonPath("$.commands", hasSize(0)));
        assertThat(commandRepository.findById(lostId).orElseThrow().getStatus())
                .isEqualTo(BridgeCommand.Status.FAILED);

        // Another gym can't see or use this bridge; rotating the key cuts the old one off.
        Account stranger = register("bridge-stranger@bjjflow.com", "Other Owner", "adult-black");
        createGym(stranger.token(), "Other Academy");
        mockMvc.perform(post("/api/v1/crm/bridges/" + bridgeId + "/ping")
                .header("Authorization", bearer(stranger.token())))
                .andExpect(status().isNotFound());
        String rotated = mockMvc.perform(post("/api/v1/crm/bridges/" + bridgeId + "/rotate-key")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                .header("X-Bridge-Key", key).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/access/bridge/heartbeat")
                .header("X-Bridge-Key", (String) JsonPath.read(rotated, "$.apiKey"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
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
