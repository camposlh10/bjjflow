package com.bjjflow.backend.posts;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymPostRepository extends JpaRepository<GymPost, Long> {

    List<GymPost> findAllByGymIdOrderByPinnedDescCreatedAtDesc(Long gymId);
}
