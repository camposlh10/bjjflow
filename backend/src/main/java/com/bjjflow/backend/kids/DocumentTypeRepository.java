package com.bjjflow.backend.kids;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentTypeRepository extends JpaRepository<DocumentType, Long> {

    List<DocumentType> findAllByGymIdAndActiveTrueOrderByIdAsc(Long gymId);

    Optional<DocumentType> findByIdAndGymId(Long id, Long gymId);

    boolean existsByGymId(Long gymId);
}
