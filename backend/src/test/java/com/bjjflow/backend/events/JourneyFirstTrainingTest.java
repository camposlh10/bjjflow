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
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class JourneyFirstTrainingTest {

    @Autowired
    private MockMvc mockMvc;

    private void checkIn(String auth, LocalDate date) throws Exception {
        mockMvc.perform(post("/api/v1/checkins").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 60}".formatted(date)))
                .andExpect(status().isOk());
    }

    @Test
    void firstTrainingAppearsOnceAtTheEarliestSession() throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "journey@bjjflow.com", "password": "senha-forte-123", "displayName": "Journey",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """))
                .andReturn().getResponse().getContentAsString();
        String auth = "Bearer " + JsonPath.read(json, "$.accessToken");

        // Logged today first, then a back-dated session from earlier this month.
        LocalDate today = LocalDate.now();
        checkIn(auth, today);
        checkIn(auth, today.minusDays(5));

        mockMvc.perform(get("/api/v1/users/me/journey").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeline").isArray())
                .andExpect(result -> {
                    String body = result.getResponse().getContentAsString();
                    java.util.List<Object> firsts = JsonPath.read(body, "$.timeline[?(@.type == 'FIRST_TRAINING')]");
                    org.assertj.core.api.Assertions.assertThat(firsts).hasSize(1);
                    java.util.List<String> when = JsonPath.read(body,
                            "$.timeline[?(@.type == 'FIRST_TRAINING')].occurredAt");
                    org.assertj.core.api.Assertions.assertThat(when.get(0)).startsWith(today.minusDays(5).toString());
                });
    }
}
