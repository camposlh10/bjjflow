package com.bjjflow.backend;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

/** Paging, polling and the combined endpoints added to keep list screens fast. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FastListsFlowTest {

    @Autowired
    private MockMvc mockMvc;

    /** Returns {bearer header value, user id}. */
    private String[] register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0, "city": "Recife"}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] { "Bearer " + JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")) };
    }

    private long send(String auth, int convId, String content) throws Exception {
        String json = mockMvc.perform(post("/api/v1/conversations/" + convId + "/messages")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"%s\"}".formatted(content)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    private int startConversation(String auth, String otherUserId) throws Exception {
        String json = mockMvc.perform(post("/api/v1/conversations")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\": %s}".formatted(otherUserId)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.id");
    }

    @Test
    void messagesArePagedAndPollableByCursor() throws Exception {
        String[] a = register("page-a@bjjflow.com");
        String[] b = register("page-b@bjjflow.com");
        int conv = startConversation(a[0], b[1]);
        List<Long> ids = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            ids.add(send(a[0], conv, "m" + i));
        }
        String url = "/api/v1/conversations/" + conv + "/messages";

        // Latest page, in chronological order.
        mockMvc.perform(get(url).param("limit", "2").header("Authorization", b[0]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].content").value("m4"))
                .andExpect(jsonPath("$[1].content").value("m5"));

        // The page before it.
        mockMvc.perform(get(url).param("limit", "2").param("before", String.valueOf(ids.get(3)))
                .header("Authorization", b[0]))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].content").value("m2"))
                .andExpect(jsonPath("$[1].content").value("m3"));

        // Polling: nothing new, then exactly the new message.
        mockMvc.perform(get(url).param("after", String.valueOf(ids.get(4))).header("Authorization", b[0]))
                .andExpect(jsonPath("$", hasSize(0)));
        send(a[0], conv, "m6");
        mockMvc.perform(get(url).param("after", String.valueOf(ids.get(4))).header("Authorization", b[0]))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].content").value("m6"));

        // No parameters (older app builds): still a plain chronological array.
        mockMvc.perform(get(url).header("Authorization", b[0]))
                .andExpect(jsonPath("$", hasSize(6)))
                .andExpect(jsonPath("$[0].content").value("m1"));
    }

    @Test
    void inboxShowsLastMessageAndUnreadPerConversation() throws Exception {
        String[] me = register("inbox-me@bjjflow.com");
        String[] x = register("inbox-x@bjjflow.com");
        String[] y = register("inbox-y@bjjflow.com");
        String[] z = register("inbox-z@bjjflow.com");

        int withX = startConversation(x[0], me[1]);
        send(x[0], withX, "x1");
        send(x[0], withX, "x2");
        int withY = startConversation(me[0], y[1]);
        send(y[0], withY, "y1");
        send(me[0], withY, "my reply");
        // Opened but never used: must not appear.
        startConversation(me[0], z[1]);

        mockMvc.perform(get("/api/v1/conversations").header("Authorization", me[0]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                // Most recently active first.
                .andExpect(jsonPath("$[0].other.displayName").value("inbox-y"))
                .andExpect(jsonPath("$[0].lastMessage").value("my reply"))
                .andExpect(jsonPath("$[0].lastFromMe").value(true))
                .andExpect(jsonPath("$[0].unread").value(0))
                .andExpect(jsonPath("$[1].other.displayName").value("inbox-x"))
                .andExpect(jsonPath("$[1].lastMessage").value("x2"))
                .andExpect(jsonPath("$[1].lastFromMe").value(false))
                .andExpect(jsonPath("$[1].unread").value(2));

        // Reading X's thread clears only that conversation's unread count.
        mockMvc.perform(get("/api/v1/conversations/" + withX + "/messages").param("limit", "50")
                .header("Authorization", me[0])).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/conversations").header("Authorization", me[0]))
                .andExpect(jsonPath("$[1].unread").value(0));
    }

    private long createPost(String auth, String content) throws Exception {
        String json = mockMvc.perform(post("/api/v1/gyms/posts")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"%s\"}".formatted(content)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    private void createGym(String auth, String name) throws Exception {
        mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"%s\", \"city\": \"Recife\"}".formatted(name)))
                .andExpect(status().isOk());
    }

    @Test
    void gymWallIsCursorPagedWithPinnedPostsFirst() throws Exception {
        String[] owner = register("wall-owner@bjjflow.com");
        createGym(owner[0], "Academia Paginada");
        long p1 = createPost(owner[0], "p1");
        createPost(owner[0], "p2");
        createPost(owner[0], "p3");
        createPost(owner[0], "p4");
        mockMvc.perform(put("/api/v1/gyms/posts/" + p1 + "/pin")
                .header("Authorization", owner[0])
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"pinned\": true}"))
                .andExpect(status().isOk());

        // Page 1: the pinned post, then the two newest.
        String page1 = mockMvc.perform(get("/api/v1/gyms/posts").param("limit", "2")
                .header("Authorization", owner[0]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].content").value("p1"))
                .andExpect(jsonPath("$.items[0].pinned").value(true))
                .andExpect(jsonPath("$.items[0].author.role").value("OWNER"))
                .andExpect(jsonPath("$.items[1].content").value("p4"))
                .andExpect(jsonPath("$.items[2].content").value("p3"))
                .andReturn().getResponse().getContentAsString();
        Number cursor = JsonPath.read(page1, "$.nextCursor");

        // Page 2: the rest, pinned post not repeated, and the end is signalled.
        mockMvc.perform(get("/api/v1/gyms/posts").param("limit", "2").param("cursor", cursor.toString())
                .header("Authorization", owner[0]))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].content").value("p2"))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));

        // No limit (older app builds): the plain array, pinned first.
        mockMvc.perform(get("/api/v1/gyms/posts").header("Authorization", owner[0]))
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].content").value("p1"))
                .andExpect(jsonPath("$[1].content").value("p4"));
    }

    @Test
    void gymSuggestionsPreferTheUsersCityAndCarryMemberCounts() throws Exception {
        String[] owner = register("sugg-owner@bjjflow.com");
        createGym(owner[0], "Academia Sugerida");
        String[] newcomer = register("sugg-new@bjjflow.com");

        mockMvc.perform(get("/api/v1/gyms/suggestions").header("Authorization", newcomer[0]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Academia Sugerida')].memberCount").value(1))
                .andExpect(jsonPath("$[?(@.name == 'Academia Sugerida')].city").value("Recife"));

        // Already in a gym: no suggestions.
        mockMvc.perform(get("/api/v1/gyms/suggestions").header("Authorization", owner[0]))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void homeReturnsEveryPartOfTheHomeScreenAtOnce() throws Exception {
        String[] user = register("home@bjjflow.com");

        mockMvc.perform(get("/api/v1/home").header("Authorization", user[0]))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats").exists())
                .andExpect(jsonPath("$.gym").value(nullValue()))
                .andExpect(jsonPath("$.journey.timeline").isArray())
                .andExpect(jsonPath("$.notifications.unread").value(0))
                .andExpect(jsonPath("$.profile.displayName").value("home"));

        createGym(user[0], "Academia Home");
        mockMvc.perform(get("/api/v1/home").header("Authorization", user[0]))
                .andExpect(jsonPath("$.gym.name").value("Academia Home"));

        mockMvc.perform(get("/api/v1/home")).andExpect(status().isUnauthorized());
    }

    @Test
    void beltCatalogueIsCacheable() throws Exception {
        mockMvc.perform(get("/api/v1/belt-systems/ranks"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("max-age=3600")))
                .andExpect(jsonPath("$[0].slug").exists());
    }
}
