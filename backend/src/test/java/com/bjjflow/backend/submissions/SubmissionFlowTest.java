package com.bjjflow.backend.submissions;

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
class SubmissionFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String[] register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] {
                JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")),
        };
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void detailedCheckInAndSubmissionStats() throws Exception {
        String[] u = register("subs@bjjflow.com");
        String tok = u[0];
        String id = u[1];
        String today = LocalDate.now().toString();
        String month = today.substring(0, 7);

        // detailed check-in: 2 armbars + 1 triangle landed, 1 heel hook conceded
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "sessionType": "GI", "durationMinutes": 90,
                         "submissions": [
                           {"submission": "ARMBAR", "direction": "HIT", "count": 2},
                           {"submission": "TRIANGLE", "direction": "HIT", "count": 1},
                           {"submission": "HEEL_HOOK", "direction": "CONCEDED", "count": 1}
                         ]}
                        """.formatted(today)))
                .andExpect(status().isOk());

        // landed (HIT) stats: total 3, armbar 2 (66.7%)
        mockMvc.perform(get("/api/v1/users/" + id + "/submissions")
                .param("direction", "HIT").param("month", month)
                .header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items[0].submission").value("ARMBAR"))
                .andExpect(jsonPath("$.items[0].count").value(2))
                .andExpect(jsonPath("$.items[0].percentage").value(66.7));

        // conceded stats: the heel hook
        mockMvc.perform(get("/api/v1/users/" + id + "/submissions")
                .param("direction", "CONCEDED").param("month", month)
                .header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].submission").value("HEEL_HOOK"));

        // a different month is empty
        mockMvc.perform(get("/api/v1/users/" + id + "/submissions")
                .param("direction", "HIT").param("month", "2000-01")
                .header("Authorization", auth(tok)))
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void quickCheckInWithoutSubmissionsStillWorks() throws Exception {
        String[] u = register("subsquick@bjjflow.com");
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(u[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 60}".formatted(LocalDate.now())))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", auth(u[0])))
                .andExpect(jsonPath("$.currentStreak").value(1));
    }
}
