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

    @GetMapping("/ranks")
    public List<BeltRankDto> ranks() {
        return beltRankRepository.findAllByOrderByBeltSystemIdAscSortOrderAsc().stream()
                .map(r -> new BeltRankDto(r.getId(), r.getSlug(), r.getName(), r.getNamePt(),
                        r.getColorHex(), r.getSortOrder(), r.getMaxStripes(), r.getBeltSystem().getName()))
                .toList();
    }
}
