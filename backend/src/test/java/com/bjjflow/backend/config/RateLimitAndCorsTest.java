package com.bjjflow.backend.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = { "app.rate-limit.enabled=true", "app.rate-limit.auth-per-minute=5" })
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RateLimitAndCorsTest {

    @Autowired
    private MockMvc mockMvc;

    private static final String BAD_LOGIN = """
            {"email": "nobody@bjjflow.com", "password": "wrong-password"}
            """;

    @Test
    void authEndpointsAreCappedPerClientAddress() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/auth/login")
                    .with(request -> {
                        request.setRemoteAddr("203.0.113.7");
                        return request;
                    })
                    .contentType(MediaType.APPLICATION_JSON).content(BAD_LOGIN))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/v1/auth/login")
                .with(request -> {
                    request.setRemoteAddr("203.0.113.7");
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON).content(BAD_LOGIN))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        // A different client is unaffected.
        mockMvc.perform(post("/api/v1/auth/login")
                .with(request -> {
                    request.setRemoteAddr("203.0.113.8");
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON).content(BAD_LOGIN))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void nonAuthEndpointsAreNotRateLimited() throws Exception {
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get("/api/v1/health")).andExpect(status().isOk());
        }
    }

    @Test
    void corsAllowsOnlyConfiguredOrigins() throws Exception {
        mockMvc.perform(options("/api/v1/health")
                .header("Origin", "https://crm.test")
                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://crm.test"));

        mockMvc.perform(options("/api/v1/health")
                .header("Origin", "https://evil.example")
                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    void healthProbesArePublic() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness")).andExpect(status().isOk());
        mockMvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
        // Nothing else from the actuator is exposed.
        mockMvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }
}
