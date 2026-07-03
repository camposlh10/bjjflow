package com.bjjflow.backend.techniques;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.bjjflow.backend.techniques.TechniqueDtos.CategoryDto;
import com.bjjflow.backend.techniques.TechniqueDtos.FavoriteDto;
import com.bjjflow.backend.techniques.TechniqueDtos.PersonalTechniqueDto;
import com.bjjflow.backend.techniques.TechniqueDtos.PersonalTechniqueRequest;
import com.bjjflow.backend.techniques.TechniqueDtos.TechniqueDto;
import com.bjjflow.backend.techniques.TechniqueDtos.TechniqueListDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TechniqueController {

    private final TechniqueService techniqueService;

    private static Long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    @GetMapping("/techniques")
    public TechniqueListDto list(Authentication auth,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q) {
        return techniqueService.list(userId(auth), category, q);
    }

    @GetMapping("/techniques/categories")
    public List<CategoryDto> categories() {
        return techniqueService.categories();
    }

    @GetMapping("/techniques/{id}")
    public TechniqueDto get(Authentication auth, @PathVariable Long id) {
        return techniqueService.get(userId(auth), id);
    }

    @PostMapping("/techniques/{id}/favorite")
    public FavoriteDto toggleFavorite(Authentication auth, @PathVariable Long id) {
        return techniqueService.toggleFavorite(userId(auth), id);
    }

    @GetMapping("/users/me/favorite-techniques")
    public List<TechniqueDto> favorites(Authentication auth) {
        return techniqueService.favorites(userId(auth));
    }

    @GetMapping("/users/me/techniques")
    public List<PersonalTechniqueDto> personalList(Authentication auth) {
        return techniqueService.personalList(userId(auth));
    }

    @PostMapping("/users/me/techniques")
    public PersonalTechniqueDto personalCreate(Authentication auth, @Valid @RequestBody PersonalTechniqueRequest req) {
        return techniqueService.personalCreate(userId(auth), req);
    }

    @PutMapping("/users/me/techniques/{id}")
    public PersonalTechniqueDto personalUpdate(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody PersonalTechniqueRequest req) {
        return techniqueService.personalUpdate(userId(auth), id, req);
    }

    @DeleteMapping("/users/me/techniques/{id}")
    public ResponseEntity<Void> personalDelete(Authentication auth, @PathVariable Long id) {
        techniqueService.personalDelete(userId(auth), id);
        return ResponseEntity.noContent().build();
    }
}
