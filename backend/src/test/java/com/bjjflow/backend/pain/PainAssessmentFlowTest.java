package com.bjjflow.backend.pain;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class PainAssessmentFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String register(String email) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "Dor Teste",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$.accessToken");
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void createListGetDeleteAssessment() throws Exception {
        String token = register("dor@bjjflow.com");

        // Create with two PRESSURE areas (intensities 8 + 4) and full context.
        String created = mockMvc.perform(post("/api/v1/users/me/pain/assessments")
                .header("Authorization", auth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"onsetDate": "2024-05-22", "trend": "SAME", "frequency": "CONSTANT",
                         "relieves": "repouso", "worsens": "esforço", "notes": "lombar há semanas",
                         "areas": [
                           {"region": "lower_back", "painType": "PRESSURE", "intensity": 8, "note": "piora à noite"},
                           {"region": "neck", "painType": "PRESSURE", "intensity": 4}
                         ]}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.areas.length()").value(2))
                .andExpect(jsonPath("$.avgIntensity").value(6.0))
                .andExpect(jsonPath("$.predominantType").value("PRESSURE"))
                .andExpect(jsonPath("$.trend").value("SAME"))
                // areas come back sorted by intensity desc
                .andExpect(jsonPath("$.areas[0].region").value("lower_back"))
                .andExpect(jsonPath("$.areas[0].intensity").value(8))
                .andReturn().getResponse().getContentAsString();
        int id = JsonPath.read(created, "$.id");

        // History list shows the one assessment with derived fields.
        mockMvc.perform(get("/api/v1/users/me/pain/assessments").header("Authorization", auth(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].areaCount").value(2))
                .andExpect(jsonPath("$[0].avgIntensity").value(6.0))
                .andExpect(jsonPath("$[0].predominantType").value("PRESSURE"));

        // Latest returns the full assessment.
        mockMvc.perform(get("/api/v1/users/me/pain/assessments/latest").header("Authorization", auth(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.areas.length()").value(2));

        // Get by id returns areas + context.
        mockMvc.perform(get("/api/v1/users/me/pain/assessments/" + id).header("Authorization", auth(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.relieves").value("repouso"))
                .andExpect(jsonPath("$.worsens").value("esforço"))
                .andExpect(jsonPath("$.areas.length()").value(2));

        // Delete, then the list is empty.
        mockMvc.perform(delete("/api/v1/users/me/pain/assessments/" + id).header("Authorization", auth(token)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users/me/pain/assessments").header("Authorization", auth(token)))
                .andExpect(jsonPath("$.length()").value(0));
    }
}
