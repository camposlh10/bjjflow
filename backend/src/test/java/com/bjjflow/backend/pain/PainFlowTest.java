package com.bjjflow.backend.pain;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
class PainFlowTest {

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
    void logMapHealAndValidate() throws Exception {
        String tok = register("pain1@bjjflow.com");

        // Empty map to start
        mockMvc.perform(get("/api/v1/users/me/pain").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regions.length()").value(0));

        // Log a shoulder injury (8/10) and a knee (5/10)
        mockMvc.perform(post("/api/v1/users/me/pain").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"region\": \"Shoulder_Left\", \"intensity\": 8, \"note\": \"tweaked in a kimura\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/users/me/pain").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"region\": \"knee_right\", \"intensity\": 5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regions.length()").value(2))
                // sorted by intensity desc -> shoulder first; region normalized to lowercase
                .andExpect(jsonPath("$.regions[0].region").value("shoulder_left"))
                .andExpect(jsonPath("$.regions[0].intensity").value(8));

        // Heal the shoulder (intensity 0) -> drops off the map
        mockMvc.perform(post("/api/v1/users/me/pain").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"region\": \"shoulder_left\", \"intensity\": 0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regions.length()").value(1))
                .andExpect(jsonPath("$.regions[0].region").value("knee_right"));

        // History keeps every entry
        mockMvc.perform(get("/api/v1/users/me/pain/history").header("Authorization", auth(tok)))
                .andExpect(jsonPath("$.length()").value(3));

        // Daily (today) shows the latest-per-region for the day (shoulder healed -> only knee)
        mockMvc.perform(get("/api/v1/users/me/pain/daily").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regions.length()").value(1))
                .andExpect(jsonPath("$.regions[0].region").value("knee_right"));

        // Monthly "bigger picture": both regions hurt this month, with peak intensity + day count
        mockMvc.perform(get("/api/v1/users/me/pain/monthly").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.regions.length()").value(2))
                .andExpect(jsonPath("$.regions[?(@.region == 'shoulder_left')].intensity")
                        .value(org.hamcrest.Matchers.hasItem(8)))
                .andExpect(jsonPath("$.regions[?(@.region == 'knee_right')].days")
                        .value(org.hamcrest.Matchers.hasItem(1)));

        // Out-of-range intensity rejected
        mockMvc.perform(post("/api/v1/users/me/pain").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"region\": \"neck\", \"intensity\": 11}"))
                .andExpect(status().isBadRequest());
    }
}
