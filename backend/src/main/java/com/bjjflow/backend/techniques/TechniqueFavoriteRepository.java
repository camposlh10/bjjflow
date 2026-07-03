package com.bjjflow.backend.techniques;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TechniqueFavoriteRepository extends JpaRepository<TechniqueFavorite, Long> {

    List<TechniqueFavorite> findByUserId(Long userId);

    Optional<TechniqueFavorite> findByUserIdAndTechniqueId(Long userId, Long techniqueId);

    boolean existsByUserIdAndTechniqueId(Long userId, Long techniqueId);
}
