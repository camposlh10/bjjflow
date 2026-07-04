package com.bjjflow.backend.notifications;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AutomationEventRepository extends JpaRepository<AutomationEvent, Long> {

    boolean existsByTypeAndRefKey(String type, String refKey);

    List<AutomationEvent> findAllByGymIdOrderByCreatedAtDescIdDesc(Long gymId, Pageable pageable);
}
