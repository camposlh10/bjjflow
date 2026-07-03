package com.bjjflow.backend.checkins;

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
class CheckInFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String registerAndGetToken(String email) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "email": "%s",
                          "password": "senha-forte-123",
                          "displayName": "Atleta Teste",
                          "age": 30,
                          "beltSlug": "adult-purple",
                          "stripes": 1
                        }
                        """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    @Test
    void checkInUpdatesStreakAndStats() throws Exception {
        String token = registerAndGetToken("streak@bjjflow.com");
        LocalDate today = LocalDate.now();

        // initial stats: empty
        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStreak").value(0))
                .andExpect(jsonPath("$.totalCheckIns").value(0))
                .andExpect(jsonPath("$.checkedInToday").value(false))
                .andExpect(jsonPath("$.weeklyGoal").value(3));

        // yesterday's check-in (back-fill), then today's
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "durationMinutes": 90, "sessionType": "GI"}
                        """.formatted(today.minusDays(1))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "durationMinutes": 60}
                        """.formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(today.toString()));

        // streak of 2, correct totals
        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStreak").value(2))
                .andExpect(jsonPath("$.longestStreak").value(2))
                .andExpect(jsonPath("$.totalCheckIns").value(2))
                .andExpect(jsonPath("$.totalHours").value(3))
                .andExpect(jsonPath("$.checkedInToday").value(true));

        // second check-in same day: total grows, streak doesn't
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "durationMinutes": 60}
                        """.formatted(today)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.currentStreak").value(2))
                .andExpect(jsonPath("$.totalCheckIns").value(3));

        // future date rejected
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s"}
                        """.formatted(today.plusDays(1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("FUTURE_DATE"));
    }
}
