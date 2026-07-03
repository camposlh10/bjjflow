package com.bjjflow.backend.users;

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
class UserSearchTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 25, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void searchesByNameAndHandleWithMinLength() throws Exception {
        String me = register("joaosilva@bjjflow.com");
        register("mariasouza@bjjflow.com");

        mockMvc.perform(get("/api/v1/users/search").param("q", "joao").header("Authorization", auth(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.username == 'joaosilva')]")
                        .value(org.hamcrest.Matchers.hasSize(1)));

        mockMvc.perform(get("/api/v1/users/search").param("q", "souza").header("Authorization", auth(me)))
                .andExpect(jsonPath("$[?(@.username == 'mariasouza')]")
                        .value(org.hamcrest.Matchers.hasSize(1)));

        // under two characters returns nothing
        mockMvc.perform(get("/api/v1/users/search").param("q", "j").header("Authorization", auth(me)))
                .andExpect(jsonPath("$.length()").value(0));

        // no match
        mockMvc.perform(get("/api/v1/users/search").param("q", "zzzzz").header("Authorization", auth(me)))
                .andExpect(jsonPath("$.length()").value(0));
    }
}
