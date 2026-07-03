package com.bjjflow.backend.posts;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymPostMediaRepository extends JpaRepository<GymPostMedia, Long> {

    List<GymPostMedia> findAllByPostIdOrderByPositionAsc(Long postId);

    List<GymPostMedia> findAllByPostIdInOrderByPositionAsc(Collection<Long> postIds);

    void deleteByPostId(Long postId);
}
