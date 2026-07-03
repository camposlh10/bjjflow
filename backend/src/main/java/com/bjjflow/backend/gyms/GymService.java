package com.bjjflow.backend.gyms;

import java.security.SecureRandom;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.belts.BeltPromotion;
import com.bjjflow.backend.belts.BeltPromotionRepository;
import com.bjjflow.backend.belts.BeltRank;
import com.bjjflow.backend.belts.BeltRankRepository;
import com.bjjflow.backend.classes.ClassAttendanceRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.GymDtos.BeltSummary;
import com.bjjflow.backend.gyms.GymDtos.GymDto;
import com.bjjflow.backend.gyms.GymDtos.GymSuggestionDto;
import com.bjjflow.backend.gyms.GymDtos.MemberDto;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserBeltProgress;
import com.bjjflow.backend.users.UserBeltProgressRepository;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GymService {

    private static final int MAX_SUGGESTIONS = 10;
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GymRepository gymRepository;
    private final GymMemberRepository gymMemberRepository;
    private final UserRepository userRepository;
    private final UserBeltProgressRepository beltProgressRepository;
    private final BeltRankRepository beltRankRepository;
    private final BeltPromotionRepository beltPromotionRepository;
    private final ClassAttendanceRepository classAttendanceRepository;
    private final GymPhotoRepository gymPhotoRepository;
    private final GymReviewRepository gymReviewRepository;
    private final GymMedalRepository gymMedalRepository;
    private final GymVerificationRepository gymVerificationRepository;
    private final GymVerificationMediaRepository gymVerificationMediaRepository;
    private final com.bjjflow.backend.storage.MediaStorage mediaStorage;
    private final com.bjjflow.backend.notifications.NotificationService notificationService;

    @Transactional
    public GymDto createGym(Long userId, String name, String city, String description) {
        requireNoGym(userId);

        Gym gym = new Gym();
        gym.setName(name.trim());
        gym.setCity(city == null || city.isBlank() ? null : city.trim());
        gym.setDescription(description == null || description.isBlank() ? null : description.trim());
        gym.setGraduationTarget(40);
        gym.setInviteCode(generateUniqueCode());
        gym = gymRepository.save(gym);

        addMember(gym.getId(), userId, GymRole.OWNER);
        return toGymDto(gym, GymRole.OWNER);
    }

    @Transactional
    public GymDto joinByCode(Long userId, String inviteCode) {
        requireNoGym(userId);
        Gym gym = gymRepository.findByInviteCode(inviteCode.trim().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVALID_INVITE_CODE",
                        "No gym matches this invite code"));
        addMember(gym.getId(), userId, GymRole.MEMBER);

        // Tell the gym's staff (owner + instructors) that a new student joined.
        String name = userRepository.findById(userId).map(x -> x.getDisplayName()).orElse("Um novo aluno");
        for (GymMember staff : gymMemberRepository.findAllByGymId(gym.getId())) {
            if (staff.getRole() != GymRole.MEMBER && !staff.getUserId().equals(userId)) {
                notificationService.notify(staff.getUserId(),
                        com.bjjflow.backend.notifications.NotificationType.ACADEMY, name,
                        "entrou na sua academia.", "user:" + userId);
            }
        }
        return toGymDto(gym, GymRole.MEMBER);
    }

    @Transactional
    public void leaveGym(Long userId) {
        GymMember member = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
        gymMemberRepository.delete(member);
    }

    // TEMP testing aid: lets a user flip their own role to exercise member vs
    // instructor/owner features with a single account. Remove (or gate behind a
    // dev profile) before production — real promotions go through an owner.
    @Transactional
    public GymDto setMyRole(Long userId, String roleName) {
        GymMember member = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
        GymRole role;
        try {
            role = GymRole.valueOf(roleName.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "Unknown role");
        }
        member.setRole(role);
        gymMemberRepository.save(member);
        Gym gym = gymRepository.findById(member.getGymId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GYM_NOT_FOUND", "Gym not found"));
        return toGymDto(gym, role);
    }

    @Transactional(readOnly = true)
    public Optional<GymDto> getMyGym(Long userId) {
        return gymMemberRepository.findFirstByUserId(userId)
                .flatMap(m -> gymRepository.findById(m.getGymId())
                        .map(gym -> toGymDto(gym, m.getRole())));
    }

    @Transactional(readOnly = true)
    public List<MemberDto> listMembers(Long userId) {
        GymMember mine = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));

        // Batched: a fixed number of queries regardless of member count
        // (was O(N) queries — user, belt, promotion and attendance per member).
        List<GymMember> members = gymMemberRepository.findAllByGymId(mine.getGymId());
        List<Long> ids = members.stream().map(GymMember::getUserId).toList();
        java.util.Map<Long, String> names = batchNames(ids);
        java.util.Map<Long, BeltSummary> belts = batchBelts(members);
        java.util.Map<Long, java.time.Instant> lastPromos = batchLastPromotions(ids);
        java.util.Map<Long, Long> attended = new java.util.HashMap<>();
        for (Object[] row : classAttendanceRepository.attendanceTimesForGym(mine.getGymId())) {
            Long uid = (Long) row[0];
            java.time.Instant at = (java.time.Instant) row[1];
            if (at.isAfter(lastPromos.getOrDefault(uid, java.time.Instant.EPOCH))) {
                attended.merge(uid, 1L, Long::sum);
            }
        }

        return members.stream()
                .map(m -> new MemberDto(m.getUserId(), names.getOrDefault(m.getUserId(), "—"),
                        m.getRole().name(), belts.get(m.getUserId()),
                        attended.getOrDefault(m.getUserId(), 0L)))
                .sorted(Comparator
                        .comparingInt((MemberDto m) -> rolePriority(m.role()))
                        .thenComparing(MemberDto::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private java.util.Map<Long, String> batchNames(List<Long> ids) {
        java.util.Map<Long, String> map = new java.util.HashMap<>();
        for (User u : userRepository.findAllById(ids)) {
            map.put(u.getId(), u.getDisplayName());
        }
        return map;
    }

    private java.util.Map<Long, BeltSummary> batchBelts(List<GymMember> members) {
        // The gym's local belt where it has graded the member; otherwise the
        // member's profile belt (user_belt_progress). Batched to a fixed query count.
        List<Long> rankIds = members.stream()
                .map(GymMember::getBeltRankId).filter(java.util.Objects::nonNull).distinct().toList();
        java.util.Map<Long, BeltRank> ranks = new java.util.HashMap<>();
        for (BeltRank r : beltRankRepository.findAllById(rankIds)) {
            ranks.put(r.getId(), r);
        }
        List<Long> ids = members.stream().map(GymMember::getUserId).toList();
        java.util.Map<Long, BeltSummary> profileBelts = new java.util.HashMap<>();
        for (UserBeltProgress p : beltProgressRepository.findAllByUserIdIn(ids)) {
            profileBelts.put(p.getUserId(), toBeltSummary(p));
        }
        java.util.Map<Long, BeltSummary> map = new java.util.HashMap<>();
        for (GymMember m : members) {
            BeltSummary belt = gymLocalBelt(m, ranks.get(m.getBeltRankId()));
            if (belt == null) {
                belt = profileBelts.get(m.getUserId());
            }
            if (belt != null) {
                map.put(m.getUserId(), belt);
            }
        }
        return map;
    }

    /** Belt the gym assigned this member, or null if it hasn't graded them yet. */
    private BeltSummary gymLocalBelt(GymMember m, BeltRank rank) {
        if (m.getBeltRankId() == null || rank == null) {
            return null;
        }
        int stripes = m.getStripes() == null ? 0 : m.getStripes();
        return new BeltSummary(rank.getSlug(), rank.getNamePt(), rank.getColorHex(), stripes);
    }

    private java.util.Map<Long, java.time.Instant> batchLastPromotions(List<Long> ids) {
        // rows come ordered by createdAt desc; keep only the newest per user
        java.util.Map<Long, java.time.Instant> map = new java.util.HashMap<>();
        for (BeltPromotion p : beltPromotionRepository.findAllByUserIdInOrderByCreatedAtDesc(ids)) {
            map.putIfAbsent(p.getUserId(), p.getCreatedAt());
        }
        return map;
    }

    @Transactional
    public MemberDto promoteMember(Long callerId, Long targetUserId, String beltSlug, Integer stripes) {
        GymMember caller = gymMemberRepository.findFirstByUserId(callerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
        if (caller.getRole() == GymRole.MEMBER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_STAFF", "Only instructors can promote");
        }
        GymMember target = gymMemberRepository.findByGymIdAndUserId(caller.getGymId(), targetUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "NOT_A_MEMBER",
                        "That user is not in this gym"));

        BeltRank rank = beltRankRepository.findBySlug(beltSlug)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BELT", "Unknown belt"));
        int newStripes = stripes == null ? 0 : stripes;
        if (newStripes > rank.getMaxStripes()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STRIPES",
                    "This belt allows at most " + rank.getMaxStripes() + " stripes");
        }

        // The gym's local belt for this member always updates.
        target.setBeltRankId(rank.getId());
        target.setStripes(newStripes);
        gymMemberRepository.save(target);

        // The member's public profile belt updates only if they allow gym sync.
        boolean syncToProfile = userRepository.findById(targetUserId)
                .map(u -> !Boolean.FALSE.equals(u.getGymBeltSync()))
                .orElse(true);
        if (syncToProfile) {
            UserBeltProgress progress = beltProgressRepository.findByUserId(targetUserId)
                    .orElseGet(() -> {
                        UserBeltProgress p = new UserBeltProgress();
                        p.setUserId(targetUserId);
                        return p;
                    });
            progress.setBeltRank(rank);
            progress.setStripes(newStripes);
            beltProgressRepository.save(progress);
        }

        BeltPromotion promotion = new BeltPromotion();
        promotion.setUserId(targetUserId);
        promotion.setGymId(caller.getGymId());
        promotion.setBeltRankId(rank.getId());
        promotion.setStripes(newStripes);
        promotion.setPromotedByUserId(callerId);
        beltPromotionRepository.save(promotion);

        notificationService.notify(targetUserId, com.bjjflow.backend.notifications.NotificationType.ACADEMY,
                "Você foi graduado! 🥋", "Parabéns! Nova faixa: " + rank.getNamePt() + ".", "user:" + callerId);

        return toMemberDto(target, caller.getGymId());
    }

    @Transactional(readOnly = true)
    public List<GymSuggestionDto> suggestions(Long userId) {
        // One primary gym: once you're in one, we stop suggesting others.
        if (gymMemberRepository.findFirstByUserId(userId).isPresent()) {
            return List.of();
        }
        String city = userRepository.findById(userId).map(User::getCity).orElse(null);
        List<Gym> gyms = city == null || city.isBlank()
                ? gymRepository.findAll()
                : gymRepository.findAllByCityIgnoreCase(city);
        if (gyms.isEmpty()) {
            gyms = gymRepository.findAll();
        }
        return gyms.stream()
                .map(g -> new GymSuggestionDto(g.getId(), g.getName(), g.getCity(),
                        gymMemberRepository.countByGymId(g.getId())))
                .sorted(Comparator.comparingLong(GymSuggestionDto::memberCount).reversed())
                .limit(MAX_SUGGESTIONS)
                .toList();
    }

    private void requireNoGym(Long userId) {
        if (gymMemberRepository.findFirstByUserId(userId).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_IN_GYM", "You already belong to a gym");
        }
    }

    private void addMember(Long gymId, Long userId, GymRole role) {
        GymMember member = new GymMember();
        member.setGymId(gymId);
        member.setUserId(userId);
        member.setRole(role);
        gymMemberRepository.save(member);
    }

    private GymDto toGymDto(Gym gym, GymRole role) {
        boolean staff = role == GymRole.OWNER || role == GymRole.INSTRUCTOR;
        List<GymDtos.GymPhotoDto> photos = gymPhotoRepository.findAllByGymIdOrderByPositionAsc(gym.getId())
                .stream()
                .map(p -> new GymDtos.GymPhotoDto(p.getId(), mediaStorage.urlFor(p.getStorageKey())))
                .toList();
        List<GymDtos.MedalDto> medals = gymMedalRepository.findAllByGymIdOrderByPositionAsc(gym.getId())
                .stream()
                .map(m -> new GymDtos.MedalDto(m.getId(), m.getCompetition(), m.getTier(),
                        m.getCount() == null ? 1 : m.getCount()))
                .toList();
        return new GymDto(
                gym.getId(),
                gym.getName(),
                gym.getCity(),
                gym.getDescription(),
                gymMemberRepository.countByGymId(gym.getId()),
                role.name(),
                gym.getGraduationTarget(),
                Boolean.TRUE.equals(gym.getInstructorsOnlyPosts()),
                staff ? gym.getInviteCode() : null,
                gym.getPhone(),
                gym.getEmail(),
                gym.getWebsite(),
                gym.getAddress(),
                gym.getLogoKey() == null ? null : mediaStorage.urlFor(gym.getLogoKey()),
                photos,
                Boolean.TRUE.equals(gym.getVerified()),
                gym.getInstagram(),
                gym.getFacebook(),
                gym.getWhatsapp(),
                gym.getYoutube(),
                gym.getGooglePlaceId(),
                medals,
                gym.getCreatedAt(),
                buildVerificationDto(gym.getId(), role));
    }

    /**
     * Public when approved (so the certificate is a credibility signal); the
     * owner additionally sees pending/rejected status + review notes. Hidden
     * from everyone else while not approved.
     */
    private GymDtos.VerificationDto buildVerificationDto(Long gymId, GymRole role) {
        GymVerification v = gymVerificationRepository.findByGymId(gymId).orElse(null);
        if (v == null) {
            return null;
        }
        boolean approved = "APPROVED".equals(v.getStatus());
        boolean owner = role == GymRole.OWNER;
        if (!approved && !owner) {
            return null;
        }
        List<GymVerificationMedia> media = gymVerificationMediaRepository
                .findAllByVerificationIdOrderByPositionAsc(v.getId());
        String certUrl = media.stream()
                .filter(m -> "CERTIFICATE".equals(m.getKind()))
                .findFirst()
                .map(m -> mediaStorage.urlFor(m.getStorageKey()))
                .orElse(null);
        List<String> estUrls = media.stream()
                .filter(m -> "ESTABLISHMENT".equals(m.getKind()))
                .map(m -> mediaStorage.urlFor(m.getStorageKey()))
                .toList();
        return new GymDtos.VerificationDto(
                v.getStatus(),
                Cnpj.format(v.getCnpj()),
                certUrl,
                estUrls,
                owner ? v.getReviewNotes() : null);
    }

    @Transactional
    public GymDto updateRules(Long userId, Integer graduationTarget, Boolean instructorsOnlyPosts) {
        GymMember membership = requireOwner(userId);
        Gym gym = gymRepository.findById(membership.getGymId()).orElseThrow();
        if (graduationTarget != null) {
            gym.setGraduationTarget(graduationTarget);
        }
        if (instructorsOnlyPosts != null) {
            gym.setInstructorsOnlyPosts(instructorsOnlyPosts);
        }
        gymRepository.save(gym);
        return toGymDto(gym, membership.getRole());
    }

    @Transactional
    public GymDto updateGym(Long userId, GymDtos.UpdateGymRequest req) {
        GymMember membership = requireOwner(userId);
        Gym gym = gymRepository.findById(membership.getGymId()).orElseThrow();
        gym.setName(req.name().trim());
        gym.setCity(blankToNull(req.city()));
        gym.setDescription(blankToNull(req.description()));
        if (req.graduationTarget() != null) {
            gym.setGraduationTarget(req.graduationTarget());
        }
        if (req.instructorsOnlyPosts() != null) {
            gym.setInstructorsOnlyPosts(req.instructorsOnlyPosts());
        }
        gym.setPhone(blankToNull(req.phone()));
        gym.setEmail(blankToNull(req.email()));
        gym.setWebsite(blankToNull(req.website()));
        gym.setAddress(blankToNull(req.address()));
        if (req.logoKey() != null && !req.logoKey().isBlank()) {
            gym.setLogoKey(req.logoKey());
        }
        gym.setInstagram(blankToNull(req.instagram()));
        gym.setFacebook(blankToNull(req.facebook()));
        gym.setWhatsapp(blankToNull(req.whatsapp()));
        gym.setYoutube(blankToNull(req.youtube()));
        gym.setGooglePlaceId(blankToNull(req.googlePlaceId()));
        gymRepository.save(gym);
        return toGymDto(gym, membership.getRole());
    }

    // TEMP testing aid: toggles the verified badge so it can be previewed.
    // Real verification will be an admin-side process — remove before prod.
    @Transactional
    public GymDto toggleVerified(Long userId) {
        GymMember membership = requireOwner(userId);
        Gym gym = gymRepository.findById(membership.getGymId()).orElseThrow();
        gym.setVerified(!Boolean.TRUE.equals(gym.getVerified()));
        gymRepository.save(gym);
        return toGymDto(gym, membership.getRole());
    }

    private static final java.util.Set<String> MEDAL_TIERS = java.util.Set.of("GOLD", "SILVER", "BRONZE");

    // Replaces the gym's full medal showcase in one shot — the editor sends the
    // whole list, so we wipe and re-insert rather than diffing.
    @Transactional
    public GymDto replaceMedals(Long userId, List<GymDtos.MedalInput> medals) {
        GymMember membership = requireOwner(userId);
        Long gymId = membership.getGymId();
        gymMedalRepository.deleteByGymId(gymId);

        List<GymDtos.MedalInput> input = medals == null ? List.of() : medals;
        int position = 0;
        for (GymDtos.MedalInput m : input) {
            String tier = m.tier() == null ? "" : m.tier().trim().toUpperCase(Locale.ROOT);
            if (!MEDAL_TIERS.contains(tier)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIER",
                        "Medal tier must be GOLD, SILVER or BRONZE");
            }
            GymMedal medal = new GymMedal();
            medal.setGymId(gymId);
            medal.setCompetition(m.competition().trim());
            medal.setTier(tier);
            medal.setCount(m.count());
            medal.setPosition(position++);
            gymMedalRepository.save(medal);
        }
        Gym gym = gymRepository.findById(gymId).orElseThrow();
        return toGymDto(gym, membership.getRole());
    }

    @Transactional
    public GymDtos.GymPhotoDto addPhoto(Long userId, String key) {
        GymMember membership = requireOwner(userId);
        GymPhoto photo = new GymPhoto();
        photo.setGymId(membership.getGymId());
        photo.setStorageKey(key);
        photo.setPosition((int) gymPhotoRepository.countByGymId(membership.getGymId()));
        photo = gymPhotoRepository.save(photo);
        return new GymDtos.GymPhotoDto(photo.getId(), mediaStorage.urlFor(photo.getStorageKey()));
    }

    @Transactional
    public void deletePhoto(Long userId, Long photoId) {
        GymMember membership = requireOwner(userId);
        GymPhoto photo = gymPhotoRepository.findById(photoId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PHOTO_NOT_FOUND", "Photo not found"));
        if (!photo.getGymId().equals(membership.getGymId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PHOTO_NOT_FOUND", "Photo not found");
        }
        gymPhotoRepository.delete(photo);
    }

    /**
     * Gym leaderboard by verified class attendance only (deliberately decoupled
     * from the home-screen streak data). All-time PRESENT count per member.
     */
    @Transactional(readOnly = true)
    public List<GymDtos.RankingEntryDto> ranking(Long userId) {
        GymMember mine = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
        List<GymMember> members = gymMemberRepository.findAllByGymId(mine.getGymId());
        List<Long> ids = members.stream().map(GymMember::getUserId).toList();

        java.util.Map<Long, String> names = batchNames(ids);
        java.util.Map<Long, BeltSummary> belts = batchBelts(members);
        java.util.Map<Long, Long> counts = new java.util.HashMap<>();
        for (Object[] row : classAttendanceRepository.attendanceTimesForGym(mine.getGymId())) {
            counts.merge((Long) row[0], 1L, Long::sum);
        }

        List<GymDtos.RankingEntryDto> ranked = new java.util.ArrayList<>();
        members.stream()
                .sorted(Comparator
                        .comparingLong((GymMember m) -> counts.getOrDefault(m.getUserId(), 0L)).reversed()
                        .thenComparing(m -> names.getOrDefault(m.getUserId(), ""),
                                String.CASE_INSENSITIVE_ORDER))
                .forEach(m -> ranked.add(new GymDtos.RankingEntryDto(
                        ranked.size() + 1,
                        m.getUserId(),
                        names.getOrDefault(m.getUserId(), "—"),
                        belts.get(m.getUserId()),
                        counts.getOrDefault(m.getUserId(), 0L))));
        return ranked;
    }

    @Transactional(readOnly = true)
    public GymDtos.ReviewsDto listReviews(Long userId) {
        GymMember mine = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
        return buildReviewsDto(mine.getGymId(), userId);
    }

    @Transactional
    public GymDtos.ReviewsDto upsertReview(Long userId, int rating, String comment) {
        GymMember mine = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
        GymReview review = gymReviewRepository.findByGymIdAndUserId(mine.getGymId(), userId)
                .orElseGet(() -> {
                    GymReview r = new GymReview();
                    r.setGymId(mine.getGymId());
                    r.setUserId(userId);
                    return r;
                });
        review.setRating(rating);
        review.setComment(blankToNull(comment));
        gymReviewRepository.save(review);
        return buildReviewsDto(mine.getGymId(), userId);
    }

    private GymDtos.ReviewsDto buildReviewsDto(Long gymId, Long userId) {
        List<GymReview> reviews = gymReviewRepository.findAllByGymIdOrderByCreatedAtDesc(gymId);
        java.util.Map<Long, String> names = batchNames(reviews.stream().map(GymReview::getUserId).toList());

        long count = reviews.size();
        double average = count == 0 ? 0 : reviews.stream().mapToInt(GymReview::getRating).average().orElse(0);

        GymReview mine = reviews.stream().filter(r -> r.getUserId().equals(userId)).findFirst().orElse(null);

        List<GymDtos.ReviewDto> reviewDtos = reviews.stream()
                .map(r -> new GymDtos.ReviewDto(r.getId(), r.getUserId(),
                        names.getOrDefault(r.getUserId(), "—"), r.getRating(), r.getComment(), r.getCreatedAt()))
                .toList();

        GymDtos.ReviewSummaryDto summary = new GymDtos.ReviewSummaryDto(
                average, count,
                mine == null ? null : mine.getRating(),
                mine == null ? null : mine.getComment());

        return new GymDtos.ReviewsDto(summary, reviewDtos);
    }

    private GymMember requireOwner(Long userId) {
        GymMember m = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "You are not in a gym"));
        if (m.getRole() != GymRole.OWNER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_OWNER", "Only the gym owner can do this");
        }
        return m;
    }

    private String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private MemberDto toMemberDto(GymMember member, Long gymId) {
        String displayName = userRepository.findById(member.getUserId())
                .map(User::getDisplayName)
                .orElse("—");
        BeltSummary belt = member.getBeltRankId() != null
                ? gymLocalBelt(member, beltRankRepository.findById(member.getBeltRankId()).orElse(null))
                : null;
        if (belt == null) {
            belt = beltProgressRepository.findByUserId(member.getUserId())
                    .map(this::toBeltSummary)
                    .orElse(null);
        }
        // Graduation counter: verified class attendances since the last promotion
        java.time.Instant since = beltPromotionRepository
                .findFirstByUserIdOrderByCreatedAtDesc(member.getUserId())
                .map(BeltPromotion::getCreatedAt)
                .orElse(java.time.Instant.EPOCH);
        long attended = classAttendanceRepository.countForUserInGymSince(gymId, member.getUserId(), since);
        return new MemberDto(member.getUserId(), displayName, member.getRole().name(), belt, attended);
    }

    private BeltSummary toBeltSummary(UserBeltProgress progress) {
        var rank = progress.getBeltRank();
        return new BeltSummary(rank.getSlug(), rank.getNamePt(), rank.getColorHex(), progress.getStripes());
    }

    private int rolePriority(String role) {
        return switch (role) {
            case "OWNER" -> 0;
            case "INSTRUCTOR" -> 1;
            default -> 2;
        };
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 25; attempt++) {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (gymRepository.findByInviteCode(code).isEmpty()) {
                return code;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "CODE_GEN_FAILED",
                "Could not generate a unique invite code");
    }
}
