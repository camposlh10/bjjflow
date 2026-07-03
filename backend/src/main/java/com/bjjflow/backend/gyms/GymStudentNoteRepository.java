package com.bjjflow.backend.gyms;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymStudentNoteRepository extends JpaRepository<GymStudentNote, Long> {

    List<GymStudentNote> findAllByGymIdAndStudentUserIdOrderByCreatedAtDesc(Long gymId, Long studentUserId);

    Optional<GymStudentNote> findByIdAndGymId(Long id, Long gymId);
}
