package com.bjjflow.backend.techniques;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class TechniqueDtos {

    public record TechniqueDto(Long id, String slug, String category, String name, String position,
            String description, String difficulty, String beltSlug, String videoUrl, boolean favorite) {
    }

    public record CategoryDto(String category, long count) {
    }

    public record PersonalTechniqueDto(Long id, String name, String category, String notes, String videoUrl,
            String color, String mediaKey, String mediaUrl, Instant createdAt) {
    }

    public record PersonalTechniqueRequest(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 20) String category,
            @Size(max = 1000) String notes,
            @Size(max = 500) String videoUrl,
            @Size(max = 9) String color,
            @Size(max = 300) String mediaKey) {
    }

    public record FavoriteDto(boolean favorite) {
    }

    public record TechniqueListDto(List<CategoryDto> categories, List<TechniqueDto> items) {
    }
}
