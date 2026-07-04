package com.bjjflow.backend.payments;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PosWebhookEventRepository extends JpaRepository<PosWebhookEvent, Long> {

    Optional<PosWebhookEvent> findByGymIdAndExternalTransactionId(Long gymId, String externalTransactionId);

    Optional<PosWebhookEvent> findByIdAndGymId(Long id, Long gymId);

    List<PosWebhookEvent> findAllByGymIdOrderByCreatedAtDescIdDesc(Long gymId, Pageable pageable);

    List<PosWebhookEvent> findAllByGymIdAndStatusInOrderByCreatedAtAsc(
            Long gymId, List<PosWebhookStatus> statuses);
}
