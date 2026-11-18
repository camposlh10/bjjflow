package com.bjjflow.backend.compete;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CompeteFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private MatchSettler matchSettler;

    private record Member(String token, long id) {
        String bearer() {
            return "Bearer " + token;
        }
    }

    private Member register(String email, String name) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "senha-forte-123", "displayName": "%s",
                         "age": 30, "beltSlug": "adult-blue", "stripes": 0}
                        """.formatted(email, name)))
                .andExpect(status().isOk())
                .andReturn();
        String json = result.getResponse().getContentAsString();
        return new Member(JsonPath.read(json, "$.accessToken"), ((Number) JsonPath.read(json, "$.user.id")).longValue());
    }

    private void follow(Member who, Member whom) throws Exception {
        mockMvc.perform(post("/api/v1/users/" + whom.id() + "/follow").header("Authorization", who.bearer()))
                .andExpect(status().is2xxSuccessful());
    }

    private void mutualFollow(Member a, Member b) throws Exception {
        follow(a, b);
        follow(b, a);
    }

    private int checkIn(Member m, LocalDate date) throws Exception {
        var result = mockMvc.perform(post("/api/v1/checkins").header("Authorization", m.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"" + date + "\", \"sessionType\": \"GI\", \"durationMinutes\": 60}"))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.pointsEarned");
    }

    /** A training with a photo, logged {@code lateHours} after noon of its day. */
    private void provenTraining(Member m, LocalDate date, long lateHours) {
        Timestamp created = Timestamp.from(date.atTime(LocalTime.NOON).atZone(Compete.ZONE).toInstant()
                .plus(lateHours, ChronoUnit.HOURS));
        jdbc.update("INSERT INTO check_ins (user_id, check_date, session_type, photo_key, created_at) "
                + "VALUES (?, ?, 'GI', 'test/photo.jpg', ?)", m.id(), Date.valueOf(date), created);
    }

    private long challenge(Member from, Member to) throws Exception {
        var result = mockMvc.perform(post("/api/v1/matches").header("Authorization", from.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"opponentId\": " + to.id() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private int rating(Member m) throws Exception {
        var result = mockMvc.perform(get("/api/v1/compete/me").header("Authorization", m.bearer()))
                .andExpect(status().isOk()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.rating");
    }

    @Test
    void trainingDaysEarnRatingOncePerDayAndNotWhenLoggedLate() throws Exception {
        Member m = register("rating-days@bjjflow.com", "Rating Days");
        mockMvc.perform(put("/api/v1/users/me/weekly-goal").header("Authorization", m.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"weeklyGoal\": 2}"))
                .andExpect(status().isOk());

        // The app's day (São Paulo) and the server's may differ: stay on a day both accept.
        LocalDate today = LocalDate.now(Compete.ZONE);
        LocalDate base = today.isAfter(LocalDate.now()) ? LocalDate.now() : today;
        LocalDate dayBefore = base.minusDays(1);
        boolean sameWeek = dayBefore.with(DayOfWeek.MONDAY).equals(base.with(DayOfWeek.MONDAY));

        assertThat(checkIn(m, base)).isEqualTo(5);
        assertThat(checkIn(m, base)).isZero(); // same day again
        // The second day reaches the goal of 2 when both days are in the same week.
        assertThat(checkIn(m, dayBefore)).isEqualTo(sameWeek ? 10 : 5);
        assertThat(checkIn(m, base.minusDays(5))).isZero(); // logged too late to count

        int expected = 1000 + 5 + 5 + (sameWeek ? 5 : 0);
        mockMvc.perform(get("/api/v1/compete/me").header("Authorization", m.bearer()))
                .andExpect(jsonPath("$.rating").value(expected))
                .andExpect(jsonPath("$.monthDelta").isNumber())
                .andExpect(jsonPath("$.acceptsChallenges").value(true));
    }

    @Test
    void matchIsFirstToThreeWeeklyRoundsAndExchangesRating() throws Exception {
        Member ana = register("match-ana@bjjflow.com", "Ana Match");
        Member beto = register("match-beto@bjjflow.com", "Beto Match");
        Member caio = register("match-caio@bjjflow.com", "Caio Match");
        mutualFollow(ana, beto);

        // Only members of the same gym or who follow each other can play.
        mockMvc.perform(post("/api/v1/matches").header("Authorization", ana.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"opponentId\": " + caio.id() + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CHALLENGE_NOT_CONNECTED"));

        long id = challenge(ana, beto);
        // One open match per pair.
        mockMvc.perform(post("/api/v1/matches").header("Authorization", beto.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"opponentId\": " + ana.id() + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CHALLENGE_OPEN_MATCH"));
        // Only the opponent can accept.
        mockMvc.perform(post("/api/v1/matches/" + id + "/accept").header("Authorization", ana.bearer()))
                .andExpect(status().isConflict());
        mockMvc.perform(get("/api/v1/matches").header("Authorization", beto.bearer()))
                .andExpect(jsonPath("$.incoming[0].id").value(id))
                .andExpect(jsonPath("$.incoming[0].stake.challengerWin").value(20));
        mockMvc.perform(post("/api/v1/matches/" + id + "/accept").header("Authorization", beto.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.startsOn").value(LocalDate.now(Compete.ZONE).plusDays(1).toString()));

        // Move the match back so today falls in round 4 (reads settle up to now),
        // and play five weeks; rounds 4 and 5 are settled with a later clock.
        LocalDate start = LocalDate.now(Compete.ZONE).minusDays(3 * 7 + 2);
        jdbc.update("UPDATE matches SET starts_on = ? WHERE id = ?", Date.valueOf(start), id);
        int[][] week = { { 3, 1 }, { 2, 2 }, { 1, 2 }, { 2, 0 }, { 3, 0 } };
        for (int r = 0; r < week.length; r++) {
            LocalDate from = Compete.roundStart(start, r + 1);
            for (int d = 0; d < week[r][0]; d++) {
                provenTraining(ana, from.plusDays(d), 0);
            }
            for (int d = 0; d < week[r][1]; d++) {
                provenTraining(beto, from.plusDays(d), 0);
            }
        }
        // Logged two days later: doesn't count, so round 1 stays 3 × 1.
        provenTraining(beto, start.plusDays(5), 48);

        matchSettler.settleAll(Compete.settlesAt(Compete.roundEnd(start, 3)));
        mockMvc.perform(get("/api/v1/matches/" + id).header("Authorization", ana.bearer()))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.roundsPlayed").value(3))
                .andExpect(jsonPath("$.rounds[0].challengerDays").value(3))
                .andExpect(jsonPath("$.rounds[0].opponentDays").value(1))
                .andExpect(jsonPath("$.rounds[1].winnerId").doesNotExist())
                .andExpect(jsonPath("$.challengerRounds").value(1))
                .andExpect(jsonPath("$.opponentRounds").value(1));

        int anaBefore = rating(ana);
        int betoBefore = rating(beto);
        int gain = Compete.elo(anaBefore, betoBefore, 1);
        matchSettler.settleAll(Compete.settlesAt(Compete.roundEnd(start, 5)));
        mockMvc.perform(get("/api/v1/matches/" + id).header("Authorization", beto.bearer()))
                .andExpect(jsonPath("$.status").value("FINISHED"))
                .andExpect(jsonPath("$.endReason").value("FIRST_TO_3"))
                .andExpect(jsonPath("$.winnerId").value(ana.id()))
                .andExpect(jsonPath("$.challengerRounds").value(3))
                .andExpect(jsonPath("$.opponentRounds").value(1))
                .andExpect(jsonPath("$.challengerDelta").value(gain))
                .andExpect(jsonPath("$.headToHead.challengerWins").value(1))
                .andExpect(jsonPath("$.timeline").isArray());
        assertThat(rating(ana)).isEqualTo(anaBefore + gain);
        assertThat(rating(beto)).isEqualTo(betoBefore - gain);

        // Settling again changes nothing.
        matchSettler.settleAll(Compete.settlesAt(Compete.roundEnd(start, 8)));
        assertThat(rating(ana)).isEqualTo(anaBefore + gain);

        // The winner posts; a follower sees it and reposts it.
        mockMvc.perform(post("/api/v1/matches/" + id + "/post").header("Authorization", ana.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"caption\": \"Semana a semana\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.match.winnerId").value(ana.id()));
        var feed = mockMvc.perform(get("/api/v1/match-posts").header("Authorization", beto.bearer()))
                .andExpect(jsonPath("$[0].caption").value("Semana a semana"))
                .andReturn();
        long postId = ((Number) JsonPath.read(feed.getResponse().getContentAsString(), "$[0].id")).longValue();
        mockMvc.perform(post("/api/v1/match-posts/" + postId + "/repost").header("Authorization", caio.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repostOf.id").value(ana.id()))
                .andExpect(jsonPath("$.repostCount").value(1))
                .andExpect(jsonPath("$.sharedByMe").value(true));
        // Anyone can open a posted match.
        mockMvc.perform(get("/api/v1/matches/" + id).header("Authorization", caio.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myRole").doesNotExist());

        // A new match between them starts again at 0 × 0; the record stays.
        long rematch = challenge(beto, ana);
        mockMvc.perform(get("/api/v1/compete/vs/" + beto.id()).header("Authorization", ana.bearer()))
                .andExpect(jsonPath("$.myWins").value(1))
                .andExpect(jsonPath("$.theirWins").value(0))
                .andExpect(jsonPath("$.openMatch.id").value(rematch))
                .andExpect(jsonPath("$.openMatch.challengerRounds").value(0))
                .andExpect(jsonPath("$.canChallenge").value(false))
                .andExpect(jsonPath("$.blockedReason").value("OPEN_MATCH"));
        mockMvc.perform(post("/api/v1/matches/" + rematch + "/decline").header("Authorization", ana.bearer()))
                .andExpect(jsonPath("$.status").value("DECLINED"));
    }

    @Test
    void forfeitingLosesTheMatchAndChallengesCanBeTurnedOff() throws Exception {
        Member dani = register("match-dani@bjjflow.com", "Dani Match");
        Member edu = register("match-edu@bjjflow.com", "Edu Match");
        mutualFollow(dani, edu);

        long id = challenge(dani, edu);
        mockMvc.perform(post("/api/v1/matches/" + id + "/accept").header("Authorization", edu.bearer()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/matches/" + id + "/forfeit").header("Authorization", edu.bearer()))
                .andExpect(jsonPath("$.status").value("FINISHED"))
                .andExpect(jsonPath("$.endReason").value("FORFEIT"))
                .andExpect(jsonPath("$.winnerId").value(dani.id()))
                .andExpect(jsonPath("$.challengerDelta").value(20))
                .andExpect(jsonPath("$.opponentDelta").value(-20));

        mockMvc.perform(put("/api/v1/compete/me/settings").header("Authorization", edu.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"acceptsChallenges\": false}"))
                .andExpect(jsonPath("$.acceptsChallenges").value(false))
                .andExpect(jsonPath("$.rating").value(980));
        mockMvc.perform(post("/api/v1/matches").header("Authorization", dani.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"opponentId\": " + edu.id() + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CHALLENGE_DISABLED"));

        // Ranking among people Dani follows, by rating.
        mockMvc.perform(get("/api/v1/compete/ranking?scope=following").header("Authorization", dani.bearer()))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.entries[0].player.id").value(dani.id()))
                .andExpect(jsonPath("$.entries[0].player.rating").value(1020))
                .andExpect(jsonPath("$.entries[0].me").value(true))
                .andExpect(jsonPath("$.entries[1].player.id").value(edu.id()))
                .andExpect(jsonPath("$.entries[1].monthDelta").value(-20));
        mockMvc.perform(get("/api/v1/compete/ranking?scope=gym").header("Authorization", dani.bearer()))
                .andExpect(jsonPath("$.available").value(false));
    }
}
