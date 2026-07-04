package com.bjjflow.backend.payments;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    List<Invoice> findAllByGymIdOrderByDueDateDescIdDesc(Long gymId);

    List<Invoice> findAllByGymIdAndMemberUserIdOrderByDueDateDescIdDesc(Long gymId, Long memberUserId);

    List<Invoice> findAllByGymIdAndStatusOrderByDueDateAscIdAsc(Long gymId, PaymentStatus status);

    Optional<Invoice> findByIdAndGymId(Long id, Long gymId);

    Optional<Invoice> findByGymIdAndPaymentReferenceIgnoreCase(Long gymId, String paymentReference);

    boolean existsByPaymentPlanIdAndDueDate(Long paymentPlanId, LocalDate dueDate);

    List<Invoice> findAllByStatusInAndDueDate(Collection<PaymentStatus> statuses, LocalDate dueDate);

    boolean existsByGymIdAndMemberUserIdAndStatus(Long gymId, Long memberUserId, PaymentStatus status);

    long countByGymIdAndStatus(Long gymId, PaymentStatus status);

    @Query("select coalesce(sum(i.amount), 0) from Invoice i where i.gymId = :gymId and i.status = :status")
    BigDecimal sumAmountByGymIdAndStatus(@Param("gymId") Long gymId, @Param("status") PaymentStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.id = :id and i.gymId = :gymId")
    Optional<Invoice> findForUpdate(@Param("id") Long id, @Param("gymId") Long gymId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Invoice i set i.status = :overdue, i.updatedAt = :now
            where i.gymId = :gymId and i.status = :pending and i.dueDate < :today
            """)
    int markOverdue(@Param("gymId") Long gymId, @Param("today") LocalDate today, @Param("now") Instant now,
            @Param("pending") PaymentStatus pending, @Param("overdue") PaymentStatus overdue);
}
