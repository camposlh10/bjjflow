package com.bjjflow.backend.payments;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentPlanRepository extends JpaRepository<PaymentPlan, Long> {

    List<PaymentPlan> findAllByGymIdOrderByCreatedAtDesc(Long gymId);

    List<PaymentPlan> findAllByGymIdAndMemberUserIdOrderByCreatedAtDesc(Long gymId, Long memberUserId);

    List<PaymentPlan> findAllByGymIdAndActiveTrueAndNextDueDateLessThanEqualOrderByIdAsc(
            Long gymId, LocalDate date);

    long countByGymIdAndActiveTrue(Long gymId);

    Optional<PaymentPlan> findByIdAndGymId(Long id, Long gymId);
}
