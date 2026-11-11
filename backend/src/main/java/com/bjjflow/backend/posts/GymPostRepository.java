package com.bjjflow.backend.posts;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymPostRepository extends JpaRepository<GymPost, Long> {

    List<GymPost> findAllByGymIdOrderByPinnedDescCreatedAtDesc(Long gymId,
            org.springframework.data.domain.Pageable pageable);

    /** Pinned posts always lead the first page. */
    List<GymPost> findByGymIdAndPinnedTrueOrderByIdDesc(Long gymId);

    List<GymPost> findByGymIdAndPinnedFalseOrderByIdDesc(Long gymId,
            org.springframework.data.domain.Pageable pageable);

    List<GymPost> findByGymIdAndPinnedFalseAndIdLessThanOrderByIdDesc(Long gymId, Long id,
            org.springframework.data.domain.Pageable pageable);
}
