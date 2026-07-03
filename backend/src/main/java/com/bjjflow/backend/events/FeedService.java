package com.bjjflow.backend.events;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.belts.BeltPromotion;
import com.bjjflow.backend.belts.BeltPromotionRepository;
import com.bjjflow.backend.belts.BeltRank;
import com.bjjflow.backend.belts.BeltRankRepository;
import com.bjjflow.backend.checkins.CheckInRepository;
import com.bjjflow.backend.events.EventDtos.ActivityItemDto;
import com.bjjflow.backend.events.EventDtos.BeltProgressDto;
import com.bjjflow.backend.events.EventDtos.JourneyDto;
import com.bjjflow.backend.events.EventDtos.LogCompetitionRequest;
import com.bjjflow.backend.events.EventDtos.TimelineItemDto;
import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymMember;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRepository;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserBeltProgress;
import com.bjjflow.backend.users.UserBeltProgressRepository;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FeedService {

    private static final int ACTIVITY_LIMIT = 12;
    private static final int NEW_MEMBER_LIMIT = 10;

    private final GymMemberRepository gymMemberRepository;
    private final GymRepository gymRepository;
    private final BeltPromotionRepository beltPromotionRepository;
    private final BeltRankRepository beltRankRepository;
    private final UserRepository userRepository;
    private final UserBeltProgressRepository beltProgressRepository;
    private final CheckInRepository checkInRepository;
    private final UserEventRepository userEventRepository;
    private final UserEventService userEventService;

    /** Academy community feed: derived promotions + new members merged with stored events. */
    @Transactional(readOnly = true)
    public List<ActivityItemDto> activity(Long userId) {
        Optional<GymMember> mine = gymMemberRepository.findFirstByUserId(userId);
        if (mine.isEmpty()) {
            return List.of();
        }
        Long gymId = mine.get().getGymId();

        List<BeltPromotion> promos = beltPromotionRepository.findTop20ByGymIdOrderByCreatedAtDesc(gymId);
        List<GymMember> members = gymMemberRepository.findAllByGymId(gymId);
        List<UserEvent> events = userEventRepository.findTop20ByGymIdOrderByOccurredAtDesc(gymId);

        Set<Long> ids = new HashSet<>();
        promos.forEach(p -> ids.add(p.getUserId()));
        members.forEach(m -> ids.add(m.getUserId()));
        events.forEach(e -> ids.add(e.getUserId()));
        Map<Long, String> names = batchNames(ids);
        Map<Long, BeltRank> ranks = ranksByIds(promos.stream().map(BeltPromotion::getBeltRankId).toList());

        List<ActivityItemDto> items = new ArrayList<>();
        for (BeltPromotion p : promos) {
            BeltRank rank = ranks.get(p.getBeltRankId());
            items.add(new ActivityItemDto(EventType.BELT_PROMOTION, p.getUserId(), names.get(p.getUserId()),
                    rank == null ? null : rank.getSlug(), p.getStripes(),
                    rank == null ? null : rank.getNamePt(), p.getCreatedAt()));
        }
        members.stream()
                .filter(m -> m.getJoinedAt() != null)
                .sorted(Comparator.comparing(GymMember::getJoinedAt).reversed())
                .limit(NEW_MEMBER_LIMIT)
                .forEach(m -> items.add(new ActivityItemDto(EventType.NEW_MEMBER, m.getUserId(),
                        names.get(m.getUserId()), null, null, null, m.getJoinedAt())));
        for (UserEvent e : events) {
            items.add(new ActivityItemDto(e.getType(), e.getUserId(), names.get(e.getUserId()),
                    e.getBeltSlug(), e.getValue(), e.getText(), e.getOccurredAt()));
        }

        return items.stream()
                .sorted(Comparator.comparing(ActivityItemDto::occurredAt).reversed())
                .limit(ACTIVITY_LIMIT)
                .toList();
    }

    /** Personal journey timeline + current belt progress. */
    @Transactional(readOnly = true)
    public JourneyDto journey(Long userId) {
        List<TimelineItemDto> timeline = new ArrayList<>();

        LocalDate first = checkInRepository.minCheckDate(userId);
        if (first != null) {
            timeline.add(new TimelineItemDto(EventType.FIRST_TRAINING, null, null, null, toInstant(first)));
        }

        List<BeltPromotion> promos = beltPromotionRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        Map<Long, BeltRank> ranks = ranksByIds(promos.stream().map(BeltPromotion::getBeltRankId).toList());
        for (BeltPromotion p : promos) {
            BeltRank rank = ranks.get(p.getBeltRankId());
            timeline.add(new TimelineItemDto(EventType.BELT_PROMOTION, p.getStripes(),
                    rank == null ? null : rank.getNamePt(), rank == null ? null : rank.getSlug(), p.getCreatedAt()));
        }

        gymMemberRepository.findFirstByUserId(userId)
                .filter(m -> m.getJoinedAt() != null)
                .ifPresent(m -> {
                    String gymName = gymRepository.findById(m.getGymId()).map(Gym::getName).orElse(null);
                    timeline.add(new TimelineItemDto(EventType.ACADEMY_JOINED, null, gymName, null, m.getJoinedAt()));
                });

        for (UserEvent e : userEventRepository.findTop20ByUserIdOrderByOccurredAtDesc(userId)) {
            timeline.add(new TimelineItemDto(e.getType(), e.getValue(), e.getText(), e.getBeltSlug(), e.getOccurredAt()));
        }

        timeline.sort(Comparator.comparing(TimelineItemDto::occurredAt).reversed());

        return new JourneyDto(timeline, beltProgress(userId, promos, first));
    }

    @Transactional
    public JourneyDto logCompetition(Long userId, LogCompetitionRequest req) {
        Long gymId = gymMemberRepository.findFirstByUserId(userId).map(GymMember::getGymId).orElse(null);
        userEventService.record(userId, gymId, EventType.COMPETITION_RESULT, req.placement(), req.name().trim(),
                null, toInstant(req.date()));
        return journey(userId);
    }

    private BeltProgressDto beltProgress(Long userId, List<BeltPromotion> promos, LocalDate firstTraining) {
        UserBeltProgress prog = beltProgressRepository.findByUserId(userId).orElse(null);
        if (prog == null) {
            return null;
        }
        BeltRank rank = prog.getBeltRank();
        Instant beltSince = promos.isEmpty() ? null : promos.get(0).getCreatedAt();
        long trainingsSinceBelt;
        if (beltSince != null) {
            trainingsSinceBelt = checkInRepository.countByUserIdAndCheckDateGreaterThanEqual(
                    userId, LocalDate.ofInstant(beltSince, ZoneOffset.UTC));
        } else {
            trainingsSinceBelt = checkInRepository.countByUserId(userId);
        }
        return new BeltProgressDto(rank.getSlug(), rank.getNamePt(), rank.getColorHex(), prog.getStripes(),
                beltSince, trainingsSinceBelt);
    }

    private Map<Long, String> batchNames(Collection<Long> ids) {
        Map<Long, String> map = new HashMap<>();
        for (User u : userRepository.findAllById(ids)) {
            map.put(u.getId(), u.getDisplayName());
        }
        return map;
    }

    private Map<Long, BeltRank> ranksByIds(Collection<Long> ids) {
        Map<Long, BeltRank> map = new HashMap<>();
        for (BeltRank r : beltRankRepository.findAllById(ids)) {
            map.put(r.getId(), r);
        }
        return map;
    }

    private static Instant toInstant(LocalDate date) {
        return date.atStartOfDay(ZoneOffset.UTC).toInstant();
    }
}
