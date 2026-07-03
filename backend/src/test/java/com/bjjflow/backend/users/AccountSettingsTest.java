package com.bjjflow.backend.users;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class AccountSettingsTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0, "weightKg": 80.0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void changePasswordAndEmail() throws Exception {
        String tok = register("settings1@bjjflow.com");

        // wrong current password rejected
        mockMvc.perform(put("/api/v1/users/me/password").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\": \"nope-nope-123\", \"newPassword\": \"novasenha-123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WRONG_PASSWORD"));

        // correct change
        mockMvc.perform(put("/api/v1/users/me/password").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\": \"senha-forte-123\", \"newPassword\": \"novasenha-123\"}"))
                .andExpect(status().isNoContent());

        // can log in with the new password
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"settings1@bjjflow.com\", \"password\": \"novasenha-123\"}"))
                .andExpect(status().isOk());

        // change email (needs current password)
        mockMvc.perform(put("/api/v1/users/me/email").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\": \"novasenha-123\", \"email\": \"novo1@bjjflow.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("novo1@bjjflow.com"));
    }

    @Test
    void settingsTogglesFeedbackAndPrivacyHidesFromFeedAndSearch() throws Exception {
        String today = LocalDate.now().toString();
        String a = register("priv-a@bjjflow.com");
        String b = register("priv-b@bjjflow.com");

        // A posts a public training -> visible on the feed + searchable
        mockMvc.perform(post("/api/v1/checkins").header("Authorization", auth(a))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 90, \"visibility\": \"PUBLIC\"}".formatted(today)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/feed").header("Authorization", auth(b)))
                .andExpect(jsonPath("$.items[?(@.author.displayName == 'priv-a')]")
                        .value(org.hamcrest.Matchers.hasSize(1)));
        mockMvc.perform(get("/api/v1/users/search").param("q", "priv-a").header("Authorization", auth(b)))
                .andExpect(jsonPath("$.length()").value(1));

        // A goes private
        mockMvc.perform(put("/api/v1/users/me/settings").header("Authorization", auth(a))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"privateAccount\": true, \"notifyMessages\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.privateAccount").value(true))
                .andExpect(jsonPath("$.notifyMessages").value(false));

        // now hidden from the feed + search
        mockMvc.perform(get("/api/v1/feed").header("Authorization", auth(b)))
                .andExpect(jsonPath("$.items[?(@.author.displayName == 'priv-a')]")
                        .value(org.hamcrest.Matchers.hasSize(0)));
        mockMvc.perform(get("/api/v1/users/search").param("q", "priv-a").header("Authorization", auth(b)))
                .andExpect(jsonPath("$.length()").value(0));

        // feedback persists
        mockMvc.perform(post("/api/v1/users/me/feedback").header("Authorization", auth(a))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\": \"App muito bom, faltou modo claro\"}"))
                .andExpect(status().isNoContent());

        // training-load metric is populated
        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", auth(a)))
                .andExpect(jsonPath("$.weeklyMinutes").value(90))
                .andExpect(jsonPath("$.weeklyCalories").value(org.hamcrest.Matchers.greaterThan(0)));
    }
}
