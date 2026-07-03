package com.bjjflow.backend.techniques;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bjjflow.backend.common.ApiException;
import com.bjjflow.backend.techniques.TechniqueDtos.CategoryDto;
import com.bjjflow.backend.techniques.TechniqueDtos.FavoriteDto;
import com.bjjflow.backend.techniques.TechniqueDtos.PersonalTechniqueDto;
import com.bjjflow.backend.techniques.TechniqueDtos.PersonalTechniqueRequest;
import com.bjjflow.backend.techniques.TechniqueDtos.TechniqueDto;
import com.bjjflow.backend.techniques.TechniqueDtos.TechniqueListDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TechniqueService {

    private final TechniqueRepository techniqueRepository;
    private final TechniqueFavoriteRepository favoriteRepository;
    private final PersonalTechniqueRepository personalTechniqueRepository;
    private final com.bjjflow.backend.storage.MediaStorage mediaStorage;

    @Transactional(readOnly = true)
    public TechniqueListDto list(Long userId, String category, String q) {
        Set<Long> favorites = favoriteIds(userId);
        List<Technique> techniques;
        if (q != null && !q.isBlank()) {
            techniques = techniqueRepository.search(q.trim());
        } else if (category != null && !category.isBlank()) {
            techniques = techniqueRepository.findByCategoryOrderBySortOrderAscNamePtAsc(category.trim().toUpperCase());
        } else {
            techniques = techniqueRepository.findAllByOrderBySortOrderAscNamePtAsc();
        }
        List<TechniqueDto> items = techniques.stream().map(t -> toDto(t, favorites)).toList();
        return new TechniqueListDto(categories(), items);
    }

    @Transactional(readOnly = true)
    public List<CategoryDto> categories() {
        return techniqueRepository.categoryCounts().stream()
                .map(r -> new CategoryDto((String) r[0], ((Number) r[1]).longValue()))
                .sorted((a, b) -> Long.compare(b.count(), a.count()))
                .toList();
    }

    @Transactional(readOnly = true)
    public TechniqueDto get(Long userId, Long id) {
        Technique t = techniqueRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TECHNIQUE_NOT_FOUND", "Technique not found"));
        return toDto(t, favoriteIds(userId));
    }

    @Transactional
    public FavoriteDto toggleFavorite(Long userId, Long techniqueId) {
        if (!techniqueRepository.existsById(techniqueId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "TECHNIQUE_NOT_FOUND", "Technique not found");
        }
        var existing = favoriteRepository.findByUserIdAndTechniqueId(userId, techniqueId);
        if (existing.isPresent()) {
            favoriteRepository.delete(existing.get());
            return new FavoriteDto(false);
        }
        TechniqueFavorite fav = new TechniqueFavorite();
        fav.setUserId(userId);
        fav.setTechniqueId(techniqueId);
        favoriteRepository.save(fav);
        return new FavoriteDto(true);
    }

    @Transactional(readOnly = true)
    public List<TechniqueDto> favorites(Long userId) {
        Set<Long> ids = favoriteIds(userId);
        if (ids.isEmpty()) {
            return List.of();
        }
        return techniqueRepository.findAllById(ids).stream()
                .sorted((a, b) -> Integer.compare(nullSafe(a.getSortOrder()), nullSafe(b.getSortOrder())))
                .map(t -> toDto(t, ids))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PersonalTechniqueDto> personalList(Long userId) {
        return personalTechniqueRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toPersonalDto).toList();
    }

    @Transactional
    public PersonalTechniqueDto personalCreate(Long userId, PersonalTechniqueRequest req) {
        PersonalTechnique p = new PersonalTechnique();
        p.setUserId(userId);
        apply(p, req);
        return toPersonalDto(personalTechniqueRepository.save(p));
    }

    @Transactional
    public PersonalTechniqueDto personalUpdate(Long userId, Long id, PersonalTechniqueRequest req) {
        PersonalTechnique p = personalTechniqueRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TECHNIQUE_NOT_FOUND",
                        "Technique not found"));
        apply(p, req);
        return toPersonalDto(personalTechniqueRepository.save(p));
    }

    @Transactional
    public void personalDelete(Long userId, Long id) {
        PersonalTechnique p = personalTechniqueRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TECHNIQUE_NOT_FOUND",
                        "Technique not found"));
        personalTechniqueRepository.delete(p);
    }

    private void apply(PersonalTechnique p, PersonalTechniqueRequest req) {
        p.setName(req.name().trim());
        p.setCategory(blankToNull(req.category()));
        p.setNotes(blankToNull(req.notes()));
        p.setVideoUrl(blankToNull(req.videoUrl()));
        p.setColor(blankToNull(req.color()));
        p.setMediaKey(blankToNull(req.mediaKey()));
    }

    private Set<Long> favoriteIds(Long userId) {
        return favoriteRepository.findByUserId(userId).stream()
                .map(TechniqueFavorite::getTechniqueId)
                .collect(Collectors.toSet());
    }

    private TechniqueDto toDto(Technique t, Set<Long> favorites) {
        return new TechniqueDto(t.getId(), t.getSlug(), t.getCategory(), t.getNamePt(), t.getPositionPt(),
                t.getDescriptionPt(), t.getDifficulty(), t.getBeltSlug(), t.getVideoUrl(),
                favorites.contains(t.getId()));
    }

    private PersonalTechniqueDto toPersonalDto(PersonalTechnique p) {
        String mediaUrl = p.getMediaKey() == null ? null : mediaStorage.urlFor(p.getMediaKey());
        return new PersonalTechniqueDto(p.getId(), p.getName(), p.getCategory(), p.getNotes(), p.getVideoUrl(),
                p.getColor(), p.getMediaKey(), mediaUrl, p.getCreatedAt());
    }

    private static int nullSafe(Integer v) {
        return v == null ? 0 : v;
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
