package com.bjjflow.backend.gyms;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymPhotoRepository extends JpaRepository<GymPhoto, Long> {

    List<GymPhoto> findAllByGymIdOrderByPositionAsc(Long gymId);

    long countByGymId(Long gymId);
}
