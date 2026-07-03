package com.bjjflow.backend.posts;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GymPostSaveRepository extends JpaRepository<GymPostSave, Long> {

    @Query("select s.postId from GymPostSave s where s.userId = :userId and s.postId in :ids")
    List<Long> savedPostIds(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);

    boolean existsByPostIdAndUserId(Long postId, Long userId);

    void deleteByPostIdAndUserId(Long postId, Long userId);

    void deleteByPostId(Long postId);

    List<GymPostSave> findAllByUserIdOrderByCreatedAtDesc(Long userId);
}
