package com.bjjflow.backend.gyms;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
class GymRulesFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 27, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void instructorsOnlyPostingAndEditableTarget() throws Exception {
        String owner = register("rules-owner@bjjflow.com");
        String code = JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Regras\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteCode");

        String member = register("rules-member@bjjflow.com");
        mockMvc.perform(post("/api/v1/gyms/join").header("Authorization", auth(member))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(code)))
                .andExpect(status().isOk());

        // before the rule, a member can post
        mockMvc.perform(post("/api/v1/gyms/posts").header("Authorization", auth(member))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"Oi galera\"}"))
                .andExpect(status().isOk());

        // owner turns on instructors-only + sets target
        mockMvc.perform(put("/api/v1/gyms/me/rules").header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"graduationTarget\": 20, \"instructorsOnlyPosts\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.graduationTarget").value(20))
                .andExpect(jsonPath("$.instructorsOnlyPosts").value(true));

        // now the member is blocked
        mockMvc.perform(post("/api/v1/gyms/posts").header("Authorization", auth(member))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"posso postar?\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INSTRUCTORS_ONLY"));

        // the owner still can
        mockMvc.perform(post("/api/v1/gyms/posts").header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"aviso do professor\"}"))
                .andExpect(status().isOk());

        // a plain member cannot change the rules
        mockMvc.perform(put("/api/v1/gyms/me/rules").header("Authorization", auth(member))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"instructorsOnlyPosts\": false}"))
                .andExpect(status().isForbidden());
    }
}
