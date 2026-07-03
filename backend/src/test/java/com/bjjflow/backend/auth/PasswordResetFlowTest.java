package com.bjjflow.backend.auth;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.bjjflow.backend.email.EmailSender;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class PasswordResetFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EmailSender emailSender;

    private void register(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "Reset User",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email)))
                .andExpect(status().isOk());
    }

    @Test
    void forgotThenResetThenLoginWithNewPassword() throws Exception {
        String email = "reset@bjjflow.com";
        register(email);

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"" + email + "\"}"))
                .andExpect(status().isOk());

        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(emailSender).send(eq(email), anyString(), html.capture());
        Matcher m = Pattern.compile("(\\d{6})").matcher(html.getValue());
        org.junit.jupiter.api.Assertions.assertTrue(m.find(), "email should contain a 6-digit code");
        String code = m.group(1);

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\",\"newPassword\":\"nova-senha-456\"}"))
                .andExpect(status().isOk());

        // old password no longer works, new one does
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"senha-forte-123\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"nova-senha-456\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void wrongCodeIsRejected() throws Exception {
        String email = "reset2@bjjflow.com";
        register(email);
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"" + email + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"code\":\"000000\",\"newPassword\":\"nova-senha-456\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RESET_CODE"));
    }

    @Test
    void unknownEmailStillReturnsOk() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"nobody@bjjflow.com\"}"))
                .andExpect(status().isOk());
    }
}
