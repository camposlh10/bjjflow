package com.bjjflow.backend.techniques;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class TechniqueFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 26, "beltSlug": "adult-blue", "stripes": 0, "weightKg": 80.0}
                        """.formatted(email, email.split("@")[0])))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void catalogCategoriesAndFavorites() throws Exception {
        String tok = register("tech1@bjjflow.com");

        // Seeded catalog returns items + categories
        String list = mockMvc.perform(get("/api/v1/techniques").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(org.hamcrest.Matchers.greaterThan(10)))
                .andExpect(jsonPath("$.categories.length()").value(org.hamcrest.Matchers.greaterThan(0)))
                .andReturn().getResponse().getContentAsString();
        int firstId = JsonPath.read(list, "$.items[0].id");

        // Filter by category
        mockMvc.perform(get("/api/v1/techniques").param("category", "SUBMISSION").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.category != 'SUBMISSION')]")
                        .value(org.hamcrest.Matchers.hasSize(0)));

        // Search
        mockMvc.perform(get("/api/v1/techniques").param("q", "triângulo").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(org.hamcrest.Matchers.greaterThan(0)));

        // Favorite toggle on -> appears in favorites
        mockMvc.perform(post("/api/v1/techniques/" + firstId + "/favorite").header("Authorization", auth(tok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.favorite").value(true));
        mockMvc.perform(get("/api/v1/users/me/favorite-techniques").header("Authorization", auth(tok)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].favorite").value(true));

        // Toggle off -> empty favorites
        mockMvc.perform(post("/api/v1/techniques/" + firstId + "/favorite").header("Authorization", auth(tok)))
                .andExpect(jsonPath("$.favorite").value(false));
        mockMvc.perform(get("/api/v1/users/me/favorite-techniques").header("Authorization", auth(tok)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void personalTechniquesCrudIsPrivate() throws Exception {
        String a = register("tech-a@bjjflow.com");
        String b = register("tech-b@bjjflow.com");

        String created = mockMvc.perform(post("/api/v1/users/me/techniques").header("Authorization", auth(a))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Meu berimbolo\", \"category\": \"SWEEP\", \"notes\": \"detalhe do gancho\","
                        + " \"videoUrl\": \"https://youtu.be/abc123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Meu berimbolo"))
                .andExpect(jsonPath("$.videoUrl").value("https://youtu.be/abc123"))
                .andReturn().getResponse().getContentAsString();
        int id = JsonPath.read(created, "$.id");

        // Owner sees it; other user does not
        mockMvc.perform(get("/api/v1/users/me/techniques").header("Authorization", auth(a)))
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/v1/users/me/techniques").header("Authorization", auth(b)))
                .andExpect(jsonPath("$.length()").value(0));

        // Update
        mockMvc.perform(put("/api/v1/users/me/techniques/" + id).header("Authorization", auth(a))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Berimbolo atualizado\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Berimbolo atualizado"));

        // Other user can't update or delete it
        mockMvc.perform(put("/api/v1/users/me/techniques/" + id).header("Authorization", auth(b))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"hack\"}"))
                .andExpect(status().isNotFound());

        // Owner deletes
        mockMvc.perform(delete("/api/v1/users/me/techniques/" + id).header("Authorization", auth(a)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/users/me/techniques").header("Authorization", auth(a)))
                .andExpect(jsonPath("$.length()").value(0));
    }
}
