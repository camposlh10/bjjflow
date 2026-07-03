package com.bjjflow.backend.belts;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BeltPromotionRepository extends JpaRepository<BeltPromotion, Long> {

    Optional<BeltPromotion> findFirstByUserIdOrderByCreatedAtDesc(Long userId);

    List<BeltPromotion> findAllByUserIdInOrderByCreatedAtDesc(Collection<Long> userIds);

    List<BeltPromotion> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    List<BeltPromotion> findTop20ByGymIdOrderByCreatedAtDesc(Long gymId);
}
