package com.bjjflow.backend.users;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserMedalRepository extends JpaRepository<UserMedal, Long> {

    List<UserMedal> findAllByUserIdOrderByPositionAsc(Long userId);

    void deleteByUserId(Long userId);
}
