package com.bjjflow.backend.kids;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentHealthInfoRepository extends JpaRepository<StudentHealthInfo, Long> {

    Optional<StudentHealthInfo> findByGymIdAndStudentUserId(Long gymId, Long studentUserId);

    List<StudentHealthInfo> findAllByGymId(Long gymId);
}
