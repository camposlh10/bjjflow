package com.bjjflow.backend.users;

import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.auth.AuthDtos.BeltDto;
import com.bjjflow.backend.belts.BeltRank;
import com.bjjflow.backend.belts.BeltRankRepository;
import com.bjjflow.backend.checkins.CheckInRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymDtos.GymPhotoDto;
import com.bjjflow.backend.gyms.GymDtos.MedalDto;
import com.bjjflow.backend.gyms.GymDtos.MedalInput;
import com.bjjflow.backend.gyms.GymMemberRepository;
import com.bjjflow.backend.gyms.GymRepository;
import com.bjjflow.backend.gyms.GymReview;
import com.bjjflow.backend.gyms.GymReviewRepository;
import com.bjjflow.backend.social.Follow;
import com.bjjflow.backend.social.FollowRepository;
import com.bjjflow.backend.users.ProfileDtos.GymSummaryDto;
import com.bjjflow.backend.users.ProfileDtos.MetricsDto;
import com.bjjflow.backend.users.ProfileDtos.SearchUserDto;
import com.bjjflow.backend.users.ProfileDtos.UpdateProfileRequest;
import com.bjjflow.backend.users.ProfileDtos.UserProfileDto;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private static final Set<String> MEDAL_TIERS = Set.of("GOLD", "SILVER", "BRONZE");

    private final UserRepository userRepository;
    private final UserBeltProgressRepository beltProgressRepository;
    private final BeltRankRepository beltRankRepository;
    private final UserMedalRepository userMedalRepository;
    private final UserPhotoRepository userPhotoRepository;
    private final FollowRepository followRepository;
    private final GymMemberRepository gymMemberRepository;
    private final GymRepository gymRepository;
    private final GymReviewRepository gymReviewRepository;
    private final CheckInRepository checkInRepository;
    private final FeedbackRepository feedbackRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.bjjflow.backend.storage.MediaStorage mediaStorage;
    private final com.bjjflow.backend.notifications.NotificationService notificationService;

    @Transactional(readOnly = true)
    public ProfileDtos.SettingsDto settings(Long userId) {
        User u = requireUser(userId);
        return new ProfileDtos.SettingsDto(u.getEmail(), u.getUsername(), Boolean.TRUE.equals(u.getPro()),
                Boolean.TRUE.equals(u.getPrivateAccount()), Boolean.TRUE.equals(u.getNotifyCommunity()),
                Boolean.TRUE.equals(u.getNotifyMessages()), Boolean.TRUE.equals(u.getNotifyPromotions()),
                Boolean.TRUE.equals(u.getMfaEnabled()), !Boolean.FALSE.equals(u.getGymBeltSync()));
    }

    @Transactional
    public ProfileDtos.SettingsDto updateSettings(Long userId, ProfileDtos.UpdateSettingsRequest req) {
        User u = requireUser(userId);
        if (req.privateAccount() != null) {
            u.setPrivateAccount(req.privateAccount());
        }
        if (req.notifyCommunity() != null) {
            u.setNotifyCommunity(req.notifyCommunity());
        }
        if (req.notifyMessages() != null) {
            u.setNotifyMessages(req.notifyMessages());
        }
        if (req.notifyPromotions() != null) {
            u.setNotifyPromotions(req.notifyPromotions());
        }
        if (req.gymBeltSync() != null) {
            u.setGymBeltSync(req.gymBeltSync());
        }
        userRepository.save(u);
        return settings(userId);
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User u = requireUser(userId);
        if (!passwordEncoder.matches(currentPassword, u.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WRONG_PASSWORD", "Current password is incorrect");
        }
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(u);
    }

    @Transactional
    public ProfileDtos.SettingsDto changeEmail(Long userId, String password, String newEmail) {
        User u = requireUser(userId);
        if (!passwordEncoder.matches(password, u.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WRONG_PASSWORD", "Password is incorrect");
        }
        String email = newEmail.trim().toLowerCase(Locale.ROOT);
        userRepository.findByEmail(email)
                .filter(other -> !other.getId().equals(userId))
                .ifPresent(other -> {
                    throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_USED", "Email is already registered");
                });
        u.setEmail(email);
        userRepository.save(u);
        return settings(userId);
    }

    @Transactional
    public void submitFeedback(Long userId, String message) {
        Feedback f = new Feedback();
        f.setUserId(userId);
        f.setMessage(message.trim());
        feedbackRepository.save(f);
    }

    @Transactional(readOnly = true)
    public List<SearchUserDto> search(String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 2) {
            return List.of();
        }
        List<User> users = userRepository.search(q, PageRequest.of(0, 20));
        if (users.isEmpty()) {
            return List.of();
        }
        Map<Long, BeltDto> belts = beltProgressRepository
                .findAllByUserIdIn(users.stream().map(User::getId).toList()).stream()
                .collect(Collectors.toMap(UserBeltProgress::getUserId, p -> {
                    var r = p.getBeltRank();
                    return new BeltDto(r.getSlug(), r.getName(), r.getNamePt(), r.getColorHex(), p.getStripes());
                }, (a, b) -> a));
        return users.stream()
                .map(u -> new SearchUserDto(
                        u.getId(),
                        u.getUsername(),
                        u.getDisplayName(),
                        u.getAvatarKey() == null ? null : mediaStorage.urlFor(u.getAvatarKey()),
                        Boolean.TRUE.equals(u.getPro()),
                        belts.get(u.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public UserProfileDto profile(Long viewerId, Long targetId) {
        User user = requireUser(targetId);

        BeltDto belt = beltProgressRepository.findByUserId(targetId)
                .map(p -> {
                    var r = p.getBeltRank();
                    return new BeltDto(r.getSlug(), r.getName(), r.getNamePt(), r.getColorHex(), p.getStripes());
                })
                .orElse(null);

        GymSummaryDto gym = gymMemberRepository.findFirstByUserId(targetId)
                .map(m -> gymRepository.findById(m.getGymId())
                        .map(g -> gymSummary(g, m.getRole().name()))
                        .orElse(null))
                .orElse(null);

        List<MedalDto> medals = userMedalRepository.findAllByUserIdOrderByPositionAsc(targetId).stream()
                .map(m -> new MedalDto(m.getId(), m.getCompetition(), m.getTier(), m.getCount() == null ? 1 : m.getCount()))
                .toList();

        List<GymPhotoDto> photos = userPhotoRepository.findAllByUserIdOrderByPositionAsc(targetId).stream()
                .map(ph -> new GymPhotoDto(ph.getId(), mediaStorage.urlFor(ph.getStorageKey())))
                .toList();

        return new UserProfileDto(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                Boolean.TRUE.equals(user.getPro()),
                user.getBio(),
                user.getCity(),
                user.getCountry(),
                user.getState(),
                user.getAvatarKey() == null ? null : mediaStorage.urlFor(user.getAvatarKey()),
                user.getCertificateKey() == null ? null : mediaStorage.urlFor(user.getCertificateKey()),
                user.getAccentColor(),
                user.getBannerKey() == null ? null : mediaStorage.urlFor(user.getBannerKey()),
                user.getCreatedAt(),
                belt,
                gym,
                metrics(user),
                medals,
                photos,
                followRepository.countByFollowingId(targetId),
                followRepository.countByFollowerId(targetId),
                !viewerId.equals(targetId) && followRepository.existsByFollowerIdAndFollowingId(viewerId, targetId),
                viewerId.equals(targetId),
                user.getFirstName(),
                user.getLastName(),
                user.getGender(),
                user.getFavoriteArt(),
                user.getTrainingStartYear(),
                user.getAge());
    }

    private GymSummaryDto gymSummary(com.bjjflow.backend.gyms.Gym g, String role) {
        List<GymReview> reviews = gymReviewRepository.findAllByGymIdOrderByCreatedAtDesc(g.getId());
        long ratingCount = reviews.size();
        double ratingAverage = ratingCount == 0 ? 0 : reviews.stream().mapToInt(GymReview::getRating).average().orElse(0);
        return new GymSummaryDto(
                g.getId(),
                g.getName(),
                g.getCity(),
                Boolean.TRUE.equals(g.getVerified()),
                role,
                g.getLogoKey() == null ? null : mediaStorage.urlFor(g.getLogoKey()),
                gymMemberRepository.countByGymId(g.getId()),
                ratingAverage,
                ratingCount);
    }

    private MetricsDto metrics(User user) {
        LocalDate last = user.getLastCheckInDate();
        boolean alive = last != null && !last.isBefore(LocalDate.now().minusDays(1));
        long activeWeeks = checkInRepository.distinctCheckDates(user.getId()).stream()
                .map(d -> d.get(IsoFields.WEEK_BASED_YEAR) * 100 + d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR))
                .distinct()
                .count();
        return new MetricsDto(
                checkInRepository.countByUserId(user.getId()),
                alive ? user.getCurrentStreak() : 0,
                user.getLongestStreak(),
                activeWeeks);
    }

    @Transactional
    public UserProfileDto updateProfile(Long userId, UpdateProfileRequest req) {
        User u = requireUser(userId);
        u.setBio(blankToNull(req.bio()));
        if (req.avatarKey() != null && !req.avatarKey().isBlank()) {
            u.setAvatarKey(req.avatarKey());
        }
        if (req.certificateKey() != null && !req.certificateKey().isBlank()) {
            u.setCertificateKey(req.certificateKey());
        }
        if (req.accentColor() != null && !req.accentColor().isBlank()) {
            u.setAccentColor(req.accentColor().trim());
        }
        if (req.bannerKey() != null) {
            // Empty string clears the banner (back to the gradient default).
            u.setBannerKey(req.bannerKey().isBlank() ? null : req.bannerKey().trim());
        }
        if (req.username() != null && !req.username().isBlank()) {
            String uname = req.username().trim().toLowerCase(Locale.ROOT);
            if (!Usernames.isValid(uname)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_USERNAME",
                        "Username must be 3-30 chars: letters, numbers or underscore");
            }
            userRepository.findByUsernameIgnoreCase(uname)
                    .filter(other -> !other.getId().equals(userId))
                    .ifPresent(other -> {
                        throw new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "Username is already taken");
                    });
            u.setUsername(uname);
        }
        userRepository.save(u);
        return profile(userId, userId);
    }

    /** Fill in profile basics (belt/age/location/etc) after signup — e.g. for social-login
     *  accounts with no belt yet, and editable from the profile screen. Only sets provided fields. */
    @Transactional
    public UserProfileDto completeProfile(Long userId, ProfileDtos.CompleteProfileRequest req) {
        User u = requireUser(userId);
        if (req.firstName() != null) {
            u.setFirstName(blankToNull(req.firstName()));
        }
        if (req.lastName() != null) {
            u.setLastName(blankToNull(req.lastName()));
        }
        if (req.firstName() != null || req.lastName() != null) {
            // displayName is derived from first + last; keep it in sync when either changes.
            String dn = ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                    + (u.getLastName() == null ? "" : u.getLastName())).trim();
            if (!dn.isEmpty()) {
                u.setDisplayName(dn);
            }
        }
        if (req.age() != null) {
            u.setAge(req.age());
        }
        if (req.weightKg() != null) {
            u.setWeightKg(req.weightKg());
        }
        if (req.heightCm() != null) {
            u.setHeightCm(req.heightCm());
        }
        if (req.gender() != null) {
            u.setGender(blankToNull(req.gender()));
        }
        if (req.favoriteArt() != null) {
            u.setFavoriteArt(blankToNull(req.favoriteArt()));
        }
        if (req.trainingStartYear() != null) {
            u.setTrainingStartYear(req.trainingStartYear());
        }
        if (req.city() != null) {
            u.setCity(blankToNull(req.city()));
        }
        if (req.country() != null) {
            u.setCountry(blankToNull(req.country()));
        }
        if (req.state() != null) {
            u.setState(blankToNull(req.state()));
        }
        userRepository.save(u);

        if (req.beltSlug() != null && !req.beltSlug().isBlank()) {
            BeltRank rank = beltRankRepository.findBySlug(req.beltSlug())
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BELT", "Unknown belt"));
            int stripes = req.stripes() == null ? 0 : Math.max(0, Math.min(6, req.stripes()));
            UserBeltProgress progress = beltProgressRepository.findByUserId(userId)
                    .orElseGet(() -> {
                        UserBeltProgress p = new UserBeltProgress();
                        p.setUserId(userId);
                        return p;
                    });
            progress.setBeltRank(rank);
            progress.setStripes(stripes);
            beltProgressRepository.save(progress);
        }
        return profile(userId, userId);
    }

    @Transactional
    public UserProfileDto addPhoto(Long userId, String key) {
        UserPhoto photo = new UserPhoto();
        photo.setUserId(userId);
        photo.setStorageKey(key);
        photo.setPosition((int) userPhotoRepository.countByUserId(userId));
        userPhotoRepository.save(photo);
        return profile(userId, userId);
    }

    @Transactional
    public UserProfileDto deletePhoto(Long userId, Long photoId) {
        userPhotoRepository.findByIdAndUserId(photoId, userId).ifPresent(userPhotoRepository::delete);
        return profile(userId, userId);
    }

    @Transactional
    public UserProfileDto replaceMedals(Long userId, List<MedalInput> medals) {
        userMedalRepository.deleteByUserId(userId);
        int position = 0;
        for (MedalInput m : medals == null ? List.<MedalInput>of() : medals) {
            String tier = m.tier() == null ? "" : m.tier().trim().toUpperCase(Locale.ROOT);
            if (!MEDAL_TIERS.contains(tier)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIER", "Medal tier must be GOLD, SILVER or BRONZE");
            }
            UserMedal um = new UserMedal();
            um.setUserId(userId);
            um.setCompetition(m.competition().trim());
            um.setTier(tier);
            um.setCount(m.count());
            um.setPosition(position++);
            userMedalRepository.save(um);
        }
        return profile(userId, userId);
    }

    @Transactional
    public UserProfileDto follow(Long viewerId, Long targetId) {
        if (viewerId.equals(targetId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CANNOT_FOLLOW_SELF", "You cannot follow yourself");
        }
        requireUser(targetId);
        if (!followRepository.existsByFollowerIdAndFollowingId(viewerId, targetId)) {
            Follow f = new Follow();
            f.setFollowerId(viewerId);
            f.setFollowingId(targetId);
            followRepository.save(f);
            notificationService.notify(targetId, com.bjjflow.backend.notifications.NotificationType.SOCIAL,
                    requireUser(viewerId).getDisplayName(), "começou a te seguir.", "user:" + viewerId);
        }
        return profile(viewerId, targetId);
    }

    @Transactional
    public UserProfileDto unfollow(Long viewerId, Long targetId) {
        followRepository.findByFollowerIdAndFollowingId(viewerId, targetId).ifPresent(followRepository::delete);
        return profile(viewerId, targetId);
    }

    // TEMP testing aid: flips PRO so the badge can be previewed before the
    // subscription system exists (mirrors the gym /verify toggle).
    @Transactional
    public UserProfileDto togglePro(Long userId) {
        User u = requireUser(userId);
        u.setPro(!Boolean.TRUE.equals(u.getPro()));
        userRepository.save(u);
        return profile(userId, userId);
    }

    private User requireUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
    }

    private String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
