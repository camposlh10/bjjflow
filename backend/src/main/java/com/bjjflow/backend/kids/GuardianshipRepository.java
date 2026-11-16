package com.bjjflow.backend.kids;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GuardianshipRepository extends JpaRepository<Guardianship, Long> {

    List<Guardianship> findAllByGymIdAndStudentUserIdAndStatusInOrderByIdAsc(Long gymId, Long studentUserId,
            Collection<String> statuses);

    List<Guardianship> findAllByGymIdAndStatusIn(Long gymId, Collection<String> statuses);

    List<Guardianship> findAllByGuardianUserIdAndStatusOrderByIdAsc(Long guardianUserId, String status);

    Optional<Guardianship> findByIdAndGymIdAndStudentUserId(Long id, Long gymId, Long studentUserId);

    Optional<Guardianship> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    boolean existsByStudentUserIdAndGuardianUserIdAndStatus(Long studentUserId, Long guardianUserId, String status);
}
