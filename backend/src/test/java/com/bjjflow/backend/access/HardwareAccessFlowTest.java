package com.bjjflow.backend.access;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

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
class HardwareAccessFlowTest {

    private static final String CARD_UID = "04:A3:B2:C1:D0";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void hardwareScansFlowFromDeviceKeyToAttendance() throws Exception {
        Account owner = register("hw-owner@bjjflow.com", "Hardware Owner", "adult-black");
        GymInfo gym = createGym(owner.token(), "Hardware Key Academy");
        Account member = register("hw-member@bjjflow.com", "Hardware Member", "adult-blue");
        joinGym(member.token(), gym.inviteCode());
        long classId = createClass(owner, "Evening Gi", "18:00", "19:00");

        mockMvc.perform(post("/api/v1/crm/devices")
                .header("Authorization", bearer(member.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Rogue Reader\", \"type\": \"CARD\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_STAFF_ONLY"));

        String deviceJson = mockMvc.perform(post("/api/v1/crm/devices")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Front Door Reader", "type": "CARD",
                         "provider": "Generic RFID", "location": "Entrance"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.device.name").value("Front Door Reader"))
                .andExpect(jsonPath("$.device.active").value(true))
                .andExpect(jsonPath("$.apiKey", startsWith("bjjd_")))
                .andReturn().getResponse().getContentAsString();
        long deviceId = ((Number) JsonPath.read(deviceJson, "$.device.id")).longValue();
        String apiKey = JsonPath.read(deviceJson, "$.apiKey");

        mockMvc.perform(get("/api/v1/crm/devices")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(deviceId))
                .andExpect(jsonPath("$[0].apiKey").doesNotExist());

        mockMvc.perform(post("/api/v1/crm/members/" + member.userId() + "/credentials")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type": "card", "value": "%s", "label": "Blue keyfob"}
                        """.formatted(CARD_UID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("CARD"))
                .andExpect(jsonPath("$.active").value(true));

        mockMvc.perform(post("/api/v1/crm/members/" + member.userId() + "/credentials")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type": "CARD", "value": "%s"}
                        """.formatted(CARD_UID.toLowerCase())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_CREDENTIAL"));

        ZonedDateTime scanTime = ZonedDateTime.of(LocalDate.now(), LocalTime.of(17, 45), ZoneId.systemDefault());
        mockMvc.perform(post("/api/v1/access/hardware/events")
                .header("X-Device-Key", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalMemberId": "%s", "eventTime": "%s", "source": "CARD"}
                        """.formatted(CARD_UID, scanTime.toInstant())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSED_ATTENDANCE"))
                .andExpect(jsonPath("$.studentUserId").value(member.userId()))
                .andExpect(jsonPath("$.matchedClassId").value(classId));

        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId").value(member.userId()))
                .andExpect(jsonPath("$[0].status").value("PRESENT"));

        mockMvc.perform(post("/api/v1/access/hardware/events")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalMemberId": "%s", "eventTime": "%s", "source": "CARD"}
                        """.formatted(CARD_UID, scanTime.toInstant())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("DEVICE_KEY_REQUIRED"));

        mockMvc.perform(post("/api/v1/access/hardware/events")
                .header("X-Device-Key", "bjjd_totally-wrong-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalMemberId": "%s", "eventTime": "%s", "source": "CARD"}
                        """.formatted(CARD_UID, scanTime.toInstant())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_KEY"));

        String rotatedJson = mockMvc.perform(post("/api/v1/crm/devices/" + deviceId + "/rotate-key")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.apiKey", startsWith("bjjd_")))
                .andReturn().getResponse().getContentAsString();
        String rotatedKey = JsonPath.read(rotatedJson, "$.apiKey");

        ZonedDateTime laterScan = ZonedDateTime.of(LocalDate.now(), LocalTime.of(18, 30), ZoneId.systemDefault());
        mockMvc.perform(post("/api/v1/access/hardware/events")
                .header("X-Device-Key", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalMemberId": "%s", "eventTime": "%s", "source": "CARD"}
                        """.formatted(CARD_UID, laterScan.toInstant())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_KEY"));

        mockMvc.perform(post("/api/v1/access/hardware/events")
                .header("X-Device-Key", rotatedKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalMemberId": "%s", "eventTime": "%s", "source": "CARD"}
                        """.formatted(CARD_UID, laterScan.toInstant())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSED_ATTENDANCE"));

        // Minimal hardware payload: eventTime defaults to now, source defaults
        // to the device type.
        mockMvc.perform(post("/api/v1/access/hardware/events")
                .header("X-Device-Key", rotatedKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"externalMemberId\": \"%s\"}".formatted(CARD_UID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("CARD"))
                .andExpect(jsonPath("$.studentUserId").value(member.userId()));

        String credentialsJson = mockMvc.perform(get("/api/v1/crm/members/" + member.userId() + "/credentials")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andReturn().getResponse().getContentAsString();
        long credentialId = ((Number) JsonPath.read(credentialsJson, "$[0].id")).longValue();

        mockMvc.perform(put("/api/v1/crm/credentials/" + credentialId + "/revoke")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.revokedAt").isNotEmpty());

        ZonedDateTime revokedScan = ZonedDateTime.of(LocalDate.now(), LocalTime.of(18, 45), ZoneId.systemDefault());
        mockMvc.perform(post("/api/v1/access/hardware/events")
                .header("X-Device-Key", rotatedKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalMemberId": "%s", "eventTime": "%s", "source": "CARD"}
                        """.formatted(CARD_UID, revokedScan.toInstant())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNRESOLVED_MEMBER"));

        mockMvc.perform(put("/api/v1/crm/devices/" + deviceId + "/deactivate")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post("/api/v1/access/hardware/events")
                .header("X-Device-Key", rotatedKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"externalMemberId": "%s", "eventTime": "%s", "source": "CARD"}
                        """.formatted(CARD_UID, revokedScan.plusMinutes(5).toInstant())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_DEVICE_KEY"));
    }

    private long createClass(Account owner, String name, String startTime, String endTime) throws Exception {
        String response = mockMvc.perform(post("/api/v1/crm/classes")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "%s", "sessionType": "GI", "dayOfWeek": %d,
                         "startTime": "%s", "endTime": "%s", "instructorUserId": %d}
                        """.formatted(name, LocalDate.now().getDayOfWeek().getValue(), startTime, endTime,
                        owner.userId())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.id")).longValue();
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
