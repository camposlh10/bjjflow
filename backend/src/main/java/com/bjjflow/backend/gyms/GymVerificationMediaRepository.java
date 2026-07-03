package com.bjjflow.backend.gyms;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymVerificationMediaRepository extends JpaRepository<GymVerificationMedia, Long> {

    List<GymVerificationMedia> findAllByVerificationIdOrderByPositionAsc(Long verificationId);

    void deleteByVerificationId(Long verificationId);
}
