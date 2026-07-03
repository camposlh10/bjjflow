package com.bjjflow.backend.access;

import static org.hamcrest.Matchers.hasSize;
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
class AccessEventFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AccessDeviceRepository accessDeviceRepository;

    @Autowired
    private RawAccessEventRepository rawAccessEventRepository;

    @Test
    void rawEventsAreStoredThenProcessedIntoOfficialAttendance() throws Exception {
        Account owner = register("access-owner@bjjflow.com", "Access Owner", "adult-black");
        GymInfo gym = createGym(owner.token(), "Hardware Academy");
        Account member = register("access-member@bjjflow.com", "Access Member", "adult-blue");
        joinGym(member.token(), gym.inviteCode());
        long classId = createClass(owner, "Evening Gi", "18:00", "19:00");

        AccessDevice device = new AccessDevice();
        device.setGymId(gym.id());
        device.setName("Front Desk Turnstile");
        device.setType("TURNSTILE");
        device.setProvider("Generic");
        device.setLocation("Front desk");
        device = accessDeviceRepository.save(device);

        ZonedDateTime scanTime = ZonedDateTime.of(LocalDate.now(), LocalTime.of(17, 45), ZoneId.systemDefault());
        String scanBody = """
                {"deviceId": %d, "studentUserId": %d, "eventTime": "%s", "source": "TURNSTILE"}
                """.formatted(device.getId(), member.userId(), scanTime.toInstant());

        mockMvc.perform(post("/api/v1/access/events")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(scanBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSED_ATTENDANCE"))
                .andExpect(jsonPath("$.processed").value(true))
                .andExpect(jsonPath("$.matchedClassId").value(classId));

        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userId").value(member.userId()))
                .andExpect(jsonPath("$[0].status").value("PRESENT"));

        mockMvc.perform(post("/api/v1/access/events")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(scanBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DUPLICATE"))
                .andExpect(jsonPath("$.processed").value(true));

        ZonedDateTime visitTime = ZonedDateTime.of(LocalDate.now(), LocalTime.of(14, 0), ZoneId.systemDefault());
        mockMvc.perform(post("/api/v1/access/events")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"deviceId": %d, "studentUserId": %d, "eventTime": "%s", "source": "CARD"}
                        """.formatted(device.getId(), member.userId(), visitTime.toInstant())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNRESOLVED_CLASS"))
                .andExpect(jsonPath("$.matchedClassId").doesNotExist());

        mockMvc.perform(post("/api/v1/access/events")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"deviceId": %d, "externalMemberId": "unknown-card", "eventTime": "%s",
                         "source": "CARD"}
                        """.formatted(device.getId(), scanTime.plusMinutes(1).toInstant())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNRESOLVED_MEMBER"));

        Account otherOwner = register("access-other@bjjflow.com", "Other Access Owner", "adult-black");
        createGym(otherOwner.token(), "Other Hardware Academy");
        mockMvc.perform(post("/api/v1/access/events")
                .header("Authorization", bearer(otherOwner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(scanBody))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACCESS_DEVICE_NOT_FOUND"));

        org.junit.jupiter.api.Assertions.assertEquals(4, rawAccessEventRepository.count());
    }

    @Test
    void staffCanReconcileUnresolvedAccessEvents() throws Exception {
        Account owner = register("review-owner@bjjflow.com", "Review Owner", "adult-black");
        GymInfo gym = createGym(owner.token(), "Review Academy");
        Account member = register("review-member@bjjflow.com", "Review Member", "adult-blue");
        joinGym(member.token(), gym.inviteCode());
        long classId = createClass(owner, "Review Gi", "18:00", "19:00");

        AccessDevice device = new AccessDevice();
        device.setGymId(gym.id());
        device.setName("Review Turnstile");
        device.setType("TURNSTILE");
        device = accessDeviceRepository.save(device);

        ZonedDateTime classWindow = ZonedDateTime.of(
                LocalDate.now(), LocalTime.of(17, 45), ZoneId.systemDefault());
        String unresolvedMemberJson = mockMvc.perform(post("/api/v1/access/events")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"deviceId": %d, "externalMemberId": "unknown-fingerprint",
                         "eventTime": "%s", "source": "FINGERPRINT"}
                        """.formatted(device.getId(), classWindow.toInstant())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNRESOLVED_MEMBER"))
                .andReturn().getResponse().getContentAsString();
        long unresolvedMemberId = ((Number) JsonPath.read(unresolvedMemberJson, "$.id")).longValue();

        mockMvc.perform(get("/api/v1/crm/attendance/unresolved-access-events")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].deviceName").value("Review Turnstile"))
                .andExpect(jsonPath("$[0].status").value("UNRESOLVED_MEMBER"));

        mockMvc.perform(put("/api/v1/crm/attendance/access-events/" + unresolvedMemberId
                + "/link-member/" + member.userId())
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentUserId").value(member.userId()))
                .andExpect(jsonPath("$.status").value("PROCESSED_ATTENDANCE"))
                .andExpect(jsonPath("$.matchedClassId").value(classId));

        ZonedDateTime outsideWindow = ZonedDateTime.of(
                LocalDate.now(), LocalTime.of(14, 0), ZoneId.systemDefault());
        String unresolvedClassBody = """
                {"deviceId": %d, "studentUserId": %d, "eventTime": "%s", "source": "CARD"}
                """.formatted(device.getId(), member.userId(), outsideWindow.toInstant());
        String unresolvedClassJson = mockMvc.perform(post("/api/v1/access/events")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(unresolvedClassBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNRESOLVED_CLASS"))
                .andReturn().getResponse().getContentAsString();
        long unresolvedClassId = ((Number) JsonPath.read(unresolvedClassJson, "$.id")).longValue();

        mockMvc.perform(put("/api/v1/crm/attendance/access-events/" + unresolvedClassId
                + "/assign-class/" + classId)
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSED_ATTENDANCE"))
                .andExpect(jsonPath("$.matchedClassId").value(classId));

        String duplicateJson = mockMvc.perform(post("/api/v1/access/events")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(unresolvedClassBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DUPLICATE"))
                .andReturn().getResponse().getContentAsString();
        long duplicateId = ((Number) JsonPath.read(duplicateJson, "$.id")).longValue();

        mockMvc.perform(put("/api/v1/crm/attendance/access-events/" + duplicateId + "/mark-ignored")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IGNORED"));

        mockMvc.perform(get("/api/v1/crm/attendance/unresolved-access-events")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        Account otherOwner = register("review-other@bjjflow.com", "Review Other", "adult-black");
        createGym(otherOwner.token(), "Other Review Academy");
        mockMvc.perform(put("/api/v1/crm/attendance/access-events/" + unresolvedMemberId + "/mark-ignored")
                .header("Authorization", bearer(otherOwner.token())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACCESS_EVENT_NOT_FOUND"));
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
