package com.bjjflow.backend.gyms;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

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
class GymExtrasFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String[] register(String email, String belt) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 28, "beltSlug": "%s", "stripes": 0}
                        """.formatted(email, email.split("@")[0], belt)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] {
                JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")),
        };
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    private String[] setupGym(String ownerEmail, String studentEmail) throws Exception {
        String[] owner = register(ownerEmail, "adult-black");
        String code = JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Extras\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteCode");
        String[] student = register(studentEmail, "adult-blue");
        mockMvc.perform(post("/api/v1/gyms/join").header("Authorization", auth(student[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(code)))
                .andExpect(status().isOk());
        return new String[] { owner[0], owner[1], student[0], student[1] };
    }

    @Test
    void rankingByClassAttendance() throws Exception {
        String[] ids = setupGym("rankdono@bjjflow.com", "rankaluno@bjjflow.com");
        String ownerTok = ids[0];
        String studentId = ids[3];

        int dow = LocalDate.now().getDayOfWeek().getValue();
        String today = LocalDate.now().toString();
        String classJson = mockMvc.perform(post("/api/v1/gyms/classes")
                .header("Authorization", auth(ownerTok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Aula", "dayOfWeek": %d, "startTime": "00:30", "endTime": "23:30",
                         "sessionType": "GI", "restrictionMode": "ALL"}
                        """.formatted(dow)))
                .andReturn().getResponse().getContentAsString();
        long classId = ((Number) JsonPath.read(classJson, "$.id")).longValue();

        // only the student attends -> student tops the ranking with 1 class
        mockMvc.perform(post("/api/v1/gyms/classes/" + classId + "/attendance")
                .header("Authorization", auth(ownerTok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"userId\": %s, \"present\": true}".formatted(today, studentId)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/gyms/ranking").header("Authorization", auth(ownerTok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].position").value(1))
                .andExpect(jsonPath("$[0].userId").value(Integer.parseInt(studentId)))
                .andExpect(jsonPath("$[0].classes").value(1))
                .andExpect(jsonPath("$[0].belt.slug").value("adult-blue"))
                .andExpect(jsonPath("$[1].classes").value(0));
    }

    @Test
    void marketCreateBuyAndPermissions() throws Exception {
        String[] ids = setupGym("marketdono@bjjflow.com", "marketaluno@bjjflow.com");
        String ownerTok = ids[0];
        String studentTok = ids[2];

        // students cannot create products
        mockMvc.perform(post("/api/v1/gyms/market")
                .header("Authorization", auth(studentTok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Kimono", "priceCents": 45000}
                        """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_STAFF"));

        // owner creates; student buys; counters update
        String prodJson = mockMvc.perform(post("/api/v1/gyms/market")
                .header("Authorization", auth(ownerTok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Kimono Oficial", "description": "A1-A4", "priceCents": 45000}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(0))
                .andReturn().getResponse().getContentAsString();
        long productId = ((Number) JsonPath.read(prodJson, "$.id")).longValue();

        mockMvc.perform(post("/api/v1/gyms/market/" + productId + "/buy")
                .header("Authorization", auth(studentTok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(1))
                .andExpect(jsonPath("$.orderedByMe").value(true));

        mockMvc.perform(get("/api/v1/gyms/market").header("Authorization", auth(studentTok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Kimono Oficial"))
                .andExpect(jsonPath("$[0].orderCount").value(1));

        // soft delete removes it from the list
        mockMvc.perform(delete("/api/v1/gyms/market/" + productId).header("Authorization", auth(ownerTok)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/gyms/market").header("Authorization", auth(ownerTok)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void gymProfileEditAndPhotos() throws Exception {
        String[] ids = setupGym("profiledono@bjjflow.com", "profilealuno@bjjflow.com");
        String ownerTok = ids[0];
        String studentTok = ids[2];

        // member cannot edit the gym profile
        mockMvc.perform(put("/api/v1/gyms/me")
                .header("Authorization", auth(studentTok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Hackeada"}
                        """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_OWNER"));

        // owner updates profile fields
        mockMvc.perform(put("/api/v1/gyms/me")
                .header("Authorization", auth(ownerTok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Academia Extras", "city": "São Paulo", "address": "Rua A, 123",
                         "phone": "(11) 99999-0000", "email": "contato@extras.com",
                         "website": "https://extras.com", "description": "Oss desde 2010"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address").value("Rua A, 123"))
                .andExpect(jsonPath("$.email").value("contato@extras.com"))
                .andExpect(jsonPath("$.website").value("https://extras.com"))
                .andExpect(jsonPath("$.description").value("Oss desde 2010"));

        // photos: add (using any storage key) and delete
        String photoJson = mockMvc.perform(post("/api/v1/gyms/me/photos")
                .header("Authorization", auth(ownerTok))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"key": "posts/foto-academia.jpg"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("/media/")))
                .andReturn().getResponse().getContentAsString();
        long photoId = ((Number) JsonPath.read(photoJson, "$.id")).longValue();

        mockMvc.perform(get("/api/v1/gyms/me").header("Authorization", auth(studentTok)))
                .andExpect(jsonPath("$.photos.length()").value(1));

        mockMvc.perform(delete("/api/v1/gyms/me/photos/" + photoId).header("Authorization", auth(ownerTok)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/gyms/me").header("Authorization", auth(ownerTok)))
                .andExpect(jsonPath("$.photos.length()").value(0));
    }
}
