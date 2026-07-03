package com.bjjflow.backend.belts;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BeltRankRepository extends JpaRepository<BeltRank, Long> {

    Optional<BeltRank> findBySlug(String slug);

    List<BeltRank> findAllByOrderByBeltSystemIdAscSortOrderAsc();
}
