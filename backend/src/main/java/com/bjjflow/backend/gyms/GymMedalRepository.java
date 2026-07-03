package com.bjjflow.backend.gyms;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymMedalRepository extends JpaRepository<GymMedal, Long> {

    List<GymMedal> findAllByGymIdOrderByPositionAsc(Long gymId);

    void deleteByGymId(Long gymId);
}
