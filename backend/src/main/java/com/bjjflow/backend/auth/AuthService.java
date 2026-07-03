package com.bjjflow.backend.auth;

import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import com.bjjflow.backend.auth.AuthDtos.AuthResponse;
import com.bjjflow.backend.auth.AuthDtos.BeltDto;
import com.bjjflow.backend.auth.AuthDtos.LoginRequest;
import com.bjjflow.backend.auth.AuthDtos.OAuthRequest;
import com.bjjflow.backend.auth.AuthDtos.RegisterRequest;
import com.bjjflow.backend.auth.AuthDtos.UserDto;
import com.bjjflow.backend.belts.BeltRank;
import com.bjjflow.backend.belts.BeltRankRepository;
import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.oauth.OAuthAccount;
import com.bjjflow.backend.oauth.OAuthAccountRepository;
import com.bjjflow.backend.oauth.OAuthUserInfo;
import com.bjjflow.backend.oauth.OAuthVerifier;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserBeltProgress;
import com.bjjflow.backend.users.UserBeltProgressRepository;
import com.bjjflow.backend.users.UserRepository;
import com.bjjflow.backend.users.Usernames;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserBeltProgressRepository beltProgressRepository;
    private final BeltRankRepository beltRankRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final MfaService mfaService;
    private final com.bjjflow.backend.common.AdminAccess adminAccess;
    private final OAuthVerifier oauthVerifier;
    private final OAuthAccountRepository oauthAccountRepository;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_USED", "Email is already registered");
        }
        BeltRank rank = beltRankRepository.findBySlug(request.beltSlug())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BELT", "Unknown belt"));

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName().trim());
        user.setFirstName(blankToNull(request.firstName()));
        user.setLastName(blankToNull(request.lastName()));
        user.setGender(blankToNull(request.gender()));
        user.setCity(blankToNull(request.city()));
        user.setCountry(blankToNull(request.country()));
        user.setState(blankToNull(request.state()));
        user.setFavoriteArt(blankToNull(request.favoriteArt()));
        user.setTrainingStartYear(request.trainingStartYear());
        user.setAge(request.age());
        user.setWeightKg(request.weightKg());
        user.setHeightCm(request.heightCm());
        user.setUsername(resolveUsername(request.username(), request.displayName()));
        user = userRepository.save(user);

        UserBeltProgress progress = new UserBeltProgress();
        progress.setUserId(user.getId());
        progress.setBeltRank(rank);
        progress.setStripes(request.stripes() == null ? 0 : request.stripes());
        beltProgressRepository.save(progress);

        return buildAuthResponse(user, progress);
    }

    /**
     * Sign in (or sign up) via a verified Google/Apple token. Matches an existing
     * OAuth link, else links to an account with the same email, else creates a new
     * account (no belt/age yet — completed later). Provider auth bypasses MFA.
     */
    @Transactional
    public AuthResponse oauthLogin(OAuthRequest request) {
        OAuthUserInfo info = oauthVerifier.verify(request.provider(), request.idToken());
        OAuthAccount account = oauthAccountRepository
                .findByProviderAndSubject(info.provider(), info.subject())
                .orElse(null);

        User user;
        if (account != null) {
            user = userRepository.findById(account.getUserId())
                    .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "User not found"));
        } else {
            String email = info.email() == null ? null : info.email().trim().toLowerCase(Locale.ROOT);
            if (email == null || email.isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "OAUTH_NO_EMAIL", "Provider did not share an email");
            }
            user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                String name = blankToNull(request.displayName());
                if (name == null) {
                    name = blankToNull(info.name());
                }
                if (name == null) {
                    name = email.substring(0, email.indexOf('@'));
                }
                user = new User();
                user.setEmail(email);
                user.setDisplayName(name);
                user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
                user.setUsername(generateUsername(name));
                user = userRepository.save(user);
            }
            OAuthAccount link = new OAuthAccount();
            link.setUserId(user.getId());
            link.setProvider(info.provider());
            link.setSubject(info.subject());
            oauthAccountRepository.save(link);
        }
        return buildAuthResponse(user, findProgress(user.getId()));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email)
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                        "Invalid email or password"));
        if (Boolean.TRUE.equals(user.getMfaEnabled())) {
            return AuthResponse.mfaChallenge(jwtService.createMfaToken(user.getId()));
        }
        return buildAuthResponse(user, findProgress(user.getId()));
    }

    /** Second step of an MFA login: exchange the mfaToken + code (TOTP or recovery) for real tokens. */
    @Transactional
    public AuthResponse completeMfa(String mfaToken, String code) {
        Long userId = jwtService.parse(mfaToken)
                .filter(token -> "mfa".equals(token.type()))
                .map(JwtService.ParsedToken::userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_MFA_TOKEN",
                        "MFA session expired, sign in again"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_MFA_TOKEN",
                        "MFA session expired, sign in again"));
        if (!Boolean.TRUE.equals(user.getMfaEnabled()) || !mfaService.verifyChallenge(user, code)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_MFA_CODE", "Invalid authenticator code");
        }
        return buildAuthResponse(user, findProgress(user.getId()));
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(String refreshToken) {
        Long userId = jwtService.parse(refreshToken)
                .filter(token -> "refresh".equals(token.type()))
                .map(JwtService.ParsedToken::userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN",
                        "Refresh token is invalid or expired"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN",
                        "Refresh token is invalid or expired"));
        return buildAuthResponse(user, findProgress(user.getId()));
    }

    @Transactional(readOnly = true)
    public UserDto me(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "User not found"));
        return toUserDto(user, findProgress(userId));
    }

    private UserBeltProgress findProgress(Long userId) {
        return beltProgressRepository.findByUserId(userId).orElse(null);
    }

    /** Use the requested @handle (validated + unique) or auto-generate one from the name. */
    private String resolveUsername(String requested, String displayName) {
        if (requested == null || requested.isBlank()) {
            return generateUsername(displayName);
        }
        String uname = requested.trim().toLowerCase(Locale.ROOT);
        if (!Usernames.isValid(uname)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_USERNAME",
                    "Username must be 3-30 chars: letters, numbers or underscore");
        }
        if (userRepository.existsByUsernameIgnoreCase(uname)) {
            throw new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "Username is already taken");
        }
        return uname;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** A friendly unique @handle from the display name; appends a counter on collision. */
    private String generateUsername(String displayName) {
        String base = Usernames.sanitize(displayName);
        if (base.length() < 3) {
            base = "user";
        }
        String candidate = base;
        int n = 1;
        while (userRepository.existsByUsernameIgnoreCase(candidate)) {
            String suffix = String.valueOf(n++);
            int room = Usernames.MAX_LENGTH - suffix.length();
            candidate = (base.length() > room ? base.substring(0, room) : base) + suffix;
        }
        return candidate;
    }

    private AuthResponse buildAuthResponse(User user, UserBeltProgress progress) {
        return AuthResponse.tokens(
                jwtService.createAccessToken(user.getId()),
                jwtService.createRefreshToken(user.getId()),
                toUserDto(user, progress));
    }

    private UserDto toUserDto(User user, UserBeltProgress progress) {
        BeltDto belt = null;
        if (progress != null) {
            BeltRank rank = progress.getBeltRank();
            belt = new BeltDto(rank.getSlug(), rank.getName(), rank.getNamePt(), rank.getColorHex(),
                    progress.getStripes());
        }
        return new UserDto(user.getId(), user.getEmail(), user.getUsername(), user.getDisplayName(), user.getAge(),
                user.getWeightKg(), user.getHeightCm(), belt, adminAccess.isAdminEmail(user.getEmail()),
                Boolean.TRUE.equals(user.getPro()));
    }
}
