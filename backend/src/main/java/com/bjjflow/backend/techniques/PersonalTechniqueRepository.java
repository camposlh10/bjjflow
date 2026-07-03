package com.bjjflow.backend.techniques;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonalTechniqueRepository extends JpaRepository<PersonalTechnique, Long> {

    List<PersonalTechnique> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<PersonalTechnique> findByIdAndUserId(Long id, Long userId);
}
