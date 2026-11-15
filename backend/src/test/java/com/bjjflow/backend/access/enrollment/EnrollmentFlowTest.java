package com.bjjflow.backend.access.enrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;


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
class EnrollmentFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void membersAreEnrolledOnDevicesThroughTheBridgeWithConsentForFaces() throws Exception {
        Account owner = register("enroll-owner@bjjflow.com", "Enroll Owner", "adult-black");
        GymInfo gym = createGym(owner.token(), "Enroll Academy");
        Account member = register("enroll-member@bjjflow.com", "Ana Souza", "adult-blue");
        joinGym(member.token(), gym.inviteCode());

        String bridgeJson = mockMvc.perform(post("/api/v1/crm/bridges").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Recepção\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long bridgeId = ((Number) JsonPath.read(bridgeJson, "$.bridge.id")).longValue();
        String bridgeKey = JsonPath.read(bridgeJson, "$.apiKey");
        long deviceId = device(owner, "iDFace Entrada", "Control iD");
        long otherBrand = device(owner, "Leitor genérico", "Acme");
        String access = "/api/v1/crm/members/" + member.userId() + "/access";

        // Not linked to a bridge yet.
        mockMvc.perform(enroll(owner, access, deviceId, "CARD", "123"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DEVICE_NOT_LINKED"));
        mockMvc.perform(put("/api/v1/crm/devices/" + deviceId).header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bridgeId\": %d, \"lanHost\": \"192.168.0.50\"}".formatted(bridgeId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bridgeId").value(bridgeId))
                .andExpect(jsonPath("$.lanHost").value("192.168.0.50"));
        mockMvc.perform(put("/api/v1/crm/devices/" + otherBrand).header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bridgeId\": %d, \"lanHost\": \"192.168.0.51\"}".formatted(bridgeId)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/crm/devices/" + deviceId).header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"lanHost\": \"http://evil/\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(enroll(owner, access, otherBrand, "CARD", "123"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VENDOR_NOT_SUPPORTED"));

        // Faces need recorded consent (LGPD).
        mockMvc.perform(enroll(owner, access, deviceId, "FACE", null))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));
        mockMvc.perform(post(access + "/face-consent").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"termsVersion\": \"2026-11\", \"memberAgreed\": false}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(access + "/face-consent").header("Authorization", bearer(member.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"termsVersion\": \"2026-11\", \"memberAgreed\": true}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(access + "/face-consent").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"termsVersion\": \"2026-11\", \"memberAgreed\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faceConsent.termsVersion").value("2026-11"))
                .andExpect(jsonPath("$.faceConsent.recordedByUserId").value(owner.userId()));

        mockMvc.perform(enroll(owner, access, deviceId, "FACE", null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.deviceName").value("iDFace Entrada"));
        // One registration at a time per device.
        mockMvc.perform(enroll(owner, access, deviceId, "CARD", "123.45678"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ENROLLMENT_IN_PROGRESS"));

        // The bridge picks it up: who, where and how, but no device password.
        String beat = heartbeat(bridgeKey);
        long faceCommand = ((Number) JsonPath.read(beat, "$.commands[0].id")).longValue();
        assertThat((String) JsonPath.read(beat, "$.commands[0].type")).isEqualTo("DEVICE_ENROLL");
        assertThat((String) JsonPath.read(beat, "$.commands[0].payload.host")).isEqualTo("192.168.0.50");
        assertThat((String) JsonPath.read(beat, "$.commands[0].payload.vendor")).isEqualTo("controlid");
        assertThat(((Number) JsonPath.read(beat, "$.commands[0].payload.userId")).longValue()).isEqualTo(member.userId());
        assertThat((String) JsonPath.read(beat, "$.commands[0].payload.method")).isEqualTo("FACE");
        assertThat(beat).doesNotContain("password");
        result(bridgeKey, faceCommand, true, "{\"method\":\"FACE\"}");

        mockMvc.perform(get(access).header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$.enrollments", hasSize(1)))
                .andExpect(jsonPath("$.enrollments[0].status").value("ENROLLED"));

        // A card as printed (facility.card) is converted to the device's value.
        mockMvc.perform(enroll(owner, access, deviceId, "CARD", "123.45678"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cardValue").value("528281023086"));
        String cardBeat = heartbeat(bridgeKey);
        assertThat((String) JsonPath.read(cardBeat, "$.commands[0].payload.cardValue")).isEqualTo("528281023086");
        result(bridgeKey, ((Number) JsonPath.read(cardBeat, "$.commands[0].id")).longValue(), false,
                "{\"error\":\"create_objects.fcgi failed (400): UNIQUE constraint failed: cards.value\"}");
        mockMvc.perform(get(access).header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$.enrollments[0].method").value("CARD"))
                .andExpect(jsonPath("$.enrollments[0].status").value("FAILED"))
                .andExpect(jsonPath("$.enrollments[0].lastError")
                        .value("create_objects.fcgi failed (400): UNIQUE constraint failed: cards.value"));

        // Revoking consent removes the face from the device.
        mockMvc.perform(delete(access + "/face-consent").header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faceConsent").doesNotExist())
                .andExpect(jsonPath("$.enrollments[1].method").value("FACE"))
                .andExpect(jsonPath("$.enrollments[1].status").value("REMOVING"));
        String removeBeat = heartbeat(bridgeKey);
        assertThat((String) JsonPath.read(removeBeat, "$.commands[0].type")).isEqualTo("DEVICE_REMOVE");
        result(bridgeKey, ((Number) JsonPath.read(removeBeat, "$.commands[0].id")).longValue(), true, "{}");
        mockMvc.perform(get(access).header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$.enrollments[1].status").value("REMOVED"));
        mockMvc.perform(enroll(owner, access, deviceId, "FACE", null))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));

        // Another gym's staff can't see or touch this member.
        Account stranger = register("enroll-stranger@bjjflow.com", "Other Owner", "adult-black");
        createGym(stranger.token(), "Other Enroll Academy");
        mockMvc.perform(get(access).header("Authorization", bearer(stranger.token())))
                .andExpect(status().isNotFound());
    }

    private long device(Account owner, String name, String provider) throws Exception {
        String json = mockMvc.perform(post("/api/v1/crm/devices").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"%s\", \"type\": \"FACE\", \"provider\": \"%s\"}".formatted(name, provider)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.device.id")).longValue();
    }

    private org.springframework.test.web.servlet.RequestBuilder enroll(Account owner, String access, long deviceId,
            String method, String cardValue) {
        String card = cardValue == null ? "" : ", \"cardValue\": \"" + cardValue + "\"";
        return post(access + "/enrollments").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"deviceId\": %d, \"method\": \"%s\"%s}".formatted(deviceId, method, card));
    }

    private String heartbeat(String key) throws Exception {
        return mockMvc.perform(post("/api/v1/access/bridge/heartbeat").header("X-Bridge-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commands", hasSize(1)))
                .andReturn().getResponse().getContentAsString();
    }

    private void result(String key, long commandId, boolean success, String result) throws Exception {
        mockMvc.perform(post("/api/v1/access/bridge/commands/" + commandId + "/result").header("X-Bridge-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"success\": %s, \"result\": %s}".formatted(success,
                        tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(result))))
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
