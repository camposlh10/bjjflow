package com.bjjflow.backend.gyms;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.gyms.verification.CertificateVerdict;
import com.bjjflow.backend.gyms.verification.CertificateVerifier;
import com.bjjflow.backend.gyms.verification.VerificationPolicy;
import com.bjjflow.backend.storage.MediaStorage;
import com.bjjflow.backend.users.User;
import com.bjjflow.backend.users.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GymVerificationService {

    private final GymMemberRepository gymMemberRepository;
    private final GymRepository gymRepository;
    private final GymVerificationRepository gymVerificationRepository;
    private final GymVerificationMediaRepository gymVerificationMediaRepository;
    private final UserRepository userRepository;
    private final MediaStorage mediaStorage;
    private final CertificateVerifier certificateVerifier;
    private final com.bjjflow.backend.common.AdminAccess adminAccess;

    @Transactional
    public void submit(Long userId, GymDtos.SubmitVerificationRequest req) {
        GymMember owner = requireOwner(userId);
        if (!Cnpj.isValid(req.cnpj())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CNPJ", "CNPJ inválido");
        }
        Long gymId = owner.getGymId();

        GymVerification v = gymVerificationRepository.findByGymId(gymId)
                .orElseGet(() -> {
                    GymVerification nv = new GymVerification();
                    nv.setGymId(gymId);
                    return nv;
                });
        v.setCnpj(Cnpj.digits(req.cnpj()));
        v.setStatus("PENDING");
        v.setReviewNotes(null);
        v.setReviewedBy(null);
        v = gymVerificationRepository.save(v);

        // replace any previous documents
        gymVerificationMediaRepository.deleteByVerificationId(v.getId());
        List<GymVerificationMedia> media = new ArrayList<>();
        media.add(mediaRow(v.getId(), req.certificateKey(), "CERTIFICATE", 0));
        int pos = 1;
        for (String key : req.establishmentKeys()) {
            media.add(mediaRow(v.getId(), key, "ESTABLISHMENT", pos++));
        }
        gymVerificationMediaRepository.saveAll(media);

        String ownerName = userRepository.findById(userId).map(User::getDisplayName).orElse("");
        triage(v, media, ownerName);
        gymVerificationRepository.save(v);
        applyVerifiedFlag(gymId, v.getStatus());
    }

    // AI first pass: turns the documents into a verdict + a decision. Any failure
    // inside the verifier already falls back to NEEDS_REVIEW.
    private void triage(GymVerification v, List<GymVerificationMedia> media, String ownerName) {
        List<CertificateVerifier.Image> images = new ArrayList<>();
        for (GymVerificationMedia m : media) {
            try {
                images.add(new CertificateVerifier.Image(
                        mediaStorage.read(m.getStorageKey()), mimeOf(m.getStorageKey()), m.getKind()));
            } catch (RuntimeException e) {
                // unreadable document -> let the verifier (or human) handle a partial set
            }
        }
        CertificateVerdict verdict = certificateVerifier.verify(ownerName, v.getCnpj(), images);
        VerificationPolicy.Decision decision = VerificationPolicy.decide(verdict);
        v.setAiConfidence(verdict.confidence());
        v.setAiSummary(clip(verdict.summary(), 2000));
        v.setAiRaw(clip("belt=" + verdict.beltLevel() + " nameMatch=" + verdict.nameMatch()
                + " redFlags=" + verdict.redFlags(), 8000));
        v.setStatus(decision.name());
    }

    private void applyVerifiedFlag(Long gymId, String status) {
        Gym gym = gymRepository.findById(gymId).orElseThrow();
        if ("APPROVED".equals(status)) {
            gym.setVerified(true);
            gymRepository.save(gym);
        } else if ("REJECTED".equals(status)) {
            gym.setVerified(false);
            gymRepository.save(gym);
        }
    }

    @Transactional(readOnly = true)
    public List<GymDtos.VerificationAdminDto> listForReviewAsAdmin(Long adminUserId) {
        requireAdmin(adminUserId);
        return gymVerificationRepository.findAllByStatusOrderByCreatedAtAsc("NEEDS_REVIEW").stream()
                .map(this::toAdminDto)
                .toList();
    }

    @Transactional
    public GymDtos.VerificationAdminDto decide(Long adminUserId, Long verificationId, boolean approve, String notes) {
        requireAdmin(adminUserId);
        GymVerification v = gymVerificationRepository.findById(verificationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Verificação não encontrada"));
        v.setStatus(approve ? "APPROVED" : "REJECTED");
        v.setReviewNotes(clip(notes, 1000));
        v.setReviewedBy(adminUserId);
        gymVerificationRepository.save(v);
        applyVerifiedFlag(v.getGymId(), v.getStatus());
        return toAdminDto(v);
    }

    private void requireAdmin(Long userId) {
        String email = userRepository.findById(userId).map(User::getEmail).orElse("");
        if (!adminAccess.isAdminEmail(email)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ADMIN", "Apenas administradores");
        }
    }

    private GymDtos.VerificationAdminDto toAdminDto(GymVerification v) {
        List<GymVerificationMedia> media = gymVerificationMediaRepository
                .findAllByVerificationIdOrderByPositionAsc(v.getId());
        String certUrl = media.stream().filter(m -> "CERTIFICATE".equals(m.getKind())).findFirst()
                .map(m -> mediaStorage.urlFor(m.getStorageKey())).orElse(null);
        List<String> estUrls = media.stream().filter(m -> "ESTABLISHMENT".equals(m.getKind()))
                .map(m -> mediaStorage.urlFor(m.getStorageKey())).toList();
        String gymName = gymRepository.findById(v.getGymId()).map(Gym::getName).orElse("—");
        return new GymDtos.VerificationAdminDto(v.getId(), v.getGymId(), gymName, v.getStatus(),
                Cnpj.format(v.getCnpj()), certUrl, estUrls, v.getAiConfidence(), v.getAiSummary(),
                v.getReviewNotes(), v.getCreatedAt());
    }

    private GymVerificationMedia mediaRow(Long verificationId, String key, String kind, int pos) {
        GymVerificationMedia m = new GymVerificationMedia();
        m.setVerificationId(verificationId);
        m.setStorageKey(key);
        m.setKind(kind);
        m.setPosition(pos);
        return m;
    }

    private GymMember requireOwner(Long userId) {
        GymMember m = gymMemberRepository.findFirstByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NO_GYM", "Você não está em uma academia"));
        if (m.getRole() != GymRole.OWNER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_OWNER", "Apenas o dono pode fazer isso");
        }
        return m;
    }

    private static String mimeOf(String key) {
        String k = key.toLowerCase(Locale.ROOT);
        if (k.endsWith(".png")) {
            return "image/png";
        }
        if (k.endsWith(".webp")) {
            return "image/webp";
        }
        if (k.endsWith(".gif")) {
            return "image/gif";
        }
        return "image/jpeg";
    }

    private static String clip(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
