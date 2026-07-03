package com.bjjflow.backend.events;

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
class UserEventsFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email, String belt) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 28, "beltSlug": "%s", "stripes": 0}
                        """.formatted(email, email.split("@")[0], belt)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    private void checkIn(String token, LocalDate date) throws Exception {
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 60}".formatted(date)))
                .andExpect(status().isOk());
    }

    @Test
    void milestonesAndJourney() throws Exception {
        String tok = register("journeyuser@bjjflow.com", "adult-white");

        // 10 consecutive days -> total 10 (TRAINING_MILESTONE 10), streak reaches 7 (STREAK_MILESTONE 7)
        for (int i = 9; i >= 0; i--) {
            checkIn(tok, LocalDate.now().minusDays(i));
        }
        // duplicate same-day check-in must NOT emit a second milestone
        checkIn(tok, LocalDate.now());

        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeWeeks").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

        String journey = mockMvc.perform(get("/api/v1/users/me/journey").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.belt.slug").value("adult-white"))
                .andReturn().getResponse().getContentAsString();

        java.util.List<String> types = JsonPath.read(journey, "$.timeline[*].type");
        org.assertj.core.api.Assertions.assertThat(types).contains("FIRST_TRAINING");
        // exactly one training milestone of value 10 (idempotency held)
        java.util.List<Integer> trainingMilestones =
                JsonPath.read(journey, "$.timeline[?(@.type == 'TRAINING_MILESTONE')].value");
        org.assertj.core.api.Assertions.assertThat(trainingMilestones).containsExactly(10);
        java.util.List<Integer> streakMilestones =
                JsonPath.read(journey, "$.timeline[?(@.type == 'STREAK_MILESTONE')].value");
        org.assertj.core.api.Assertions.assertThat(streakMilestones).contains(7);
    }

    @Test
    void academyActivityAndCompetition() throws Exception {
        String owner = register("actowner@bjjflow.com", "adult-black");
        String code = JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Feed\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteCode");

        String student = register("actstudent@bjjflow.com", "adult-blue");
        String studentId = String.valueOf((Integer) JsonPath.read(
                mockMvc.perform(get("/api/v1/users/me").header("Authorization", auth(student)))
                        .andReturn().getResponse().getContentAsString(), "$.id"));
        mockMvc.perform(post("/api/v1/gyms/join").header("Authorization", auth(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(code)))
                .andExpect(status().isOk());

        // owner promotes the student -> derived BELT_PROMOTION in the academy feed
        mockMvc.perform(post("/api/v1/gyms/me/members/" + studentId + "/promote")
                .header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"beltSlug\": \"adult-purple\", \"stripes\": 0}"))
                .andExpect(status().isOk());

        // student logs a competition result -> stored event
        mockMvc.perform(post("/api/v1/users/me/competitions")
                .header("Authorization", auth(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Open SP\", \"placement\": 1, \"date\": \"%s\"}".formatted(LocalDate.now())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeline[?(@.type == 'COMPETITION_RESULT')].text").value(
                        org.hamcrest.Matchers.hasItem("Open SP")));

        // owner's academy feed shows promotion, new member and the competition
        String feed = mockMvc.perform(get("/api/v1/gyms/me/activity").header("Authorization", auth(owner)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        java.util.List<String> feedTypes = JsonPath.read(feed, "$[*].type");
        org.assertj.core.api.Assertions.assertThat(feedTypes)
                .contains("BELT_PROMOTION", "NEW_MEMBER", "COMPETITION_RESULT");
    }
}
