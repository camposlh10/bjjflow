package com.bjjflow.backend;

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
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

/** Retried or replayed (offline) writes must not create duplicates. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class IdempotencyFlowTest {

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
        return new String[] { "Bearer " + JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")) };
    }

    private Number checkIn(String auth, String clientId) throws Exception {
        String body = """
                {"date": "%s", "durationMinutes": 60%s}
                """.formatted(LocalDate.now(), clientId == null ? "" : ", \"clientId\": \"" + clientId + "\"");
        String json = mockMvc.perform(post("/api/v1/checkins").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.id");
    }

    @Test
    void sameCheckInSentTwiceIsRecordedOnce() throws Exception {
        String[] user = register("idem-checkin@bjjflow.com");

        Number first = checkIn(user[0], "phone-7f3a");
        Number replay = checkIn(user[0], "phone-7f3a");
        Number other = checkIn(user[0], "phone-9b21");

        org.assertj.core.api.Assertions.assertThat(replay.longValue()).isEqualTo(first.longValue());
        org.assertj.core.api.Assertions.assertThat(other.longValue()).isNotEqualTo(first.longValue());
        mockMvc.perform(get("/api/v1/checkins").param("from", LocalDate.now().minusDays(1).toString())
                .param("to", LocalDate.now().toString()).header("Authorization", user[0]))
                .andExpect(jsonPath("$", hasSize(2)));

        // Without a client id every request is a new check-in, as before.
        Number plainA = checkIn(user[0], null);
        Number plainB = checkIn(user[0], null);
        org.assertj.core.api.Assertions.assertThat(plainA.longValue()).isNotEqualTo(plainB.longValue());
    }

    @Test
    void clientIdsArePerUser() throws Exception {
        String[] a = register("idem-a@bjjflow.com");
        String[] b = register("idem-b@bjjflow.com");
        Number fromA = checkIn(a[0], "same-id");
        Number fromB = checkIn(b[0], "same-id");
        org.assertj.core.api.Assertions.assertThat(fromA.longValue()).isNotEqualTo(fromB.longValue());
    }

    @Test
    void sameMessageSentTwiceIsDeliveredOnce() throws Exception {
        String[] a = register("idem-dm-a@bjjflow.com");
        String[] b = register("idem-dm-b@bjjflow.com");
        String conv = mockMvc.perform(post("/api/v1/conversations").header("Authorization", a[0])
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\": %s}".formatted(b[1])))
                .andReturn().getResponse().getContentAsString();
        int convId = JsonPath.read(conv, "$.id");
        String url = "/api/v1/conversations/" + convId + "/messages";
        String body = "{\"content\": \"Oss!\", \"clientId\": \"msg-1\"}";

        String first = mockMvc.perform(post(url).header("Authorization", a[0])
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String replay = mockMvc.perform(post(url).header("Authorization", a[0])
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fromMe").value(true))
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat((Integer) JsonPath.read(replay, "$.id"))
                .isEqualTo((Integer) JsonPath.read(first, "$.id"));

        mockMvc.perform(get(url).param("limit", "50").header("Authorization", b[0]))
                .andExpect(jsonPath("$", hasSize(1)));
        // The recipient was notified once, not twice.
        mockMvc.perform(get("/api/v1/users/me/notifications").header("Authorization", b[0]))
                .andExpect(jsonPath("$.unread").value(1));
    }
}
