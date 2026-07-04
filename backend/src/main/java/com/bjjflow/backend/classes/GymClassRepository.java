package com.bjjflow.backend.classes;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymClassRepository extends JpaRepository<GymClass, Long> {

    List<GymClass> findAllByGymIdAndActiveTrueOrderByDayOfWeekAscStartTimeAsc(Long gymId);

    List<GymClass> findAllByGymIdOrderByDayOfWeekAscStartTimeAsc(Long gymId);

    List<GymClass> findAllByGymIdAndDayOfWeekAndActiveTrueOrderByStartTimeAsc(Long gymId, Integer dayOfWeek);

    List<GymClass> findAllByActiveTrue();

    long countByGymIdAndActiveTrue(Long gymId);

    long countByGymIdAndDayOfWeekAndActiveTrue(Long gymId, Integer dayOfWeek);
}
