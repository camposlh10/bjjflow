package com.bjjflow.backend.classes;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class ClassFlowTest {

    @Autowired
    private MockMvc mockMvc;

    private String body(String email, String belt, int age) {
        return """
                {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                 "age": %d, "beltSlug": "%s", "stripes": 0}
                """.formatted(email, email.split("@")[0], age, belt);
    }

    private String[] register(String email, String belt, int age) throws Exception {
        String json = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON).content(body(email, belt, age)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new String[] {
                JsonPath.read(json, "$.accessToken"),
                String.valueOf((Integer) JsonPath.read(json, "$.user.id")),
        };
    }

    private String auth(String token) {
        return "Bearer " + token;
    }

    @Test
    void scheduleCheckInAndAttendance() throws Exception {
        String[] owner = register("classowner@bjjflow.com", "adult-black", 35);
        String code = JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Agenda\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteCode");

        String[] student = register("classaluno@bjjflow.com", "adult-blue", 25);
        String[] kid = register("classkid@bjjflow.com", "kids-grey", 10);
        for (String[] u : new String[][] { student, kid }) {
            mockMvc.perform(post("/api/v1/gyms/join").header("Authorization", auth(u[0]))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"inviteCode\": \"%s\"}".formatted(code)))
                    .andExpect(status().isOk());
        }

        int dow = LocalDate.now().getDayOfWeek().getValue();
        String today = LocalDate.now().toString();

        // open class (everyone) and a kids-only class, both today; window open all day
        long c1 = createClass(owner[0], dow, "00:30", "23:30", "GI", "ALL", "Fundamentos");
        long c2 = createClass(owner[0], dow, "01:30", "23:30", "GI", "KIDS", "Kids");

        mockMvc.perform(get("/api/v1/gyms/classes").header("Authorization", auth(owner[0])))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // student agenda: c1 eligible+checkable, c2 (kids) not eligible
        mockMvc.perform(get("/api/v1/gyms/classes/agenda")
                .header("Authorization", auth(student[0]))
                .param("from", today).param("to", today))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].classId").value((int) c1))
                .andExpect(jsonPath("$[0].eligible").value(true))
                .andExpect(jsonPath("$[0].canCheckIn").value(true))
                .andExpect(jsonPath("$[1].classId").value((int) c2))
                .andExpect(jsonPath("$[1].eligible").value(false));

        // student checks in to c1; kids class is forbidden
        mockMvc.perform(post("/api/v1/gyms/classes/" + c1 + "/checkin")
                .header("Authorization", auth(student[0]))
                .contentType(MediaType.APPLICATION_JSON).content("{\"date\": \"%s\"}".formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkedIn").value(true));
        mockMvc.perform(post("/api/v1/gyms/classes/" + c2 + "/checkin")
                .header("Authorization", auth(student[0]))
                .contentType(MediaType.APPLICATION_JSON).content("{\"date\": \"%s\"}".formatted(today)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_ELIGIBLE"));

        // class check-in kept the streak
        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", auth(student[0])))
                .andExpect(jsonPath("$.checkedInToday").value(true))
                .andExpect(jsonPath("$.currentStreak").value(1));

        // quem vai: just the student
        mockMvc.perform(get("/api/v1/gyms/classes/" + c1 + "/attendees")
                .header("Authorization", auth(student[0])).param("date", today))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userId").value(Integer.parseInt(student[1])));

        // instructor roster: 3 members, student present
        mockMvc.perform(get("/api/v1/gyms/classes/" + c1 + "/roster")
                .header("Authorization", auth(owner[0])).param("date", today))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.present == true)]", hasSize(1)));

        // member can't see the roster
        mockMvc.perform(get("/api/v1/gyms/classes/" + c1 + "/roster")
                .header("Authorization", auth(student[0])).param("date", today))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_STAFF"));

        // instructor marks the kid present, then unmarks the student
        mockMvc.perform(post("/api/v1/gyms/classes/" + c1 + "/attendance")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"userId\": %s, \"present\": true}".formatted(today, kid[1])))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/gyms/classes/" + c1 + "/attendance")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"userId\": %s, \"present\": false}".formatted(today, student[1])))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/gyms/classes/" + c1 + "/attendees")
                .header("Authorization", auth(owner[0])).param("date", today))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userId").value(Integer.parseInt(kid[1])));

        // soft-delete a class
        mockMvc.perform(delete("/api/v1/gyms/classes/" + c2).header("Authorization", auth(owner[0])))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/gyms/classes").header("Authorization", auth(owner[0])))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void reservationConvertsToPresenceOnCheckIn() throws Exception {
        String[] owner = register("reservadono@bjjflow.com", "adult-black", 35);
        JsonPath.read(mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Academia Reserva\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.inviteCode");

        int dow = LocalDate.now().getDayOfWeek().getValue();
        String today = LocalDate.now().toString();
        long classId = createClass(owner[0], dow, "00:30", "23:30", "GI", "ALL", "Fundamentos");

        // reserve today's class -> RESERVED, not yet checked in
        mockMvc.perform(post("/api/v1/gyms/classes/" + classId + "/reserve")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON).content("{\"date\": \"%s\"}".formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reserved").value(true))
                .andExpect(jsonPath("$.checkedIn").value(false))
                .andExpect(jsonPath("$.attendeeCount").value(1));
        mockMvc.perform(get("/api/v1/gyms/classes/" + classId + "/attendees")
                .header("Authorization", auth(owner[0])).param("date", today))
                .andExpect(jsonPath("$[0].status").value("RESERVED"));

        // a reservation alone doesn't touch the streak
        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", auth(owner[0])))
                .andExpect(jsonPath("$.checkedInToday").value(false));

        // toggle cancels the reservation
        mockMvc.perform(post("/api/v1/gyms/classes/" + classId + "/reserve")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON).content("{\"date\": \"%s\"}".formatted(today)))
                .andExpect(jsonPath("$.reserved").value(false))
                .andExpect(jsonPath("$.attendeeCount").value(0));

        // reserve again, then check in -> the same row becomes PRESENT and streak counts
        mockMvc.perform(post("/api/v1/gyms/classes/" + classId + "/reserve")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON).content("{\"date\": \"%s\"}".formatted(today)))
                .andExpect(jsonPath("$.reserved").value(true));
        mockMvc.perform(post("/api/v1/gyms/classes/" + classId + "/checkin")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON).content("{\"date\": \"%s\"}".formatted(today)))
                .andExpect(jsonPath("$.checkedIn").value(true))
                .andExpect(jsonPath("$.reserved").value(false))
                .andExpect(jsonPath("$.attendeeCount").value(1));
        mockMvc.perform(get("/api/v1/users/me/stats").header("Authorization", auth(owner[0])))
                .andExpect(jsonPath("$.checkedInToday").value(true))
                .andExpect(jsonPath("$.currentStreak").value(1));

        // past date rejected
        mockMvc.perform(post("/api/v1/gyms/classes/" + classId + "/reserve")
                .header("Authorization", auth(owner[0]))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\"}".formatted(LocalDate.now().minusDays(1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_DATE"));
    }

    private long createClass(String token, int dow, String start, String end, String type, String restriction,
            String name) throws Exception {
        String json = mockMvc.perform(post("/api/v1/gyms/classes")
                .header("Authorization", auth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "%s", "dayOfWeek": %d, "startTime": "%s", "endTime": "%s",
                         "sessionType": "%s", "restrictionMode": "%s"}
                        """.formatted(name, dow, start, end, type, restriction)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }
}
