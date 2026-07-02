package com.bjjflow.backend.payments;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    Optional<PaymentTransaction> findByInvoiceId(Long invoiceId);

    List<PaymentTransaction> findAllByInvoiceIdIn(Collection<Long> invoiceIds);

    List<PaymentTransaction> findAllByGymIdOrderByPaidAtDesc(Long gymId);

    long countByGymIdAndPaidAtGreaterThanEqualAndPaidAtLessThan(Long gymId, Instant from, Instant to);

    @Query("""
            select coalesce(sum(t.amount), 0) from PaymentTransaction t
            where t.gymId = :gymId and t.paidAt >= :from and t.paidAt < :to
            """)
    BigDecimal sumAmountByGymIdAndPaidAtBetween(
            @Param("gymId") Long gymId, @Param("from") Instant from, @Param("to") Instant to);
}
