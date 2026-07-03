package com.bjjflow.backend.gyms;

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
class GymReviewsMedalsFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email, String belt) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 28, "beltSlug": "%s", "stripes": 0}
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
                .content("{\"name\": \"Academia Provas\"}"))
                .andExpect(status().isOk());
        return token;
    }

    @Test
    void reviewsEmptyThenUpsert() throws Exception {
        String tok = createGymOwner("reviewsdono@bjjflow.com");

        // empty to start
        mockMvc.perform(get("/api/v1/gyms/me/reviews").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.count").value(0))
                .andExpect(jsonPath("$.summary.average").value(0.0))
                .andExpect(jsonPath("$.reviews.length()").value(0));

        // leave a review
        mockMvc.perform(post("/api/v1/gyms/me/reviews")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\": 5, \"comment\": \"Melhor academia\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.count").value(1))
                .andExpect(jsonPath("$.summary.average").value(5.0))
                .andExpect(jsonPath("$.summary.myRating").value(5))
                .andExpect(jsonPath("$.reviews[0].comment").value("Melhor academia"));

        // upsert overwrites, doesn't duplicate
        mockMvc.perform(post("/api/v1/gyms/me/reviews")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\": 4, \"comment\": \"Editado\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.count").value(1))
                .andExpect(jsonPath("$.summary.myRating").value(4))
                .andExpect(jsonPath("$.reviews[0].comment").value("Editado"));
    }

    @Test
    void medalsReplaceAndValidate() throws Exception {
        String tok = createGymOwner("medalsdono@bjjflow.com");

        // gym starts with no medals and exposes createdAt
        mockMvc.perform(get("/api/v1/gyms/me").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.medals.length()").value(0))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        // owner sets a medal showcase
        mockMvc.perform(put("/api/v1/gyms/me/medals")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"medals": [
                          {"competition": "IBJJF", "tier": "GOLD", "count": 3},
                          {"competition": "Pan", "tier": "SILVER", "count": 1}
                        ]}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.medals.length()").value(2))
                .andExpect(jsonPath("$.medals[0].competition").value("IBJJF"))
                .andExpect(jsonPath("$.medals[0].tier").value("GOLD"))
                .andExpect(jsonPath("$.medals[0].count").value(3));

        // PUT replaces the whole list
        mockMvc.perform(put("/api/v1/gyms/me/medals")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"medals": [{"competition": "ADCC", "tier": "BRONZE", "count": 2}]}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.medals.length()").value(1))
                .andExpect(jsonPath("$.medals[0].competition").value("ADCC"));

        // bad tier is rejected
        mockMvc.perform(put("/api/v1/gyms/me/medals")
                .header("Authorization", auth(tok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"medals": [{"competition": "IBJJF", "tier": "PLATINUM", "count": 1}]}
                        """))
                .andExpect(status().isBadRequest());
    }
}
