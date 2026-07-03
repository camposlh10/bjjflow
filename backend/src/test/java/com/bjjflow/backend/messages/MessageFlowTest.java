package com.bjjflow.backend.messages;

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
class MessageFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String[] register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] { JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")) };
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void startSendInboxUnreadAndReadFlow() throws Exception {
        String[] a = register("dm-a@bjjflow.com");
        String[] b = register("dm-b@bjjflow.com");

        // A opens a conversation with B
        String convJson = mockMvc.perform(post("/api/v1/conversations")
                .header("Authorization", auth(a[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\": %s}".formatted(b[1])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.other.displayName").value("dm-b"))
                .andReturn().getResponse().getContentAsString();
        int convId = JsonPath.read(convJson, "$.id");

        // A sends a message
        mockMvc.perform(post("/api/v1/conversations/" + convId + "/messages")
                .header("Authorization", auth(a[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"Oss, bora treinar?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fromMe").value(true))
                .andExpect(jsonPath("$.content").value("Oss, bora treinar?"));

        // B's inbox: one conversation, unread 1, last message from A (not me)
        mockMvc.perform(get("/api/v1/conversations").header("Authorization", auth(b[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].unread").value(1))
                .andExpect(jsonPath("$[0].lastFromMe").value(false))
                .andExpect(jsonPath("$[0].other.displayName").value("dm-a"));

        // B opens the thread (marks read) and sees the message
        mockMvc.perform(get("/api/v1/conversations/" + convId + "/messages").header("Authorization", auth(b[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fromMe").value(false));

        // now B's inbox unread back to 0
        mockMvc.perform(get("/api/v1/conversations").header("Authorization", auth(b[0])))
                .andExpect(jsonPath("$[0].unread").value(0));

        // opening again from A is the same conversation (get-or-create)
        mockMvc.perform(post("/api/v1/conversations")
                .header("Authorization", auth(a[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\": %s}".formatted(b[1])))
                .andExpect(jsonPath("$.id").value(convId));
    }

    @Test
    void cannotMessageYourself() throws Exception {
        String[] a = register("dm-self@bjjflow.com");
        mockMvc.perform(post("/api/v1/conversations")
                .header("Authorization", auth(a[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\": %s}".formatted(a[1])))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RECIPIENT"));
    }
}
