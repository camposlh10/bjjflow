package com.bjjflow.backend.belts;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/belt-systems")
@RequiredArgsConstructor
public class BeltController {

    private final BeltRankRepository beltRankRepository;

    public record BeltRankDto(Long id, String slug, String name, String namePt, String colorHex,
            Integer sortOrder, Integer maxStripes, String system) {
    }

    /** The catalogue only changes with a migration, so it is served from memory. */
    private volatile List<BeltRankDto> cachedRanks;

    @GetMapping("/ranks")
    public org.springframework.http.ResponseEntity<List<BeltRankDto>> ranks() {
        List<BeltRankDto> ranks = cachedRanks;
        if (ranks == null) {
            ranks = beltRankRepository.findAllByOrderByBeltSystemIdAscSortOrderAsc().stream()
                    .map(r -> new BeltRankDto(r.getId(), r.getSlug(), r.getName(), r.getNamePt(),
                            r.getColorHex(), r.getSortOrder(), r.getMaxStripes(), r.getBeltSystem().getName()))
                    .toList();
            cachedRanks = ranks;
        }
        return org.springframework.http.ResponseEntity.ok()
                .cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofHours(1)).cachePublic())
                .body(ranks);
    }

}
