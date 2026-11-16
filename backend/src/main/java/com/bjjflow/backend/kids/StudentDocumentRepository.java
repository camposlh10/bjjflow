package com.bjjflow.backend.kids;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentDocumentRepository extends JpaRepository<StudentDocument, Long> {

    List<StudentDocument> findAllByGymIdAndStudentUserIdOrderBySignedOnDescIdDesc(Long gymId, Long studentUserId);

    List<StudentDocument> findAllByGymId(Long gymId);

    Optional<StudentDocument> findByIdAndGymIdAndStudentUserId(Long id, Long gymId, Long studentUserId);
}
