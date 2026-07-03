package com.bjjflow.backend.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.bjjflow.backend.oauth.OAuthProvider;
import com.bjjflow.backend.oauth.OAuthUserInfo;
import com.bjjflow.backend.oauth.OAuthVerifier;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class OAuthFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OAuthVerifier oauthVerifier;

    private ResultActions oauth(String body) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/oauth")
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void newGoogleUserIsCreatedThenReusedOnSecondSignIn() throws Exception {
        when(oauthVerifier.verify(eq(OAuthProvider.GOOGLE), any()))
                .thenReturn(new OAuthUserInfo(OAuthProvider.GOOGLE, "google-sub-1", "newg@bjjflow.com", true, "New Google"));

        String first = oauth("{\"provider\":\"GOOGLE\",\"idToken\":\"tok\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value("newg@bjjflow.com"))
                .andExpect(jsonPath("$.user.username").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        int firstId = JsonPath.read(first, "$.user.id");

        String second = oauth("{\"provider\":\"GOOGLE\",\"idToken\":\"tok2\"}")
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        int secondId = JsonPath.read(second, "$.user.id");

        assertEquals(firstId, secondId, "same provider subject must map to the same account");
    }

    @Test
    void oauthLinksToExistingEmailAccount() throws Exception {
        String registered = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "link@bjjflow.com", "password": "senha-forte-123", "displayName": "Linked User",
                         "age": 28, "beltSlug": "adult-blue", "stripes": 1}
                        """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        int registeredId = JsonPath.read(registered, "$.user.id");

        when(oauthVerifier.verify(eq(OAuthProvider.APPLE), any()))
                .thenReturn(new OAuthUserInfo(OAuthProvider.APPLE, "apple-sub-1", "link@bjjflow.com", true, null));

        String viaApple = oauth("{\"provider\":\"APPLE\",\"idToken\":\"apl\"}")
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        int appleId = JsonPath.read(viaApple, "$.user.id");

        assertEquals(registeredId, appleId, "Apple login with a known email must link to that account");
    }
}
