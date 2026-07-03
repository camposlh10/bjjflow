package com.bjjflow.backend.gyms;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest(properties = "app.admin-emails=admin@bjjflow.com")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class GymVerificationFlowTest {

    // 1x1 transparent PNG
    private static final byte[] PNG = java.util.Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");

    private static final String VALID_CNPJ = "11.222.333/0001-81";

    @Autowired
    private MockMvc mockMvc;

    private String register(String email, String belt) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 30, "beltSlug": "%s", "stripes": 0}
                        """.formatted(email, email.split("@")[0], belt)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    private String createGymOwner(String email) throws Exception {
        String token = register(email, "adult-black");
        mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Verif\"}"))
                .andExpect(status().isOk());
        return token;
    }

    private String upload(String token) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "doc.png", "image/png", PNG);
        String json = mockMvc.perform(multipart("/api/v1/gyms/posts/media").file(file)
                .header("Authorization", auth(token)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.key");
    }

    @Test
    void submitTriageThenAdminApprove() throws Exception {
        String owner = createGymOwner("verifdono@bjjflow.com");
        String certKey = upload(owner);
        String estKey = upload(owner);

        // invalid CNPJ rejected up front
        mockMvc.perform(post("/api/v1/gyms/me/verification")
                .header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"cnpj": "11111111111111", "certificateKey": "%s", "establishmentKeys": ["%s"]}
                        """.formatted(certKey, estKey)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CNPJ"));

        // valid submission -> stub verifier routes to manual review, gym not yet verified
        mockMvc.perform(post("/api/v1/gyms/me/verification")
                .header("Authorization", auth(owner))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"cnpj": "%s", "certificateKey": "%s", "establishmentKeys": ["%s"]}
                        """.formatted(VALID_CNPJ, certKey, estKey)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(false))
                .andExpect(jsonPath("$.verification.status").value("NEEDS_REVIEW"))
                .andExpect(jsonPath("$.verification.cnpj").value("11.222.333/0001-81"))
                .andExpect(jsonPath("$.verification.certificateUrl").value(org.hamcrest.Matchers.startsWith("/media/")));

        // a normal member cannot approve
        String member = register("verifmember@bjjflow.com", "adult-blue");
        long verId = ((Number) JsonPath.read(
                mockMvc.perform(get("/api/v1/admin/verifications").header("Authorization", auth(admin())))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.length()").value(1))
                        .andReturn().getResponse().getContentAsString(),
                "$[0].id")).longValue();

        mockMvc.perform(post("/api/v1/admin/verifications/" + verId + "/decision")
                .header("Authorization", auth(member))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"approve\": true}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_ADMIN"));

        // admin approves -> gym becomes verified
        mockMvc.perform(post("/api/v1/admin/verifications/" + verId + "/decision")
                .header("Authorization", auth(admin()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"approve\": true, \"notes\": \"Conferido\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        mockMvc.perform(get("/api/v1/gyms/me").header("Authorization", auth(owner)))
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.verification.status").value("APPROVED"));
    }

    private String adminToken;

    private String admin() throws Exception {
        if (adminToken == null) {
            adminToken = register("admin@bjjflow.com", "adult-black");
        }
        return adminToken;
    }
}
