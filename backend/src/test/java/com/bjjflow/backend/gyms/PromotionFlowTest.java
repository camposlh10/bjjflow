package com.bjjflow.backend.gyms;

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
class PromotionFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String[] register(String email, String belt) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 28, "beltSlug": "%s", "stripes": 2}
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

    @Test
    void graduationCounterAndPromotion() throws Exception {
        String[] owner = register("promoowner@bjjflow.com", "adult-black");
        String code = JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Promo\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteCode");

        String[] student = register("promoaluno@bjjflow.com", "adult-blue");
        mockMvc.perform(post("/api/v1/gyms/join").header("Authorization", auth(student[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(code)))
                .andExpect(status().isOk());

        // a class today + instructor marks the student present -> 1 verified attendance
        int dow = LocalDate.now().getDayOfWeek().getValue();
        String today = LocalDate.now().toString();
        String classJson = mockMvc.perform(post("/api/v1/gyms/classes")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Fundamentos", "dayOfWeek": %d, "startTime": "00:30",
                         "endTime": "23:30", "sessionType": "GI", "restrictionMode": "ALL"}
                        """.formatted(dow)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long classId = ((Number) JsonPath.read(classJson, "$.id")).longValue();

        mockMvc.perform(post("/api/v1/gyms/classes/" + classId + "/attendance")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"userId\": %s, \"present\": true}".formatted(today, student[1])))
                .andExpect(status().isOk());

        // members list shows the counter at 1 for the student
        mockMvc.perform(get("/api/v1/gyms/me/members").header("Authorization", auth(owner[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.userId == %s)].classesAttended".formatted(student[1]))
                        .value(org.hamcrest.Matchers.contains(1)));

        // student cannot promote
        mockMvc.perform(post("/api/v1/gyms/me/members/" + owner[1] + "/promote")
                .header("Authorization", auth(student[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"beltSlug": "adult-white", "stripes": 0}
                        """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_STAFF"));

        // stripes above the belt's max rejected (purple max 4)
        mockMvc.perform(post("/api/v1/gyms/me/members/" + student[1] + "/promote")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"beltSlug": "adult-purple", "stripes": 5}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_STRIPES"));

        // promote to purple 1 stripe -> belt changes and counter resets
        mockMvc.perform(post("/api/v1/gyms/me/members/" + student[1] + "/promote")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"beltSlug": "adult-purple", "stripes": 1}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.belt.slug").value("adult-purple"))
                .andExpect(jsonPath("$.belt.stripes").value(1))
                .andExpect(jsonPath("$.classesAttended").value(0));

        // the student sees the new belt on /users/me
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", auth(student[0])))
                .andExpect(jsonPath("$.belt.namePt").value("Roxa"))
                .andExpect(jsonPath("$.belt.stripes").value(1));
    }

    @Test
    void beltSyncOff_updatesGymBeltButNotProfile() throws Exception {
        String[] owner = register("syncowner@bjjflow.com", "adult-black");
        String code = JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Sync\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteCode");

        String[] student = register("syncaluno@bjjflow.com", "adult-blue");
        mockMvc.perform(post("/api/v1/gyms/join").header("Authorization", auth(student[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(code)))
                .andExpect(status().isOk());

        // student opts out of letting the gym change their public profile belt
        mockMvc.perform(put("/api/v1/users/me/settings").header("Authorization", auth(student[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"gymBeltSync\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gymBeltSync").value(false));

        // owner promotes to purple 1 -> the gym's view of the member reflects it
        mockMvc.perform(post("/api/v1/gyms/me/members/" + student[1] + "/promote")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"beltSlug\": \"adult-purple\", \"stripes\": 1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.belt.slug").value("adult-purple"))
                .andExpect(jsonPath("$.belt.stripes").value(1));

        // the members list shows the gym-local belt (purple)
        mockMvc.perform(get("/api/v1/gyms/me/members").header("Authorization", auth(owner[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.userId == %s)].belt.slug".formatted(student[1]))
                        .value(org.hamcrest.Matchers.contains("adult-purple")));

        // but the student's PROFILE belt is untouched — still blue, 2 stripes
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", auth(student[0])))
                .andExpect(jsonPath("$.belt.namePt").value("Azul"))
                .andExpect(jsonPath("$.belt.stripes").value(2));
    }
}
