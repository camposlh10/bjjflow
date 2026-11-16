package com.bjjflow.backend.kids;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizedPickupRepository extends JpaRepository<AuthorizedPickup, Long> {

    List<AuthorizedPickup> findAllByGymIdAndStudentUserIdOrderByBlockedDescNameAsc(Long gymId, Long studentUserId);

    Optional<AuthorizedPickup> findByIdAndGymIdAndStudentUserId(Long id, Long gymId, Long studentUserId);
}
