package com.bjjflow.backend.crm.settings;

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
class CrmGymSettingsFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void gymSettingsAreSharedBetweenCrmAndMobileApp() throws Exception {
        Account owner = register("settings-owner@bjjflow.com", "Settings Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Settings Academy");
        Account member = register("settings-member@bjjflow.com", "Settings Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        mockMvc.perform(get("/api/v1/crm/gym")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Settings Academy"))
                .andExpect(jsonPath("$.role").value("OWNER"));

        mockMvc.perform(get("/api/v1/crm/gym")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_STAFF_ONLY"));

        mockMvc.perform(put("/api/v1/crm/gym")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Settings Academy HQ", "city": "Rio de Janeiro",
                         "description": "Premier BJJ academy", "phone": "+55 21 99999-0000",
                         "instagram": "settingsacademy", "graduationTarget": 60}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Settings Academy HQ"))
                .andExpect(jsonPath("$.city").value("Rio de Janeiro"))
                .andExpect(jsonPath("$.phone").value("+55 21 99999-0000"))
                .andExpect(jsonPath("$.instagram").value("settingsacademy"))
                .andExpect(jsonPath("$.graduationTarget").value(60));

        // Same gym record: the change made in the CRM is what the mobile app sees.
        mockMvc.perform(get("/api/v1/gyms/me")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Settings Academy HQ"))
                .andExpect(jsonPath("$.city").value("Rio de Janeiro"));

        // And the reverse: an edit through the mobile-app endpoint shows in the CRM.
        mockMvc.perform(put("/api/v1/gyms/me")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Settings Academy Matriz\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/crm/gym")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Settings Academy Matriz"));

        // Instructors can view CRM settings but only the owner can edit them.
        mockMvc.perform(put("/api/v1/crm/members/" + member.userId())
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\": \"INSTRUCTOR\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/crm/gym")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Settings Academy Matriz"));
        mockMvc.perform(put("/api/v1/crm/gym")
                .header("Authorization", bearer(member.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Hostile Takeover\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_OWNER"));
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
