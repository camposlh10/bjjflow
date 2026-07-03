package com.bjjflow.backend.crm.attendance;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class CrmAttendanceFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void staffCanMarkAndViewGymIsolatedAttendance() throws Exception {
        Account owner = register("crm-attendance-owner@bjjflow.com", "Attendance Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Attendance Academy");
        Account member = register("crm-attendance-member@bjjflow.com", "Attendance Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        long classId = createClass(owner, "Fundamentals");
        LocalDate today = LocalDate.now();

        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_STAFF_ONLY"));

        mockMvc.perform(post("/api/v1/crm/attendance")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"classId": %d, "userId": %d, "date": "%s", "present": true}
                        """.formatted(classId, member.userId(), today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.present").value(true));

        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].classId").value(classId))
                .andExpect(jsonPath("$[0].className").value("Fundamentals"))
                .andExpect(jsonPath("$[0].userId").value(member.userId()))
                .andExpect(jsonPath("$[0].displayName").value("Attendance Member"))
                .andExpect(jsonPath("$[0].status").value("PRESENT"));

        mockMvc.perform(get("/api/v1/crm/attendance/member/" + member.userId())
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].date").value(today.toString()));

        Account otherOwner = register("crm-attendance-other@bjjflow.com", "Other Owner", "adult-black");
        createGym(otherOwner.token(), "Other Academy");
        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(otherOwner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/api/v1/crm/attendance/member/" + member.userId())
                .header("Authorization", bearer(otherOwner.token())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));

        mockMvc.perform(post("/api/v1/crm/attendance")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"classId": %d, "userId": %d, "date": "%s", "present": false}
                        """.formatted(classId, member.userId(), today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.present").value(false));

        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(post("/api/v1/crm/attendance")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"classId": %d, "userId": %d, "date": "%s", "status": "LATE"}
                        """.formatted(classId, member.userId(), today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.present").value(true))
                .andExpect(jsonPath("$.status").value("LATE"));

        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("LATE"));

        mockMvc.perform(post("/api/v1/crm/attendance")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"classId": %d, "userId": %d, "date": "%s", "status": "ABSENT"}
                        """.formatted(classId, member.userId(), today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.present").value(false))
                .andExpect(jsonPath("$.status").value("ABSENT"));

        mockMvc.perform(get("/api/v1/crm/attendance/today")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    private long createClass(Account owner, String name) throws Exception {
        String response = mockMvc.perform(post("/api/v1/crm/classes")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "%s", "sessionType": "GI", "dayOfWeek": %d,
                         "startTime": "18:00", "endTime": "19:00", "instructorUserId": %d}
                        """.formatted(name, LocalDate.now().getDayOfWeek().getValue(), owner.userId())))
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
