package com.bjjflow.backend.auth;

import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class AuthFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private static final String EMAIL = "teste@bjjflow.com";

    private String registerBody() {
        return """
                {
                  "email": "%s",
                  "password": "senha-forte-123",
                  "displayName": "Teste da Silva",
                  "age": 28,
                  "beltSlug": "adult-blue",
                  "stripes": 2,
                  "weightKg": 80.5,
                  "heightCm": 178
                }
                """.formatted(EMAIL);
    }

    @Test
    void fullAuthFlow() throws Exception {
        // register
        var registerResult = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andExpect(jsonPath("$.refreshToken", notNullValue()))
                .andExpect(jsonPath("$.user.email").value(EMAIL))
                .andExpect(jsonPath("$.user.belt.slug").value("adult-blue"))
                .andExpect(jsonPath("$.user.belt.namePt").value("Azul"))
                .andReturn();

        String registerRefreshToken = JsonPath.read(registerResult.getResponse().getContentAsString(),
                "$.refreshToken");

        // duplicate email rejected
        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_USED"));

        // login
        var loginResult = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123"}
                        """.formatted(EMAIL)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()))
                .andReturn();

        String accessToken = JsonPath.read(loginResult.getResponse().getContentAsString(), "$.accessToken");

        // wrong password rejected
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-errada"}
                        """.formatted(EMAIL)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        // /users/me with token
        mockMvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.displayName").value("Teste da Silva"))
                .andExpect(jsonPath("$.belt.stripes").value(2));

        // /users/me without token
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());

        // refresh
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"refreshToken": "%s"}
                        """.formatted(registerRefreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", notNullValue()));

        // belt catalog is public
        mockMvc.perform(get("/api/v1/belt-systems/ranks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("adult-white"));
    }
}
