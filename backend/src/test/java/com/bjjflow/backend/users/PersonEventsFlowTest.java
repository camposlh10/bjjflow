package com.bjjflow.backend.users;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import com.bjjflow.backend.realtime.RealtimeHub;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PersonEventsFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoSpyBean
    private RealtimeHub realtimeHub;

    private record Member(String token, long id) {
        String bearer() {
            return "Bearer " + token;
        }
    }

    private Member register(String email) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "Foto Teste",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email)))
                .andExpect(status().isOk()).andReturn();
        String json = result.getResponse().getContentAsString();
        return new Member(JsonPath.read(json, "$.accessToken"), ((Number) JsonPath.read(json, "$.user.id")).longValue());
    }

    private static boolean personEvent(Object event, long userId, String avatarPart) {
        if (!(event instanceof Map<?, ?> map)) {
            return false;
        }
        Object avatar = map.get("avatarUrl");
        return "person".equals(map.get("type")) && Long.valueOf(userId).equals(map.get("userId"))
                && avatar != null && avatar.toString().contains(avatarPart);
    }

    @Test
    void aNewProfilePictureReachesTheMemberAndTheirFollowersLive() throws Exception {
        Member ana = register("picture-ana@bjjflow.com");
        Member beto = register("picture-beto@bjjflow.com");
        Member stranger = register("picture-stranger@bjjflow.com");
        mockMvc.perform(post("/api/v1/users/" + ana.id() + "/follow").header("Authorization", beto.bearer()))
                .andExpect(status().is2xxSuccessful());

        mockMvc.perform(put("/api/v1/users/me/profile").header("Authorization", ana.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"avatarKey\": \"avatars/ana-new.jpg\"}"))
                .andExpect(status().isOk());

        // Her other devices and her followers get the new picture; strangers don't.
        verify(realtimeHub, atLeastOnce()).publishAfterCommit(eq(ana.id()),
                argThat(e -> personEvent(e, ana.id(), "ana-new.jpg")));
        verify(realtimeHub, atLeastOnce()).publishAfterCommit(eq(beto.id()),
                argThat(e -> personEvent(e, ana.id(), "ana-new.jpg")));
        verify(realtimeHub, never()).publishAfterCommit(eq(stranger.id()),
                argThat(e -> personEvent(e, ana.id(), "ana-new.jpg")));
    }
}
