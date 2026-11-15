package com.bjjflow.backend.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
class ControlIdVendorFlowTest {

    private static final ZoneId GYM_ZONE = ZoneId.of("America/Sao_Paulo");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RawAccessEventRepository rawAccessEventRepository;

    @Test
    void controlIdMonitorNotificationsBecomeAttendance() throws Exception {
        Account owner = register("cid-owner@bjjflow.com", "Cid Owner", "adult-black");
        GymInfo gym = createGym(owner.token(), "Control iD Academy");
        Account member = register("cid-member@bjjflow.com", "Cid Member", "adult-blue");
        joinGym(member.token(), gym.inviteCode());
        Account other = register("cid-other@bjjflow.com", "Cid Other", "adult-white");
        joinGym(other.token(), gym.inviteCode());
        long classId = createClass(owner, "Evening Gi", "18:00", "19:00");

        String deviceJson = mockMvc.perform(post("/api/v1/crm/devices")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"iDFace Entrada\", \"type\": \"FACE\", \"provider\": \"Control iD\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String apiKey = JsonPath.read(deviceJson, "$.apiKey");
        String base = "/api/v1/access/vendors/controlid/" + apiKey;
        LocalDate today = LocalDate.now(GYM_ZONE);
        long at1745 = ZonedDateTime.of(today, LocalTime.of(17, 45), GYM_ZONE).toEpochSecond();

        // Device registered with the member's BJJ Flow id: counts right away.
        mockMvc.perform(post(base + "/dao").contentType(MediaType.APPLICATION_JSON)
                .content(dao("519", at1745, "7", Long.toString(member.userId()))))
                .andExpect(status().isOk())
                .andExpect(content().string(""));
        // The device resends the same log: still one attendance.
        mockMvc.perform(post(base + "/dao").contentType(MediaType.APPLICATION_JSON)
                .content(dao("519", at1745, "7", Long.toString(member.userId()))))
                .andExpect(status().isOk());
        // Denied and unidentified attempts are ignored.
        mockMvc.perform(post(base + "/dao").contentType(MediaType.APPLICATION_JSON)
                .content(dao("520", at1745, "6", Long.toString(other.userId()))))
                .andExpect(status().isOk());
        mockMvc.perform(post(base + "/dao").contentType(MediaType.APPLICATION_JSON)
                .content(dao("521", at1745, "7", "0")))
                .andExpect(status().isOk());
        // Heartbeats and notifications we don't use are acknowledged (the
        // documented catra_event example isn't even valid JSON).
        mockMvc.perform(post(base + "/device_is_alive").contentType(MediaType.APPLICATION_JSON)
                .content("{\"access_logs\":0,\"device_id\":478435,\"time\":1532977090}"))
                .andExpect(status().isOk());
        mockMvc.perform(post(base + "/catra_event").contentType(MediaType.APPLICATION_JSON)
                .content("{\"event\":{\"type\":7,\"name\":'TURN LEFT'}}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId").value(member.userId()))
                .andExpect(jsonPath("$[0].classId").value(classId))
                .andExpect(jsonPath("$[0].source").value("DEVICE"));

        // A device-local id we don't know goes to review; linking it once
        // teaches the id, so the next passage counts by itself.
        mockMvc.perform(post(base + "/dao").contentType(MediaType.APPLICATION_JSON)
                .content(dao("600", at1745, "7", "37")))
                .andExpect(status().isOk());
        String reviewJson = mockMvc.perform(get("/api/v1/crm/attendance/unresolved-access-events")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalMemberId").value("37"))
                .andExpect(jsonPath("$[0].source").value("FACE"))
                .andReturn().getResponse().getContentAsString();
        long eventId = ((Number) JsonPath.read(reviewJson, "$[0].id")).longValue();
        mockMvc.perform(put("/api/v1/crm/attendance/access-events/" + eventId + "/link-member/" + other.userId())
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSED_ATTENDANCE"));
        mockMvc.perform(get("/api/v1/crm/members/" + other.userId() + "/credentials")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].type").value("FACE"))
                .andExpect(jsonPath("$[0].value").value("37"));

        mockMvc.perform(post(base + "/dao").contentType(MediaType.APPLICATION_JSON)
                .content(dao("601", at1745 + 60, "7", "37")))
                .andExpect(status().isOk());
        assertThat(rawAccessEventRepository.findAll().stream()
                .filter(e -> "access_log:601".equals(e.getDeviceEventId()))
                .findFirst().orElseThrow().getStudentUserId()).isEqualTo(other.userId());

        // Wrong key and unknown brand are refused.
        mockMvc.perform(post("/api/v1/access/vendors/controlid/bjjd_wrong/dao")
                .contentType(MediaType.APPLICATION_JSON).content(dao("1", at1745, "7", "1")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/access/vendors/acme/" + apiKey + "/dao")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }

    private static String dao(String logId, long time, String event, String userId) {
        return """
                {"object_changes":[{"object":"access_logs","type":"inserted","values":{
                  "id":"%s","time":"%d","event":"%s","device_id":"478435","identifier_id":"0",
                  "user_id":"%s","portal_id":"1","identification_rule_id":"0","card_value":"0",
                  "log_type_id":"-1"}}],"device_id":478435}
                """.formatted(logId, time, event, userId);
    }

    private long createClass(Account owner, String name, String startTime, String endTime) throws Exception {
        LocalDate day = LocalDate.now(GYM_ZONE);
        String response = mockMvc.perform(post("/api/v1/crm/classes")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "%s", "sessionType": "GI", "dayOfWeek": %d,
                         "startTime": "%s", "endTime": "%s", "instructorUserId": %d}
                        """.formatted(name, day.getDayOfWeek().getValue(), startTime, endTime,
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
