package com.bjjflow.backend.kids;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface KidsAgeGroupRepository extends JpaRepository<KidsAgeGroup, Long> {

    List<KidsAgeGroup> findAllByGymIdOrderByPositionAsc(Long gymId);
}
