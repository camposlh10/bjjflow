package com.bjjflow.backend.dev;

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
class DevBotFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 30, "beltSlug": "adult-black", "stripes": 0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void spawnBotSeedsGymFeedAndAutoRepliesInDms() throws Exception {
        String owner = register("bot-owner@bjjflow.com");
        mockMvc.perform(post("/api/v1/gyms").header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Academia Bot\"}"))
                .andExpect(status().isOk());

        // spawn the bot into the gym
        String botJson = mockMvc.perform(post("/api/v1/dev/bot").header("Authorization", auth(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("BJJ Bot"))
                .andReturn().getResponse().getContentAsString();
        int botId = JsonPath.read(botJson, "$.userId");

        // bot is now a member of the gym
        mockMvc.perform(get("/api/v1/gyms/me/members").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$[?(@.userId == %s)].displayName".formatted(botId))
                        .value(org.hamcrest.Matchers.contains("BJJ Bot")));

        // bot's public trainings show on the global feed
        mockMvc.perform(get("/api/v1/feed").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.items[?(@.author.id == %s)]".formatted(botId))
                        .value(org.hamcrest.Matchers.hasSize(org.hamcrest.Matchers.greaterThanOrEqualTo(1))));

        // the instructor sees seeded class attendance for the bot
        mockMvc.perform(get("/api/v1/gyms/me/students/" + botId).header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.attendance.totalClasses")
                        .value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.recentAttendance.length()")
                        .value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

        // DM the bot -> it auto-replies (thread has my message + the bot's)
        String convJson = mockMvc.perform(post("/api/v1/conversations").header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\": %s}".formatted(botId)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        int convId = JsonPath.read(convJson, "$.id");

        mockMvc.perform(post("/api/v1/conversations/" + convId + "/messages").header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\": \"Oi bot!\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/conversations/" + convId + "/messages").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].fromMe").value(false));
    }
}
