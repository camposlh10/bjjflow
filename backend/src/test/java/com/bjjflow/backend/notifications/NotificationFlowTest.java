package com.bjjflow.backend.notifications;

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
class NotificationFlowTest {

    @Autowired
    private MockMvc mockMvc;

    /** Returns [accessToken, userId]. */
    private String[] register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0, "weightKg": 80.0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] { JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")) };
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    private int startConversationAndMessage(String fromTok, long toUserId, String text) throws Exception {
        String conv = mockMvc.perform(post("/api/v1/conversations").header("Authorization", auth(fromTok))
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\": " + toUserId + "}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        int convId = JsonPath.read(conv, "$.id");
        mockMvc.perform(post("/api/v1/conversations/" + convId + "/messages").header("Authorization", auth(fromTok))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\": \"" + text + "\"}"))
                .andExpect(status().isOk());
        return convId;
    }

    @Test
    void messageCreatesNotificationReadAndTokens() throws Exception {
        String[] a = register("notif-a@bjjflow.com");
        String[] b = register("notif-b@bjjflow.com");

        startConversationAndMessage(a[0], Long.parseLong(b[1]), "Bora treinar?");

        // B has an unread MESSAGE notification, titled with A's name
        String list = mockMvc.perform(get("/api/v1/users/me/notifications").header("Authorization", auth(b[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(1))
                .andExpect(jsonPath("$.items[0].type").value("MESSAGE"))
                .andExpect(jsonPath("$.items[0].title").value("notif-a"))
                .andExpect(jsonPath("$.items[0].payload").value(org.hamcrest.Matchers.startsWith("conversation:")))
                .andReturn().getResponse().getContentAsString();
        int nId = JsonPath.read(list, "$.items[0].id");

        mockMvc.perform(post("/api/v1/users/me/notifications/" + nId + "/read").header("Authorization", auth(b[0])))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/users/me/notifications").header("Authorization", auth(b[0])))
                .andExpect(jsonPath("$.unread").value(0));

        // Push token register + remove
        mockMvc.perform(post("/api/v1/users/me/push-tokens").header("Authorization", auth(b[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\": \"ExponentPushToken[abc123]\", \"platform\": \"ios\"}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/users/me/push-tokens/remove").header("Authorization", auth(b[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\": \"ExponentPushToken[abc123]\"}"))
                .andExpect(status().isNoContent());
    }

    @Test
    void respectsNotifyMessagesPreference() throws Exception {
        String[] a = register("notif-c@bjjflow.com");
        String[] b = register("notif-d@bjjflow.com");

        // B turns off message notifications
        mockMvc.perform(put("/api/v1/users/me/settings").header("Authorization", auth(b[0]))
                .contentType(MediaType.APPLICATION_JSON).content("{\"notifyMessages\": false}"))
                .andExpect(status().isOk());

        startConversationAndMessage(a[0], Long.parseLong(b[1]), "Oi");

        mockMvc.perform(get("/api/v1/users/me/notifications").header("Authorization", auth(b[0])))
                .andExpect(jsonPath("$.unread").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void socialTriggersAndInsights() throws Exception {
        String[] a = register("notif-soc-a@bjjflow.com");
        String[] b = register("notif-soc-b@bjjflow.com");
        long aId = Long.parseLong(a[1]);
        String today = java.time.LocalDate.now().toString();

        // B follows A -> A gets a SOCIAL notification
        mockMvc.perform(post("/api/v1/users/" + aId + "/follow").header("Authorization", auth(b[0])))
                .andExpect(status().isOk());

        // A logs a PUBLIC training with a landed submission
        mockMvc.perform(post("/api/v1/checkins").header("Authorization", auth(a[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"" + today + "\", \"durationMinutes\": 60, \"visibility\": \"PUBLIC\","
                        + " \"submissions\": [{\"submission\": \"ARMBAR\", \"direction\": \"HIT\", \"count\": 3}]}"))
                .andExpect(status().isOk());

        // B likes + comments on it -> A gets SOCIAL notifications
        String feed = mockMvc.perform(get("/api/v1/feed").header("Authorization", auth(b[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        int ciId = JsonPath.read(feed, "$.items[0].checkInId");
        mockMvc.perform(post("/api/v1/feed/" + ciId + "/like").header("Authorization", auth(b[0])))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/feed/" + ciId + "/comments").header("Authorization", auth(b[0]))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\": \"boa!\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/me/notifications").header("Authorization", auth(a[0])))
                .andExpect(jsonPath("$.items[?(@.type == 'SOCIAL')]")
                        .value(org.hamcrest.Matchers.hasSize(org.hamcrest.Matchers.greaterThanOrEqualTo(3))));

        // Insights refresh creates a PERFORMANCE notification from the landed submission
        mockMvc.perform(post("/api/v1/users/me/insights/refresh").header("Authorization", auth(a[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.type == 'PERFORMANCE')]")
                        .value(org.hamcrest.Matchers.hasSize(org.hamcrest.Matchers.greaterThan(0))));
    }
}
