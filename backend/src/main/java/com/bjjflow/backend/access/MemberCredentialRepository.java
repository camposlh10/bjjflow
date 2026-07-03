package com.bjjflow.backend.access;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberCredentialRepository extends JpaRepository<MemberCredential, Long> {

    Optional<MemberCredential> findFirstByGymIdAndValueIgnoreCaseAndActiveTrue(Long gymId, String value);

    boolean existsByGymIdAndValueIgnoreCaseAndActiveTrue(Long gymId, String value);

    List<MemberCredential> findAllByGymIdAndUserIdOrderByCreatedAtDesc(Long gymId, Long userId);

    Optional<MemberCredential> findByIdAndGymId(Long id, Long gymId);
}
