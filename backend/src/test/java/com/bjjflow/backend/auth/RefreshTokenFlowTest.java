package com.bjjflow.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RefreshTokenFlowTest {

    private static final String EMAIL = "sessions@bjjflow.com";
    private static final String PASSWORD = "senha-forte-123";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    /** Registers the user and returns {accessToken, refreshToken}. */
    private String[] register() throws Exception {
        String body = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "%s", "displayName": "Sessions Test",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(EMAIL, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new String[] { JsonPath.read(body, "$.accessToken"), JsonPath.read(body, "$.refreshToken") };
    }

    private String login() throws Exception {
        String body = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "%s"}
                        """.formatted(EMAIL, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.refreshToken");
    }

    private ResultActions refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"refreshToken": "%s"}
                        """.formatted(refreshToken)));
    }

    private String refreshOk(String refreshToken) throws Exception {
        String body = refresh(refreshToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(EMAIL))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.refreshToken");
    }

    /** Pretends the given token was rotated long ago (outside the retry grace window). */
    private void ageRotation(String rawToken) {
        entityManager.flush();
        entityManager.clear();
        RefreshToken token = refreshTokenRepository.findByTokenHash(RefreshTokenService.hash(rawToken)).orElseThrow();
        token.setRotatedAt(Instant.now().minus(10, ChronoUnit.MINUTES));
        refreshTokenRepository.saveAndFlush(token);
    }

    @Test
    void refreshTokensAreOpaqueAndStoredHashed() throws Exception {
        String refreshToken = register()[1];

        // Not a JWT, and the raw value is not what sits in the database.
        assertThat(refreshToken).doesNotContain(".");
        assertThat(refreshTokenRepository.findByTokenHash(refreshToken)).isEmpty();
        assertThat(refreshTokenRepository.findByTokenHash(RefreshTokenService.hash(refreshToken))).isPresent();
    }

    @Test
    void refreshRotatesTheToken() throws Exception {
        String first = register()[1];
        String second = refreshOk(first);
        assertThat(second).isNotEqualTo(first);
        // The new token keeps working.
        refreshOk(second);
    }

    @Test
    void immediateRetryOfARotatedTokenIsTolerated() throws Exception {
        String first = register()[1];
        refreshOk(first);
        // A flaky connection lost the response: the app retries the same token.
        String retried = refreshOk(first);
        refreshOk(retried);
    }

    @Test
    void reusingAnOldRotatedTokenRevokesTheWholeSession() throws Exception {
        String first = register()[1];
        String second = refreshOk(first);
        ageRotation(first);

        // A stolen copy of the old token shows up later.
        refresh(first)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
        // ...which also ends the legitimate holder's session.
        refresh(second).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesOnlyThatSession() throws Exception {
        String phone = register()[1];
        String tablet = login();

        mockMvc.perform(post("/api/v1/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"refreshToken": "%s"}
                        """.formatted(phone)))
                .andExpect(status().isOk());

        refresh(phone).andExpect(status().isUnauthorized());
        refreshOk(tablet);
    }

    @Test
    void unknownTokenIsRejected() throws Exception {
        refresh("not-a-real-token").andExpect(status().isUnauthorized());
    }

    @Test
    void changingPasswordSignsOutOtherDevicesButKeepsTheCaller() throws Exception {
        String[] phone = register();
        String tablet = login();

        mockMvc.perform(put("/api/v1/users/me/password")
                .header("Authorization", "Bearer " + phone[0])
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"currentPassword": "%s", "newPassword": "outra-senha-456", "refreshToken": "%s"}
                        """.formatted(PASSWORD, phone[1])))
                .andExpect(status().is2xxSuccessful());

        refresh(tablet).andExpect(status().isUnauthorized());
        refreshOk(phone[1]);
    }

    @Test
    void legacyJwtRefreshTokenIsExchangedForAnOpaqueOne() throws Exception {
        register();
        User user = userRepository.findByEmail(EMAIL).orElseThrow();
        String legacy = jwtService.createRefreshToken(user.getId());

        String next = refreshOk(legacy);
        assertThat(next).doesNotContain(".");
        refreshOk(next);
    }

    @Test
    void legacyJwtIssuedBeforeAPasswordChangeIsRefused() throws Exception {
        register();
        User user = userRepository.findByEmail(EMAIL).orElseThrow();
        String legacy = jwtService.createRefreshToken(user.getId());

        user.setCredentialsChangedAt(Instant.now().plus(1, ChronoUnit.MINUTES));
        userRepository.saveAndFlush(user);

        refresh(legacy).andExpect(status().isUnauthorized());
    }
}
