package com.bjjflow.backend.auth;

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
class MfaFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private static final String PASSWORD = "senha-forte-123";

    private String register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "%s", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0, "weightKg": 80.0}
                        """.formatted(email, PASSWORD, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String login(String email) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"%s\", \"password\": \"%s\"}".formatted(email, PASSWORD)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void enrollEnableThenLoginRequiresCode() throws Exception {
        String email = "mfa1@bjjflow.com";
        String tok = register(email);

        // Enroll -> get secret + recovery codes
        String enroll = mockMvc.perform(post("/api/v1/users/me/mfa/enroll").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").isNotEmpty())
                .andExpect(jsonPath("$.otpauthUri").value(org.hamcrest.Matchers.startsWith("otpauth://totp/")))
                .andExpect(jsonPath("$.recoveryCodes.length()").value(8))
                .andReturn().getResponse().getContentAsString();
        String secret = JsonPath.read(enroll, "$.secret");
        String recovery = ((java.util.List<String>) JsonPath.read(enroll, "$.recoveryCodes")).get(0);

        // Not active until a valid code confirms it
        mockMvc.perform(post("/api/v1/users/me/mfa/enable").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON).content("{\"code\": \"000000\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_MFA_CODE"));

        mockMvc.perform(post("/api/v1/users/me/mfa/enable").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\": \"%s\"}".formatted(Totp.currentCode(secret))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));

        mockMvc.perform(get("/api/v1/users/me/settings").header("Authorization", auth(tok)))
                .andExpect(jsonPath("$.mfaEnabled").value(true));

        // Login is now challenged: an mfaToken instead of access tokens
        String challenged = login(email);
        org.junit.jupiter.api.Assertions.assertEquals(Boolean.TRUE, JsonPath.read(challenged, "$.mfaRequired"));
        String mfaToken = JsonPath.read(challenged, "$.mfaToken");

        // Wrong code rejected
        mockMvc.perform(post("/api/v1/auth/mfa").contentType(MediaType.APPLICATION_JSON)
                .content("{\"mfaToken\": \"%s\", \"code\": \"000000\"}".formatted(mfaToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_MFA_CODE"));

        // Correct TOTP completes the login
        mockMvc.perform(post("/api/v1/auth/mfa").contentType(MediaType.APPLICATION_JSON)
                .content("{\"mfaToken\": \"%s\", \"code\": \"%s\"}".formatted(mfaToken, Totp.currentCode(secret))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());

        // Recovery code also completes a fresh login (single-use)
        String mfaToken2 = JsonPath.read(login(email), "$.mfaToken");
        mockMvc.perform(post("/api/v1/auth/mfa").contentType(MediaType.APPLICATION_JSON)
                .content("{\"mfaToken\": \"%s\", \"code\": \"%s\"}".formatted(mfaToken2, recovery)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
        // ...and is now consumed
        String mfaToken3 = JsonPath.read(login(email), "$.mfaToken");
        mockMvc.perform(post("/api/v1/auth/mfa").contentType(MediaType.APPLICATION_JSON)
                .content("{\"mfaToken\": \"%s\", \"code\": \"%s\"}".formatted(mfaToken3, recovery)))
                .andExpect(status().isUnauthorized());

        // Disable -> login returns tokens directly again
        mockMvc.perform(post("/api/v1/users/me/mfa/disable").header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON).content("{\"password\": \"%s\"}".formatted(PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
        org.junit.jupiter.api.Assertions.assertNotNull(JsonPath.read(login(email), "$.accessToken"));
    }
}
