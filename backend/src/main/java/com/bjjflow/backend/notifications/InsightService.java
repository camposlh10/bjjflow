package com.bjjflow.backend.notifications;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.submissions.SubmissionLogRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Data-driven "AI coach" insights generated from the athlete's own logs (submissions,
 * streaks). Rule-based for now; idempotent per day via a stable payload key so it
 * doesn't spam. This is where the app differentiates from generic social feeds.
 */
@Service
@RequiredArgsConstructor
public class InsightService {

    private static final Map<String, String> SUB_LABELS = Map.ofEntries(
            Map.entry("REAR_NAKED_CHOKE", "mata-leão"),
            Map.entry("GUILLOTINE", "guilhotina"),
            Map.entry("TRIANGLE", "triângulo"),
            Map.entry("ARMBAR", "armbar"),
            Map.entry("KIMURA", "kimura"),
            Map.entry("AMERICANA", "americana"),
            Map.entry("OMOPLATA", "omoplata"),
            Map.entry("BOW_AND_ARROW", "arco e flecha"),
            Map.entry("HEEL_HOOK", "chave de calcanhar"),
            Map.entry("OTHER", "outra finalização"));

    private final SubmissionLogRepository submissionLogRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    @Transactional
    public void refresh(Long userId) {
        User u = userRepository.findById(userId).orElse(null);
        if (u == null) {
            return;
        }
        YearMonth ym = YearMonth.now();
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();

        List<Object[]> landed = submissionLogRepository.aggregate(userId, "HIT", from, to);
        List<Object[]> conceded = submissionLogRepository.aggregate(userId, "CONCEDED", from, to);
        Object[] topLanded = top(landed);
        Object[] topConceded = top(conceded);

        if (topLanded != null) {
            long total = total(landed);
            int pct = total == 0 ? 0 : (int) Math.round(num(topLanded[1]) * 100.0 / total);
            emit(userId, "insight:top_landed", NotificationType.PERFORMANCE, "Seu ponto forte ⚡",
                    "Sua finalização mais aplicada neste mês é " + label((String) topLanded[0]) + " (" + pct + "%).");
        }
        if (topConceded != null) {
            emit(userId, "insight:top_conceded", NotificationType.PERFORMANCE, "Ponto de atenção 🎯",
                    "A maioria das finalizações que você sofreu veio de " + label((String) topConceded[0])
                            + ". Vale treinar a defesa essa semana.");
        }
        Integer streak = u.getCurrentStreak();
        if (streak != null && streak >= 3) {
            emit(userId, "insight:streak", NotificationType.TRAINING, "Sequência de " + streak + " dias 🔥",
                    "Você está consistente. Treine hoje para manter a sequência viva.");
        }
    }

    private void emit(Long userId, String payloadKey, NotificationType type, String title, String body) {
        Instant startOfDay = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant();
        if (notificationRepository.existsByUserIdAndPayloadAndCreatedAtAfter(userId, payloadKey, startOfDay)) {
            return;
        }
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type.name());
        n.setTitle(title);
        n.setBody(body);
        n.setPayload(payloadKey);
        notificationRepository.save(n);
    }

    private static String label(String key) {
        return SUB_LABELS.getOrDefault(key, key == null ? "" : key.toLowerCase().replace('_', ' '));
    }

    private static Object[] top(List<Object[]> rows) {
        return rows.stream().max(Comparator.comparingLong(r -> num(r[1]))).orElse(null);
    }

    private static long total(List<Object[]> rows) {
        return rows.stream().mapToLong(r -> num(r[1])).sum();
    }

    private static long num(Object o) {
        return ((Number) o).longValue();
    }
}
