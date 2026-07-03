package com.bjjflow.backend.auth;

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
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class SignupBasicInfoTest {

    @Autowired
    private MockMvc mockMvc;

    private ResultActions register(String body) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void registerStoresBasicInfoAndShowsItOnProfile() throws Exception {
        String json = register("""
                {"email": "basic@bjjflow.com", "password": "senha-forte-123", "displayName": "João Silva",
                 "firstName": "João", "lastName": "Silva", "username": "joaosilva", "gender": "MALE",
                 "city": "São Paulo", "favoriteArt": "BJJ", "trainingStartYear": 2018,
                 "age": 29, "beltSlug": "adult-blue", "stripes": 2}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("joaosilva"))
                .andExpect(jsonPath("$.user.displayName").value("João Silva"))
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(json, "$.accessToken");
        int id = JsonPath.read(json, "$.user.id");

        mockMvc.perform(get("/api/v1/users/" + id + "/profile").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("joaosilva"))
                .andExpect(jsonPath("$.displayName").value("João Silva"))
                .andExpect(jsonPath("$.firstName").value("João"))
                .andExpect(jsonPath("$.lastName").value("Silva"))
                .andExpect(jsonPath("$.gender").value("MALE"))
                .andExpect(jsonPath("$.city").value("São Paulo"))
                .andExpect(jsonPath("$.favoriteArt").value("BJJ"))
                .andExpect(jsonPath("$.trainingStartYear").value(2018))
                .andExpect(jsonPath("$.age").value(29));
    }

    @Test
    void duplicateUsernameAtSignupIsRejected() throws Exception {
        register("""
                {"email": "uname-a@bjjflow.com", "password": "senha-forte-123", "displayName": "User A",
                 "username": "takenhandle", "age": 25, "beltSlug": "adult-blue", "stripes": 0}
                """).andExpect(status().isOk());

        register("""
                {"email": "uname-b@bjjflow.com", "password": "senha-forte-123", "displayName": "User B",
                 "username": "TakenHandle", "age": 25, "beltSlug": "adult-blue", "stripes": 0}
                """)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @Test
    void noUsernameStillAutoGenerates() throws Exception {
        register("""
                {"email": "auto@bjjflow.com", "password": "senha-forte-123", "displayName": "Auto Gen",
                 "age": 25, "beltSlug": "adult-blue", "stripes": 0}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").isNotEmpty());
    }
}
