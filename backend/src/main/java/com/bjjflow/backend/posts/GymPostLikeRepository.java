package com.bjjflow.backend.posts;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GymPostLikeRepository extends JpaRepository<GymPostLike, Long> {

    boolean existsByPostIdAndUserId(Long postId, Long userId);

    long countByPostId(Long postId);

    void deleteByPostIdAndUserId(Long postId, Long userId);

    void deleteByPostId(Long postId);

    @Query("select l.postId, count(l) from GymPostLike l where l.postId in :ids group by l.postId")
    List<Object[]> countByPostIds(@Param("ids") Collection<Long> ids);

    @Query("select l.postId from GymPostLike l where l.userId = :userId and l.postId in :ids")
    List<Long> likedPostIds(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);
}
