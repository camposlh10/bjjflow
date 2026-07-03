package com.bjjflow.backend.users;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPhotoRepository extends JpaRepository<UserPhoto, Long> {

    List<UserPhoto> findAllByUserIdOrderByPositionAsc(Long userId);

    Optional<UserPhoto> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);
}
