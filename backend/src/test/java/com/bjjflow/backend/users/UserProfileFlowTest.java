package com.bjjflow.backend.users;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class UserProfileFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String[] register(String email, String belt) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 27, "beltSlug": "%s", "stripes": 0}
                        """.formatted(email, email.split("@")[0], belt)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] {
                JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")),
        };
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void followAndProfile() throws Exception {
        String[] a = register("profA@bjjflow.com", "adult-blue");
        String[] b = register("profB@bjjflow.com", "adult-purple");
        String aTok = a[0];
        String bId = b[1];

        // register/login now expose the pro flag
        // A views B: not following yet, belt present, isMe false
        mockMvc.perform(get("/api/v1/users/" + bId + "/profile").header("Authorization", auth(aTok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFollowing").value(false))
                .andExpect(jsonPath("$.isMe").value(false))
                .andExpect(jsonPath("$.belt.slug").value("adult-purple"))
                .andExpect(jsonPath("$.followers").value(0));

        // A follows B
        mockMvc.perform(post("/api/v1/users/" + bId + "/follow").header("Authorization", auth(aTok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFollowing").value(true))
                .andExpect(jsonPath("$.followers").value(1));

        // following is idempotent
        mockMvc.perform(post("/api/v1/users/" + bId + "/follow").header("Authorization", auth(aTok)))
                .andExpect(jsonPath("$.followers").value(1));

        // unfollow
        mockMvc.perform(delete("/api/v1/users/" + bId + "/follow").header("Authorization", auth(aTok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFollowing").value(false))
                .andExpect(jsonPath("$.followers").value(0));

        // cannot follow self
        mockMvc.perform(post("/api/v1/users/" + a[1] + "/follow").header("Authorization", auth(aTok)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_FOLLOW_SELF"));
    }

    @Test
    void editOwnProfileMedalsAndPro() throws Exception {
        String[] me = register("profedit@bjjflow.com", "adult-brown");
        String tok = me[0];
        String myId = me[1];

        mockMvc.perform(put("/api/v1/users/me/profile")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"bio\": \"Faixa marrom, treino todo dia\", \"accentColor\": \"#2563EB\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bio").value("Faixa marrom, treino todo dia"))
                .andExpect(jsonPath("$.accentColor").value("#2563EB"))
                .andExpect(jsonPath("$.isMe").value(true));

        // post a profile photo, then remove it
        byte[] png = java.util.Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
        String key = JsonPath.read(mockMvc.perform(multipart("/api/v1/media")
                .file(new MockMultipartFile("file", "p.png", "image/png", png))
                .header("Authorization", auth(tok)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.key");
        String afterAdd = mockMvc.perform(post("/api/v1/users/me/photos")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"key\": \"%s\"}".formatted(key)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photos.length()").value(1))
                .andReturn().getResponse().getContentAsString();
        long photoId = ((Number) JsonPath.read(afterAdd, "$.photos[0].id")).longValue();
        mockMvc.perform(delete("/api/v1/users/me/photos/" + photoId).header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photos.length()").value(0));

        mockMvc.perform(put("/api/v1/users/me/medals")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"medals": [{"competition": "IBJJF", "tier": "GOLD", "count": 2}]}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.medals.length()").value(1))
                .andExpect(jsonPath("$.medals[0].competition").value("IBJJF"))
                .andExpect(jsonPath("$.medals[0].count").value(2));

        // bad tier rejected
        mockMvc.perform(put("/api/v1/users/me/medals")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"medals\": [{\"competition\": \"X\", \"tier\": \"PLATINUM\", \"count\": 1}]}"))
                .andExpect(status().isBadRequest());

        // PRO toggle
        mockMvc.perform(post("/api/v1/users/me/pro").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pro").value(true));

        // metrics + journey after a check-in
        mockMvc.perform(post("/api/v1/checkins")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"durationMinutes\": 60}".formatted(LocalDate.now())))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/" + myId + "/profile").header("Authorization", auth(tok)))
                .andExpect(jsonPath("$.metrics.trainings").value(1))
                .andExpect(jsonPath("$.metrics.currentStreak").value(1))
                .andExpect(jsonPath("$.pro").value(true));

        mockMvc.perform(get("/api/v1/users/" + myId + "/journey").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeline[?(@.type == 'FIRST_TRAINING')]").exists());
    }
}
