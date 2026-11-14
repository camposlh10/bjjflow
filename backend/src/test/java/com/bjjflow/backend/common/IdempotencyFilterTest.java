package com.bjjflow.backend.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

/**
 * Not @Transactional: the filter's records are committed for real, as in
 * production, so each test uses its own user.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class IdempotencyFilterTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JdbcTemplate jdbc;

    /** Returns {bearer header, user id}. */
    private String[] register() throws Exception {
        String email = "idem-" + UUID.randomUUID().toString().substring(0, 8) + "@bjjflow.com";
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "Idem",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] { "Bearer " + JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")) };
    }

    private String checkInBody() {
        return "{\"date\": \"%s\", \"durationMinutes\": 60}".formatted(LocalDate.now());
    }

    private int checkInsToday(String auth) throws Exception {
        String json = mockMvc.perform(get("/api/v1/checkins").header("Authorization", auth)
                .param("from", LocalDate.now().toString()).param("to", LocalDate.now().toString()))
                .andReturn().getResponse().getContentAsString();
        return ((java.util.List<?>) JsonPath.read(json, "$")).size();
    }

    @Test
    void aRepeatedWriteIsAppliedOnceAndTheSameResponseIsReturned() throws Exception {
        String[] user = register();
        String key = "key-" + UUID.randomUUID();

        String first = mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Idempotent-Replayed"))
                .andReturn().getResponse().getContentAsString();

        String replay = mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                .andExpect(status().isOk())
                .andExpect(header().string("Idempotent-Replayed", "true"))
                .andReturn().getResponse().getContentAsString();

        assertThat(replay).isEqualTo(first);
        assertThat(checkInsToday(user[0])).isEqualTo(1);
    }

    @Test
    void differentKeysAreDifferentWrites() throws Exception {
        String[] user = register();
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                    .header("Idempotency-Key", "key-" + UUID.randomUUID())
                    .contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                    .andExpect(status().isOk());
        }
        assertThat(checkInsToday(user[0])).isEqualTo(2);
    }

    @Test
    void writesWithoutAKeyBehaveAsBefore() throws Exception {
        String[] user = register();
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                    .contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                    .andExpect(status().isOk());
        }
        assertThat(checkInsToday(user[0])).isEqualTo(2);
    }

    @Test
    void keysAreScopedToTheUser() throws Exception {
        String[] a = register();
        String[] b = register();
        String key = "shared-" + UUID.randomUUID();
        for (String[] user : new String[][] { a, b }) {
            mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                    .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                    .andExpect(status().isOk())
                    .andExpect(header().doesNotExist("Idempotent-Replayed"));
        }
        assertThat(checkInsToday(a[0])).isEqualTo(1);
        assertThat(checkInsToday(b[0])).isEqualTo(1);
    }

    @Test
    void reusingAKeyOnAnotherEndpointIsRejected() throws Exception {
        String[] user = register();
        String key = "key-" + UUID.randomUUID();
        mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/users/me/notifications/read-all").header("Authorization", user[0])
                .header("Idempotency-Key", key))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void aDuplicateOfARequestStillRunningIsToldToRetry() throws Exception {
        String[] user = register();
        String key = "key-" + UUID.randomUUID();
        jdbc.update("INSERT INTO idempotency_records (user_id, idem_key, method, path, state, created_at) "
                + "VALUES (?, ?, 'POST', '/api/v1/checkins', 'IN_PROGRESS', ?)",
                Long.parseLong(user[1]), key, Timestamp.from(Instant.now()));

        mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_IN_PROGRESS"));
        assertThat(checkInsToday(user[0])).isEqualTo(0);
    }

    @Test
    void aStaleReservationFromACrashedRequestIsTakenOver() throws Exception {
        String[] user = register();
        String key = "key-" + UUID.randomUUID();
        jdbc.update("INSERT INTO idempotency_records (user_id, idem_key, method, path, state, created_at) "
                + "VALUES (?, ?, 'POST', '/api/v1/checkins', 'IN_PROGRESS', ?)",
                Long.parseLong(user[1]), key, Timestamp.from(Instant.now().minusSeconds(600)));

        mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                .andExpect(status().isOk());
        assertThat(checkInsToday(user[0])).isEqualTo(1);
    }

    @Test
    void clientErrorsAreRememberedToo() throws Exception {
        String[] user = register();
        String key = "key-" + UUID.randomUUID();
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(delete("/api/v1/users/me/techniques/999999").header("Authorization", user[0])
                    .header("Idempotency-Key", key))
                    .andExpect(status().isNotFound());
        }
        String state = jdbc.queryForObject("SELECT state FROM idempotency_records WHERE idem_key = ?",
                String.class, key);
        assertThat(state).isEqualTo("DONE");
    }

    @Test
    void malformedKeysAreRejected() throws Exception {
        String[] user = register();
        mockMvc.perform(post("/api/v1/checkins").header("Authorization", user[0])
                .header("Idempotency-Key", "bad key!").contentType(MediaType.APPLICATION_JSON).content(checkInBody()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IDEMPOTENCY_KEY"));
    }
}
