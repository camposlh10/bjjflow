package com.bjjflow.backend.users;

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
class UsernameFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email, String name) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email, name)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    @Test
    void registerGeneratesSanitizedUsernameAndDedupes() throws Exception {
        // accents/spaces stripped, lowercased
        String first = register("uname1@bjjflow.com", "João Silva");
        String u1 = JsonPath.read(first, "$.user.username");
        org.junit.jupiter.api.Assertions.assertEquals("joaosilva", u1);

        // same display name → second handle must differ (id suffix)
        String second = register("uname2@bjjflow.com", "João Silva");
        String u2 = JsonPath.read(second, "$.user.username");
        org.junit.jupiter.api.Assertions.assertNotEquals(u1, u2);
        org.junit.jupiter.api.Assertions.assertTrue(u2.startsWith("joaosilva"));
    }

    @Test
    void updateUsernameValidatesAndEnforcesUniqueness() throws Exception {
        String a = JsonPath.read(register("unamea@bjjflow.com", "Alpha"), "$.accessToken");
        String b = JsonPath.read(register("unameb@bjjflow.com", "Beta"), "$.accessToken");

        // A claims a custom handle
        mockMvc.perform(put("/api/v1/users/me/profile")
                .header("Authorization", "Bearer " + a)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\": \"oss_master\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("oss_master"));

        // B cannot take the same handle (case-insensitive)
        mockMvc.perform(put("/api/v1/users/me/profile")
                .header("Authorization", "Bearer " + b)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\": \"OSS_Master\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));

        // invalid characters rejected
        mockMvc.perform(put("/api/v1/users/me/profile")
                .header("Authorization", "Bearer " + b)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\": \"no\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_USERNAME"));
    }
}
