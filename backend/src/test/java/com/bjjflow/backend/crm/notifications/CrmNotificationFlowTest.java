package com.bjjflow.backend.crm.notifications;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
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

import com.bjjflow.backend.classes.ClassAttendance;
import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@org.springframework.transaction.annotation.Transactional
class CrmNotificationFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClassAttendanceRepository classAttendanceRepository;

    @Test
    void staffCanSendAnnouncementsToMembers() throws Exception {
        Account owner = register("ann-owner@bjjflow.com", "Ann Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Announcement Academy");
        Account memberA = register("ann-a@bjjflow.com", "Ann MemberA", "adult-blue");
        Account memberB = register("ann-b@bjjflow.com", "Ann MemberB", "adult-blue");
        joinGym(memberA.token(), inviteCode);
        joinGym(memberB.token(), inviteCode);

        mockMvc.perform(post("/api/v1/crm/notifications/announcements")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title": "Feriado", "message": "Não haverá aula no dia 12."}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipientCount").value(2));

        mockMvc.perform(post("/api/v1/crm/notifications/announcements")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "title": "Mensalidade", "message": "Passa na recepção."}
                        """.formatted(memberA.userId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipientCount").value(1));

        mockMvc.perform(get("/api/v1/users/me/notifications")
                .header("Authorization", bearer(memberA.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title", hasItem("Feriado")))
                .andExpect(jsonPath("$.items[*].title", hasItem("Mensalidade")));
        mockMvc.perform(get("/api/v1/users/me/notifications")
                .header("Authorization", bearer(memberB.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title", hasItem("Feriado")));

        mockMvc.perform(get("/api/v1/crm/notifications/events")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].type", hasItem("ANNOUNCEMENT")));

        mockMvc.perform(post("/api/v1/crm/notifications/announcements")
                .header("Authorization", bearer(memberA.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\": \"x\", \"message\": \"y\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_STAFF_ONLY"));
    }

    @Test
    void paymentReminderLadderFiresOnceAndFlagsDelinquents() throws Exception {
        Account owner = register("ladder-owner@bjjflow.com", "Ladder Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Ladder Academy");
        Account member = register("ladder-member@bjjflow.com", "Ladder Member", "adult-blue");
        joinGym(member.token(), inviteCode);

        createInvoice(owner.token(), member.userId(), "Mensalidade futura", "150.00",
                LocalDate.now().plusDays(7));
        createInvoice(owner.token(), member.userId(), "Mensalidade de hoje", "150.00", LocalDate.now());
        createInvoice(owner.token(), member.userId(), "Atrasada 3 dias", "150.00",
                LocalDate.now().minusDays(3));
        long oldInvoiceId = createInvoice(owner.token(), member.userId(), "Atrasada 15 dias", "150.00",
                LocalDate.now().minusDays(15));

        mockMvc.perform(post("/api/v1/crm/notifications/run-automations")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdEvents").value(4));

        // Idempotent: a second run fires nothing new.
        mockMvc.perform(post("/api/v1/crm/notifications/run-automations")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdEvents").value(0));

        mockMvc.perform(get("/api/v1/users/me/notifications")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title", hasItem("Mensalidade a vencer")))
                .andExpect(jsonPath("$.items[*].title", hasItem("Fatura vence hoje")))
                .andExpect(jsonPath("$.items[*].title", hasItem("Fatura em atraso")));
        mockMvc.perform(get("/api/v1/users/me/notifications")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title", hasItem("Aluno inadimplente")));

        mockMvc.perform(get("/api/v1/crm/members")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.userId == %d)].delinquent".formatted(member.userId()))
                        .value(true));

        // Paying the 15-day invoice is not enough — another overdue remains.
        mockMvc.perform(put("/api/v1/crm/invoices/" + oldInvoiceId + "/mark-paid")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/crm/members")
                .header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$[?(@.userId == %d)].delinquent".formatted(member.userId()))
                        .value(true));

        // Settling every overdue invoice clears the flag.
        String invoicesJson = mockMvc.perform(get("/api/v1/crm/invoices")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (Object id : JsonPath.<java.util.List<Object>>read(invoicesJson,
                "$[?(@.status == 'OVERDUE')].id")) {
            mockMvc.perform(put("/api/v1/crm/invoices/" + id + "/mark-paid")
                    .header("Authorization", bearer(owner.token())))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(get("/api/v1/crm/members")
                .header("Authorization", bearer(owner.token())))
                .andExpect(jsonPath("$[?(@.userId == %d)].delinquent".formatted(member.userId()))
                        .value(false));
    }

    @Test
    void inactivityNudgesAndClassCancellationNotices() throws Exception {
        Account owner = register("idle-owner@bjjflow.com", "Idle Owner", "adult-black");
        String inviteCode = createGym(owner.token(), "Idle Academy");
        Account member = register("idle-member@bjjflow.com", "Idle Member", "adult-blue");
        joinGym(member.token(), inviteCode);
        long classId = createClass(owner, "Fundamentos", "18:00", "19:00");

        ClassAttendance attendance = new ClassAttendance();
        attendance.setGymClassId(classId);
        attendance.setClassDate(LocalDate.now().minusDays(7));
        attendance.setUserId(member.userId());
        attendance.setStatus("PRESENT");
        classAttendanceRepository.save(attendance);

        mockMvc.perform(post("/api/v1/crm/notifications/run-automations")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdEvents").value(greaterThanOrEqualTo(1)));

        mockMvc.perform(get("/api/v1/users/me/notifications")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title", hasItem("Sentimos sua falta!")));
        mockMvc.perform(get("/api/v1/crm/notifications/events")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].type", hasItem("ENGAGEMENT_NUDGE")));

        // Cancelling (deactivating) the class notifies its recent attendees.
        mockMvc.perform(delete("/api/v1/crm/classes/" + classId)
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users/me/notifications")
                .header("Authorization", bearer(member.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].title", hasItem("Aula cancelada")));
        mockMvc.perform(get("/api/v1/crm/notifications/events")
                .header("Authorization", bearer(owner.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].type", hasItem("CLASS_CANCELLED")));
    }

    private long createInvoice(String token, long memberUserId, String description, String amount,
            LocalDate dueDate) throws Exception {
        String response = mockMvc.perform(post("/api/v1/crm/invoices")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"memberUserId": %d, "description": "%s", "amount": %s, "dueDate": "%s"}
                        """.formatted(memberUserId, description, amount, dueDate)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.id")).longValue();
    }

    private long createClass(Account owner, String name, String startTime, String endTime) throws Exception {
        String response = mockMvc.perform(post("/api/v1/crm/classes")
                .header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "%s", "sessionType": "GI", "dayOfWeek": %d,
                         "startTime": "%s", "endTime": "%s", "instructorUserId": %d}
                        """.formatted(name, LocalDate.now().getDayOfWeek().getValue(), startTime, endTime,
                        owner.userId())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.id")).longValue();
    }

    private String createGym(String token, String name) throws Exception {
        String response = mockMvc.perform(post("/api/v1/gyms")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"%s\"}".formatted(name)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.inviteCode");
    }

    private void joinGym(String token, String inviteCode) throws Exception {
        mockMvc.perform(post("/api/v1/gyms/join")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"inviteCode\": \"%s\"}".formatted(inviteCode)))
                .andExpect(status().isOk());
    }

    private Account register(String email, String displayName, String beltSlug) throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 30, "beltSlug": "%s", "stripes": 0}
                        """.formatted(email, displayName, beltSlug)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new Account(
                JsonPath.read(response, "$.accessToken"),
                ((Number) JsonPath.read(response, "$.user.id")).longValue());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private record Account(String token, long userId) {
    }
}
