package com.bjjflow.backend.posts;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GymPostCommentRepository extends JpaRepository<GymPostComment, Long> {

    List<GymPostComment> findAllByPostIdOrderByCreatedAtAsc(Long postId);

    long countByPostId(Long postId);

    void deleteByPostId(Long postId);

    @Query("select c.postId, count(c) from GymPostComment c where c.postId in :ids group by c.postId")
    List<Object[]> countByPostIds(@Param("ids") Collection<Long> ids);
}
