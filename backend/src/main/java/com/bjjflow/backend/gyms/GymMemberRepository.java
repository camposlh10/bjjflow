package com.bjjflow.backend.gyms;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymMemberRepository extends JpaRepository<GymMember, Long> {

    Optional<GymMember> findByGymIdAndUserId(Long gymId, Long userId);

    // One primary gym per user, so a user has at most one membership.
    Optional<GymMember> findFirstByUserId(Long userId);

    List<GymMember> findAllByGymId(Long gymId);

    /** Memberships of just these users (e.g. the authors on one page of posts). */
    List<GymMember> findAllByGymIdAndUserIdIn(Long gymId, java.util.Collection<Long> userIds);

    List<GymMember> findAllByGymIdAndRole(Long gymId, GymRole role);

    long countByGymId(Long gymId);
}
