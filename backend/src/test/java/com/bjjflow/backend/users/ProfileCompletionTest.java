package com.bjjflow.backend.users;

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
class ProfileCompletionTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void completeProfileUpdatesBeltAgeAndLocation() throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "complete@bjjflow.com", "password": "senha-forte-123", "displayName": "Complete Me",
                         "age": 25, "beltSlug": "adult-white", "stripes": 0}
                        """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(json, "$.accessToken");
        int id = JsonPath.read(json, "$.user.id");

        mockMvc.perform(put("/api/v1/users/me/onboarding")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"beltSlug": "adult-blue", "stripes": 2, "age": 30,
                         "country": "Brasil", "state": "SP", "city": "Campinas", "favoriteArt": "BJJ"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.belt.slug").value("adult-blue"))
                .andExpect(jsonPath("$.belt.stripes").value(2));

        mockMvc.perform(get("/api/v1/users/" + id + "/profile").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.belt.slug").value("adult-blue"))
                .andExpect(jsonPath("$.age").value(30))
                .andExpect(jsonPath("$.city").value("Campinas"))
                .andExpect(jsonPath("$.country").value("Brasil"))
                .andExpect(jsonPath("$.state").value("SP"));
    }
}
