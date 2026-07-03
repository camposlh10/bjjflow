package com.bjjflow.backend.feed;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

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
class CommunityFeedFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void publicCheckInAppearsOnFeedPrivateDoesNot() throws Exception {
        String today = LocalDate.now().toString();
        String sharer = register("feedshare@bjjflow.com");
        String lurker = register("feedlurk@bjjflow.com");

        // PUBLIC detailed check-in with submissions
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(sharer))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "sessionType": "NOGI", "durationMinutes": 90,
                         "visibility": "PUBLIC",
                         "submissions": [
                           {"submission": "ARMBAR", "direction": "HIT", "count": 2},
                           {"submission": "TRIANGLE", "direction": "CONCEDED", "count": 1}
                         ]}
                        """.formatted(today)))
                .andExpect(status().isOk());

        // PRIVATE check-in from the lurker — must not surface
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(lurker))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 60, \"visibility\": \"PRIVATE\"}".formatted(today)))
                .andExpect(status().isOk());

        // Feed shows exactly the public session, Strava-style fields populated
        mockMvc.perform(get("/api/v1/feed").header("Authorization", auth(lurker)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].sessionType").value("NOGI"))
                .andExpect(jsonPath("$.items[0].durationMinutes").value(90))
                .andExpect(jsonPath("$.items[0].landed").value(2))
                .andExpect(jsonPath("$.items[0].conceded").value(1))
                .andExpect(jsonPath("$.items[0].author.displayName").value("feedshare"))
                .andExpect(jsonPath("$.items[0].author.belt.slug").value("adult-blue"));
    }

    @Test
    void likeCommentShareOnPublicSession() throws Exception {
        String today = LocalDate.now().toString();
        String sharer = register("feedsocial-a@bjjflow.com");
        String viewer = register("feedsocial-b@bjjflow.com");

        String created = mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(sharer))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 60, \"visibility\": \"PUBLIC\"}".formatted(today)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        int checkInId = JsonPath.read(created, "$.id");

        // like
        mockMvc.perform(post("/api/v1/feed/" + checkInId + "/like").header("Authorization", auth(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.liked").value(true))
                .andExpect(jsonPath("$.likeCount").value(1));

        // comment
        mockMvc.perform(post("/api/v1/feed/" + checkInId + "/comments")
                .header("Authorization", auth(viewer))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"Boa, parabéns!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.author.displayName").value("feedsocial-b"))
                .andExpect(jsonPath("$.content").value("Boa, parabéns!"));

        mockMvc.perform(get("/api/v1/feed/" + checkInId + "/comments").header("Authorization", auth(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // share
        mockMvc.perform(post("/api/v1/feed/" + checkInId + "/share").header("Authorization", auth(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareCount").value(1));

        // feed reflects counts + likedByMe for the viewer
        mockMvc.perform(get("/api/v1/feed").header("Authorization", auth(viewer)))
                .andExpect(jsonPath("$.items[0].likeCount").value(1))
                .andExpect(jsonPath("$.items[0].commentCount").value(1))
                .andExpect(jsonPath("$.items[0].shareCount").value(1))
                .andExpect(jsonPath("$.items[0].likedByMe").value(true));

        // unliking returns to zero
        mockMvc.perform(post("/api/v1/feed/" + checkInId + "/like").header("Authorization", auth(viewer)))
                .andExpect(jsonPath("$.liked").value(false))
                .andExpect(jsonPath("$.likeCount").value(0));
    }

    @Test
    void cannotLikeAPrivateSession() throws Exception {
        String today = LocalDate.now().toString();
        String u = register("feedpriv@bjjflow.com");
        String created = mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(u))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 60, \"visibility\": \"PRIVATE\"}".formatted(today)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        int checkInId = JsonPath.read(created, "$.id");

        mockMvc.perform(post("/api/v1/feed/" + checkInId + "/like").header("Authorization", auth(u)))
                .andExpect(status().isNotFound());
    }

    @Test
    void quickCheckInDefaultsToPrivate() throws Exception {
        String today = LocalDate.now().toString();
        String u = register("feedquick@bjjflow.com");

        // No visibility field => PRIVATE => not on the feed
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(u))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 60}".formatted(today)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/feed").header("Authorization", auth(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void feedPaginatesWithCursor() throws Exception {
        String today = LocalDate.now().toString();
        String u = register("feedpage@bjjflow.com");
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/v1/checkins")
                    .header("Authorization", auth(u))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"date\": \"%s\", \"durationMinutes\": 60, \"visibility\": \"PUBLIC\"}".formatted(today)))
                    .andExpect(status().isOk());
        }

        // Page 1: 2 of 3, with a cursor to continue.
        String page1 = mockMvc.perform(get("/api/v1/feed?limit=2").header("Authorization", auth(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.nextCursor").isNumber())
                .andReturn().getResponse().getContentAsString();
        long cursor = ((Number) JsonPath.read(page1, "$.nextCursor")).longValue();

        // Page 2: the remaining 1, no further cursor.
        mockMvc.perform(get("/api/v1/feed?limit=2&cursor=" + cursor).header("Authorization", auth(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.nextCursor").isEmpty());
    }
}
