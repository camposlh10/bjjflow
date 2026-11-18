package com.bjjflow.backend.nudges;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.bjjflow.backend.notifications.PushDispatcher;
import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NudgeFlowTest {

    private static final ZoneId SP = ZoneId.of("America/Sao_Paulo");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private NudgeService nudgeService;

    @Autowired
    private NudgeScheduler nudgeScheduler;

    @MockitoSpyBean
    private PushDispatcher pushDispatcher;

    private record Member(String token, long id) {
    }

    private Member register(String email) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "Ritmo Teste",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email)))
                .andExpect(status().isOk()).andReturn();
        String json = result.getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(json, "$.user.id")).longValue();
        // Joined long ago, with a phone registered.
        jdbc.update("UPDATE users SET created_at = ? WHERE id = ?", Timestamp.from(Instant.now().minusSeconds(90L * 86400)), id);
        jdbc.update("INSERT INTO push_tokens (user_id, token, platform, created_at) VALUES (?, ?, 'ios', ?)", id,
                "ExponentPushToken[" + email + "]", Timestamp.from(Instant.now()));
        return new Member(JsonPath.read(json, "$.accessToken"), id);
    }

    /** A session on {@code day} that started at 19:30, logged at 21:00. */
    private void trained(Member m, LocalDate day) {
        Instant logged = day.atTime(21, 0).atZone(SP).toInstant();
        jdbc.update("INSERT INTO check_ins (user_id, check_date, session_type, duration_minutes, created_at) "
                + "VALUES (?, ?, 'GI', 90, ?)", m.id(), Date.valueOf(day), Timestamp.from(logged));
    }

    private Map<String, Object> nudge(Member m, LocalDate day) {
        return jdbc.queryForMap("SELECT kind, status, send_at, title, body, skip_reason FROM nudges "
                + "WHERE user_id = ? AND local_date = ?", m.id(), Date.valueOf(day));
    }

    @Test
    void plansFromTheRhythmSendsToThePhoneAndSkipsWhenAlreadyTrained() throws Exception {
        // Next Tuesday: three weeks of Tuesdays and Thursdays before it, but last Tuesday missed.
        LocalDate tuesday = LocalDate.now(SP).plusDays(1).with(TemporalAdjusters.nextOrSame(DayOfWeek.TUESDAY));
        Member slipping = register("rhythm-slip@bjjflow.com");
        Member steady = register("rhythm-steady@bjjflow.com");
        Member early = register("rhythm-early@bjjflow.com");
        for (int d = 1; d <= 21; d++) {
            LocalDate day = tuesday.minusDays(d);
            boolean usual = day.getDayOfWeek() == DayOfWeek.TUESDAY || day.getDayOfWeek() == DayOfWeek.THURSDAY;
            if (usual) {
                trained(steady, day);
                if (d != 7) {
                    trained(slipping, day);
                    trained(early, day);
                }
            }
        }

        // Before 05:00 nothing is planned.
        Instant four = tuesday.atTime(4, 0).atZone(SP).toInstant();
        assertThat(nudgeService.planIfDue(slipping.id(), four)).isEmpty();

        Instant morning = tuesday.atTime(6, 0).atZone(SP).toInstant();
        nudgeScheduler.runAt(morning);
        Map<String, Object> plan = nudge(slipping, tuesday);
        assertThat(plan.get("kind")).isEqualTo("HABIT");
        assertThat(plan.get("status")).isEqualTo("PLANNED");
        assertThat(NudgeService.instantOf(plan.get("send_at")).atZone(SP).toLocalTime()).isEqualTo(LocalTime.of(18, 15));
        // On pace and trained last Tuesday: nothing for the day, and planned only once.
        assertThat(nudge(steady, tuesday).get("status")).isEqualTo("NONE");
        assertThat(nudgeService.planIfDue(slipping.id(), morning.plusSeconds(3600))).isEmpty();
        assertThat(jdbc.queryForObject("SELECT state FROM user_rhythms WHERE user_id = ?", String.class, slipping.id()))
                .isEqualTo("ACTIVE");

        // At 18:15 it goes to the phone only: a push, no entry in the in-app center.
        jdbc.update("INSERT INTO check_ins (user_id, check_date, session_type, created_at) VALUES (?, ?, 'GI', ?)",
                early.id(), Date.valueOf(tuesday), Timestamp.from(tuesday.atTime(7, 0).atZone(SP).toInstant()));
        nudgeScheduler.runAt(tuesday.atTime(18, 15).atZone(SP).toInstant());
        assertThat(nudge(slipping, tuesday).get("status")).isEqualTo("SENT");
        verify(pushDispatcher, times(1)).sendToUser(eq(slipping.id()), eq("Hoje é dia de treino"), anyString());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = ?", Integer.class,
                slipping.id())).isZero();

        // Someone with the same reminder who trained that morning: skipped at send time.
        assertThat(nudge(early, tuesday).get("status")).isEqualTo("SKIPPED");
        assertThat(nudge(early, tuesday).get("skip_reason")).isEqualTo("TRAINED");
        verify(pushDispatcher, times(1)).sendToUser(eq(slipping.id()), anyString(), anyString());
    }

    @Test
    void turningSmartRemindersOffStopsThem() throws Exception {
        LocalDate tuesday = LocalDate.now(SP).plusDays(1).with(TemporalAdjusters.nextOrSame(DayOfWeek.TUESDAY));
        Member m = register("rhythm-off@bjjflow.com");
        for (int d = 1; d <= 21; d++) {
            LocalDate day = tuesday.minusDays(d);
            if ((day.getDayOfWeek() == DayOfWeek.TUESDAY && d != 7) || day.getDayOfWeek() == DayOfWeek.THURSDAY) {
                trained(m, day);
            }
        }
        nudgeScheduler.runAt(tuesday.atTime(6, 0).atZone(SP).toInstant());
        assertThat(nudge(m, tuesday).get("status")).isEqualTo("PLANNED");

        mockMvc.perform(put("/api/v1/users/me/settings").header("Authorization", "Bearer " + m.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"smartReminders\": false}"))
                .andExpect(status().isOk());
        nudgeScheduler.runAt(tuesday.atTime(18, 15).atZone(SP).toInstant());
        assertThat(nudge(m, tuesday).get("skip_reason")).isEqualTo("OFF");
        assertThat(nudgeService.candidates()).doesNotContain(m.id());
    }
}
