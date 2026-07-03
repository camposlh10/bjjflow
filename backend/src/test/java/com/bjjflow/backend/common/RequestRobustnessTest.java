package com.bjjflow.backend.common;

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
class RequestRobustnessTest {

    @Autowired
    private MockMvc mockMvc;

    private String token() throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "robust@bjjflow.com", "password": "senha-forte-123", "displayName": "Robust",
                         "age": 25, "beltSlug": "adult-blue", "stripes": 0}
                        """))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    /** Malformed/unparseable input must be a clean 400 — never a 401 (which the mobile
     *  reads as "session expired" and would log the user out). */
    @Test
    void malformedRequestsAre400NotAuthErrors() throws Exception {
        String t = token();

        // Unparseable date inside the request body.
        mockMvc.perform(post("/api/v1/checkins").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"not-a-date\", \"durationMinutes\": 60}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));

        // Query param of the wrong type.
        mockMvc.perform(get("/api/v1/feed?cursor=abc").header("Authorization", "Bearer " + t))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));

        // Broken JSON to a public endpoint.
        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content("{bad json,,,"))
                .andExpect(status().isBadRequest());
    }
}
