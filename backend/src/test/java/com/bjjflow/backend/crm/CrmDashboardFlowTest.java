package com.bjjflow.backend.crm;

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
class CrmDashboardFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void staffCanSeeGymDashboardAndMembersCannot() throws Exception {
        String ownerToken = register("crm-owner@bjjflow.com", "CRM Owner");
        String gymJson = mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"CRM Academy\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Number gymId = JsonPath.read(gymJson, "$.id");
        String inviteCode = JsonPath.read(gymJson, "$.inviteCode");

        String memberToken = register("crm-member@bjjflow.com", "CRM Member");
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", bearer(memberToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(inviteCode)))
                .andExpect(status().isOk());

        LocalDate today = LocalDate.now();
        long todayClassId = createClass(ownerToken, today.getDayOfWeek().getValue(), "Today Class");
        createClass(ownerToken, today.plusDays(1).getDayOfWeek().getValue(), "Tomorrow Class");

        mockMvc.perform(post("/api/v1/gyms/classes/" + todayClassId + "/checkin")
                .header("Authorization", bearer(memberToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\"}".formatted(today)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/crm/dashboard")
                .header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gymId").value(gymId.longValue()))
                .andExpect(jsonPath("$.gymName").value("CRM Academy"))
                .andExpect(jsonPath("$.totalMembers").value(2))
                .andExpect(jsonPath("$.activeClasses").value(2))
                .andExpect(jsonPath("$.todayClasses").value(1))
                .andExpect(jsonPath("$.todayCheckIns").value(1))
                .andExpect(jsonPath("$.monthlyCheckIns").value(1));

        mockMvc.perform(get("/api/v1/crm/dashboard")
                .header("Authorization", bearer(memberToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_STAFF_ONLY"));
    }

    private String register(String email, String displayName) throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email, displayName)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }

    private long createClass(String token, int dayOfWeek, String name) throws Exception {
        String response = mockMvc.perform(post("/api/v1/gyms/classes")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "%s", "dayOfWeek": %d, "startTime": "00:30", "endTime": "23:30",
                         "sessionType": "GI", "restrictionMode": "ALL"}
                        """.formatted(name, dayOfWeek)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.id")).longValue();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
