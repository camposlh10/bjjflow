package com.bjjflow.backend.market;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymProductRepository extends JpaRepository<GymProduct, Long> {

    List<GymProduct> findAllByGymIdAndActiveTrueOrderByCreatedAtDesc(Long gymId);
}
