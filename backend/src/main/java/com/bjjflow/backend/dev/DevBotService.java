package com.bjjflow.backend.dev;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.belts.BeltRank;
import com.bjjflow.backend.belts.BeltRankRepository;
import com.bjjflow.backend.checkins.CheckIn;
import com.bjjflow.backend.checkins.CheckInRepository;
import com.bjjflow.backend.classes.ClassAttendance;
import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.bjjflow.backend.classes.GymClass;
import com.bjjflow.backend.classes.GymClassRepository;
import com.bjjflow.backend.classes.RestrictionMode;
import com.bjjflow.backend.classes.SessionType;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRole;
import com.bjjflow.backend.submissions.SubmissionLog;
import com.bjjflow.backend.submissions.SubmissionLogRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserBeltProgress;
import com.bjjflow.backend.users.UserBeltProgressRepository;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * TEMP testing aid: spawns a "BJJ Bot" student into the caller's gym and seeds it
 * with public training sessions (Comunidade feed) + class attendance (instructor
 * log) so every feature can be exercised with a single real account. The bot also
 * auto-replies in DMs (see ConversationService). Remove/gate before production.
 */
@Service
@RequiredArgsConstructor
public class DevBotService {

    public static final String BOT_EMAIL = "bot@bjjflow.com";

    private final UserRepository userRepository;
    private final UserBeltProgressRepository beltProgressRepository;
    private final BeltRankRepository beltRankRepository;
    private final GymMemberRepository gymMemberRepository;
    private final CheckInRepository checkInRepository;
    private final SubmissionLogRepository submissionLogRepository;
    private final GymClassRepository gymClassRepository;
    private final ClassAttendanceRepository classAttendanceRepository;
    private final PasswordEncoder passwordEncoder;

    public record BotDto(Long userId, String username, String displayName, Long gymId) {
    }

    @Transactional
    public BotDto spawnInMyGym(Long callerId) {
        GymMember caller = gymMemberRepository.findFirstByUserId(callerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM",
                        "Create or join a gym first, then add the bot"));
        Long gymId = caller.getGymId();
        User bot = ensureBot();

        boolean alreadyHere = gymMemberRepository.findByGymIdAndUserId(gymId, bot.getId()).isPresent();
        if (!alreadyHere) {
            // One gym per user: move the bot out of any previous gym, then seed fresh.
            gymMemberRepository.findFirstByUserId(bot.getId()).ifPresent(gymMemberRepository::delete);
            GymMember m = new GymMember();
            m.setGymId(gymId);
            m.setUserId(bot.getId());
            m.setRole(GymRole.MEMBER);
            gymMemberRepository.save(m);
            seedFeed(bot.getId());
            seedAttendance(gymId, bot.getId(), callerId);
        }
        return new BotDto(bot.getId(), bot.getUsername(), bot.getDisplayName(), gymId);
    }

    private User ensureBot() {
        return userRepository.findByEmail(BOT_EMAIL).orElseGet(() -> {
            User u = new User();
            u.setEmail(BOT_EMAIL);
            u.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            u.setDisplayName("BJJ Bot");
            u.setUsername(uniqueUsername("bjjbot"));
            u.setAge(28);
            u.setPro(true);
            u.setBot(true);
            u.setBio("Sou um bot de teste 🤖 Treine, me siga, comente e me mande mensagem!");
            u = userRepository.save(u);

            BeltRank rank = beltRankRepository.findBySlug("adult-purple").orElse(null);
            if (rank != null) {
                UserBeltProgress p = new UserBeltProgress();
                p.setUserId(u.getId());
                p.setBeltRank(rank);
                p.setStripes(2);
                beltProgressRepository.save(p);
            }
            return u;
        });
    }

    private String uniqueUsername(String base) {
        String candidate = base;
        int n = 1;
        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            candidate = base + n++;
        }
        return candidate;
    }

    private void seedFeed(Long botId) {
        LocalDate today = LocalDate.now();
        String[] types = { "NOGI", "GI", "OPEN_MAT" };
        String[] notes = {
                "Rolei pesado hoje, foco em raspagem 🔥",
                "Drill de passagem de guarda + sparring leve",
                "Open mat de domingo, muita troca boa!",
        };
        String[][] hits = { { "ARMBAR", "TRIANGLE" }, { "REAR_NAKED_CHOKE" }, { "KIMURA", "GUILLOTINE" } };
        for (int i = 0; i < types.length; i++) {
            CheckIn c = new CheckIn();
            c.setUserId(botId);
            c.setCheckDate(today.minusDays(i));
            c.setSessionType(types[i]);
            c.setDurationMinutes(90);
            c.setVisibility("PUBLIC");
            c.setNotes(notes[i]);
            c = checkInRepository.save(c);
            for (String sub : hits[i]) {
                SubmissionLog s = new SubmissionLog();
                s.setUserId(botId);
                s.setCheckInId(c.getId());
                s.setSubmission(sub);
                s.setDirection("HIT");
                s.setQty(1);
                s.setOccurredAt(c.getCheckDate());
                submissionLogRepository.save(s);
            }
        }
    }

    private void seedAttendance(Long gymId, Long botId, Long instructorId) {
        LocalDate today = LocalDate.now();
        GymClass gc = new GymClass();
        gc.setGymId(gymId);
        gc.setName("Aula de teste");
        gc.setInstructorUserId(instructorId);
        gc.setDayOfWeek(today.getDayOfWeek().getValue());
        gc.setStartTime(LocalTime.of(19, 0));
        gc.setEndTime(LocalTime.of(20, 30));
        gc.setSessionType(SessionType.GI);
        gc.setRestrictionMode(RestrictionMode.ALL);
        gc.setActive(true);
        gc = gymClassRepository.save(gc);
        for (int d : new int[] { 0, 2, 4, 7, 9 }) {
            ClassAttendance a = new ClassAttendance();
            a.setGymClassId(gc.getId());
            a.setClassDate(today.minusDays(d));
            a.setUserId(botId);
            a.setStatus("PRESENT");
            a.setMarkedByUserId(instructorId);
            classAttendanceRepository.save(a);
        }
    }
}
