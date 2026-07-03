package com.bjjflow.backend.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

/** With app.dev-tools=false (production), the TEMP backdoors must be hidden (404), even
 *  for an authenticated user — so no one can self-grant PRO / owner / verified-gym. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "app.dev-tools=false")
@org.springframework.transaction.annotation.Transactional
class DevToolsGatingTest {

    @Autowired
    private MockMvc mockMvc;

    private String auth() throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "gating@bjjflow.com", "password": "senha-forte-123", "displayName": "Gate",
                         "age": 25, "beltSlug": "adult-blue", "stripes": 0}
                        """))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + JsonPath.read(json, "$.accessToken");
    }

    @Test
    void backdoorsHiddenInProduction() throws Exception {
        String a = auth();
        mockMvc.perform(post("/api/v1/users/me/pro").header("Authorization", a))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/gyms/me/role").header("Authorization", a)
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\": \"OWNER\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/gyms/me/verify").header("Authorization", a))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/dev/bot").header("Authorization", a))
                .andExpect(status().isNotFound());
    }
}
