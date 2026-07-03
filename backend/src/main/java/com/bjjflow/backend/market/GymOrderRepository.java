package com.bjjflow.backend.market;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GymOrderRepository extends JpaRepository<GymOrder, Long> {

    long countByProductId(Long productId);

    @Query("select o.productId, count(o) from GymOrder o where o.productId in :ids group by o.productId")
    List<Object[]> countByProductIds(@Param("ids") Collection<Long> ids);

    @Query("select distinct o.productId from GymOrder o where o.userId = :userId and o.productId in :ids")
    List<Long> orderedProductIds(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);
}
