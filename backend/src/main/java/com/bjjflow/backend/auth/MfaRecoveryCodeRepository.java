package com.bjjflow.backend.auth;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface MfaRecoveryCodeRepository extends JpaRepository<MfaRecoveryCode, Long> {

    List<MfaRecoveryCode> findByUserIdAndUsedFalse(Long userId);

    @Transactional
    void deleteByUserId(Long userId);
}
