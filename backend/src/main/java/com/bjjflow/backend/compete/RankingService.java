package com.bjjflow.backend.compete;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.checkins.CheckInRepository;
import com.bjjflow.backend.compete.CompeteDtos.MyRatingDto;
import com.bjjflow.backend.compete.CompeteDtos.PlayerDto;
import com.bjjflow.backend.compete.CompeteDtos.RankingDto;
import com.bjjflow.backend.compete.CompeteDtos.RankingEntryDto;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.social.FollowRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

/** Rankings by rating ("Minha academia" and "Seguindo") and the member's own rating summary. */
@Service
@RequiredArgsConstructor
public class RankingService {

    public static final String SCOPE_GYM = "gym";
    public static final String SCOPE_FOLLOWING = "following";
    private static final int MAX_ENTRIES = 500;

    private final GymMemberRepository gymMemberRepository;
    private final FollowRepository followRepository;
    private final UserRepository userRepository;
    private final CheckInRepository checkInRepository;
    private final MatchRepository matchRepository;
    private final RatingService ratingService;
    private final Players players;

    @Transactional(readOnly = true)
    public RankingDto ranking(Long me, String scope) {
        Instant now = Instant.now();
        Set<Long> ids = new LinkedHashSet<>();
        if (SCOPE_FOLLOWING.equals(scope)) {
            ids.add(me);
            ids.addAll(followRepository.findFollowingIds(me));
        } else {
            GymMember mine = gymMemberRepository.findFirstByUserId(me).orElse(null);
            if (mine == null) {
                return new RankingDto(SCOPE_GYM, false, List.of());
            }
            gymMemberRepository.findAllByGymId(mine.getGymId()).forEach(m -> ids.add(m.getUserId()));
            scope = SCOPE_GYM;
        }
        // Child profiles the gym manages have no app: they aren't ranked.
        List<Long> playable = userRepository.findAllById(ids).stream()
                .filter(u -> !Boolean.TRUE.equals(u.getManaged()))
                .map(User::getId)
                .toList();
        Map<Long, PlayerDto> p = players.of(playable);
        Map<Long, Integer> month = ratingService.monthDeltas(playable, now);

        List<PlayerDto> sorted = new ArrayList<>(p.values());
        sorted.sort(Comparator.comparingInt(PlayerDto::rating).reversed()
                .thenComparing(PlayerDto::displayName, String.CASE_INSENSITIVE_ORDER));
        List<RankingEntryDto> entries = new ArrayList<>();
        for (PlayerDto player : sorted) {
            if (entries.size() >= MAX_ENTRIES) {
                break;
            }
            entries.add(new RankingEntryDto(entries.size() + 1, player, month.getOrDefault(player.id(), 0),
                    player.id().equals(me)));
        }
        return new RankingDto(scope, true, entries);
    }

    @Transactional(readOnly = true)
    public MyRatingDto me(Long me) {
        Instant now = Instant.now();
        int rating = ratingService.rating(me);
        int month = ratingService.monthDeltas(List.of(me), now).getOrDefault(me, 0);

        Integer position = null;
        Integer size = null;
        RankingDto gym = ranking(me, SCOPE_GYM);
        if (gym.available()) {
            size = gym.entries().size();
            position = gym.entries().stream().filter(RankingEntryDto::me).map(RankingEntryDto::position)
                    .findFirst().orElse(null);
        }

        LocalDate monday = Compete.today(now).with(DayOfWeek.MONDAY);
        int weekDays = (int) checkInRepository.countDistinctDays(me, monday, monday.plusDays(6));
        return new MyRatingDto(rating, month, position, size, weekDays, ratingService.weeklyGoal(me),
                ratingService.weekBonusEarned(me, monday), ratingService.acceptsChallenges(me),
                (int) matchRepository.countForUser(me, MatchService.OPEN));
    }
}
