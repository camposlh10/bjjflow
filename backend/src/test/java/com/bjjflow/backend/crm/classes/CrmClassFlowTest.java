package com.bjjflow.backend.crm.classes;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class CrmClassFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void staffCanCreateListUpdateAndDeleteClasses() throws Exception {
        Account owner = register("crm-class-owner@bjjflow.com", "Class Owner", "adult-black");
        String gymJson = mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Class CRM Academy\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String inviteCode = JsonPath.read(gymJson, "$.inviteCode");

        Account member = register("crm-class-member@bjjflow.com", "Class Member", "adult-blue");
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", bearer(member.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(inviteCode)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/crm/classes")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_STAFF_ONLY"));

        String created = mockMvc.perform(post("/api/v1/crm/classes")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Fundamentals", "instructorUserId": %d, "dayOfWeek": 2,
                         "startTime": "18:00", "endTime": "19:00", "sessionType": "GI"}
                        """.formatted(owner.userId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Fundamentals"))
                .andExpect(jsonPath("$.instructorUserId").value(owner.userId()))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn().getResponse().getContentAsString();
        long classId = ((Number) JsonPath.read(created, "$.id")).longValue();

        mockMvc.perform(get("/api/v1/crm/classes")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(classId));

        mockMvc.perform(put("/api/v1/crm/classes/" + classId)
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Advanced Gi", "instructorUserId": %d, "dayOfWeek": 3,
                         "startTime": "19:00", "endTime": "20:30", "sessionType": "GI"}
                        """.formatted(owner.userId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Advanced Gi"))
                .andExpect(jsonPath("$.dayOfWeek").value(3))
                .andExpect(jsonPath("$.startTime").value("19:00"))
                .andExpect(jsonPath("$.endTime").value("20:30"));

        mockMvc.perform(put("/api/v1/crm/classes/" + classId)
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Invalid Instructor", "instructorUserId": %d, "dayOfWeek": 3,
                         "startTime": "19:00", "endTime": "20:30", "sessionType": "GI"}
                        """.formatted(member.userId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INSTRUCTOR"));

        mockMvc.perform(delete("/api/v1/crm/classes/" + classId)
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/crm/classes")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].active").value(false));

        mockMvc.perform(put("/api/v1/crm/classes/" + classId)
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
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
