package com.bjjflow.backend.events;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserEventRepository extends JpaRepository<UserEvent, Long> {

    boolean existsByUserIdAndTypeAndValue(Long userId, String type, Integer value);

    List<UserEvent> findTop20ByUserIdOrderByOccurredAtDesc(Long userId);

    List<UserEvent> findTop20ByGymIdOrderByOccurredAtDesc(Long gymId);
}
