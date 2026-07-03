package com.bjjflow.backend.gyms;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class StudentAdminFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String[] register(String email, String belt) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 28, "beltSlug": "%s", "stripes": 1}
                        """.formatted(email, email.split("@")[0], belt)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] { JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")) };
    }

    private String auth(String t) {
        return "Bearer " + t;
    }

    @Test
    void staffSeesSummaryAttendanceNotesAndHistory() throws Exception {
        String[] owner = register("sa-owner@bjjflow.com", "adult-black");
        String code = JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Admin\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteCode");

        String[] student = register("sa-student@bjjflow.com", "adult-blue");
        mockMvc.perform(post("/api/v1/gyms/join").header("Authorization", auth(student[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(code)))
                .andExpect(status().isOk());

        // one verified attendance
        int dow = LocalDate.now().getDayOfWeek().getValue();
        String today = LocalDate.now().toString();
        long classId = ((Number) JsonPath.read(mockMvc.perform(post("/api/v1/gyms/classes")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Fundamentos", "dayOfWeek": %d, "startTime": "00:30",
                         "endTime": "23:30", "sessionType": "GI", "restrictionMode": "ALL"}
                        """.formatted(dow)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.id")).longValue();
        mockMvc.perform(post("/api/v1/gyms/classes/" + classId + "/attendance")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"userId\": %s, \"present\": true}".formatted(today, student[1])))
                .andExpect(status().isOk());

        // owner sees the admin summary
        mockMvc.perform(get("/api/v1/gyms/me/students/" + student[1]).header("Authorization", auth(owner[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.belt.slug").value("adult-blue"))
                .andExpect(jsonPath("$.graduation.classesSincePromotion").value(1))
                .andExpect(jsonPath("$.graduation.graduationTarget").value(40))
                .andExpect(jsonPath("$.attendance.totalClasses").value(1))
                .andExpect(jsonPath("$.history.length()").value(0));

        // a plain member cannot use the admin endpoint
        mockMvc.perform(get("/api/v1/gyms/me/students/" + owner[1]).header("Authorization", auth(student[0])))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_STAFF"));

        // notes: add + list
        mockMvc.perform(post("/api/v1/gyms/me/students/" + student[1] + "/notes")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"Foco na guarda; joelho sensível\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Foco na guarda; joelho sensível"));
        mockMvc.perform(get("/api/v1/gyms/me/students/" + student[1] + "/notes")
                .header("Authorization", auth(owner[0])))
                .andExpect(jsonPath("$.length()").value(1));

        // promote -> history now has one entry, belt updated, counter reset
        mockMvc.perform(post("/api/v1/gyms/me/members/" + student[1] + "/promote")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"beltSlug\": \"adult-purple\", \"stripes\": 0}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/gyms/me/students/" + student[1]).header("Authorization", auth(owner[0])))
                .andExpect(jsonPath("$.belt.slug").value("adult-purple"))
                .andExpect(jsonPath("$.history.length()").value(1))
                .andExpect(jsonPath("$.history[0].beltNamePt").value("Roxa"))
                .andExpect(jsonPath("$.graduation.classesSincePromotion").value(0));
    }
}
