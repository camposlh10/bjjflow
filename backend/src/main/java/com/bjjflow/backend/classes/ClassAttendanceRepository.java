package com.bjjflow.backend.classes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassAttendanceRepository extends JpaRepository<ClassAttendance, Long> {

    /** Recent attended classes (PRESENT or LATE), newest first. */
    @Query("""
            select a.classDate, c.name from ClassAttendance a, GymClass c
            where a.gymClassId = c.id and c.gymId = :gymId and a.status in ('PRESENT', 'LATE')
              and a.userId = :userId
            order by a.classDate desc
            """)
    List<Object[]> recentAttendanceInGym(@Param("gymId") Long gymId, @Param("userId") Long userId,
            Pageable pageable);

    boolean existsByGymClassIdAndClassDateAndUserId(Long gymClassId, LocalDate classDate, Long userId);

    /** Last attended date per user of one gym (PRESENT or LATE), batched. */
    @Query("""
            select a.userId, max(a.classDate) from ClassAttendance a, GymClass c
            where a.gymClassId = c.id and c.gymId = :gymId and a.status in ('PRESENT', 'LATE')
            group by a.userId
            """)
    List<Object[]> lastAttendanceDatesForGym(@Param("gymId") Long gymId);

    /** Distinct students who attended a class since a date — reminder audience. */
    @Query("""
            select distinct a.userId from ClassAttendance a
            where a.gymClassId = :classId and a.classDate >= :since
              and a.status in ('PRESENT', 'LATE')
            """)
    List<Long> recentAttendeeIds(@Param("classId") Long classId, @Param("since") LocalDate since);

    Optional<ClassAttendance> findByGymClassIdAndClassDateAndUserId(Long gymClassId, LocalDate classDate, Long userId);

    long countByGymClassIdAndClassDate(Long gymClassId, LocalDate classDate);

    List<ClassAttendance> findAllByGymClassIdAndClassDate(Long gymClassId, LocalDate classDate);

    void deleteByGymClassIdAndClassDateAndUserId(Long gymClassId, LocalDate classDate, Long userId);

    void deleteByGymClassId(Long gymClassId);

    /** Verified attended classes (PRESENT or LATE) after a point in time. */
    @Query("""
            select count(a) from ClassAttendance a, GymClass c
            where a.gymClassId = c.id and c.gymId = :gymId and a.status in ('PRESENT', 'LATE')
              and a.userId = :userId and a.createdAt > :since
            """)
    long countForUserInGymSince(@Param("gymId") Long gymId, @Param("userId") Long userId,
            @Param("since") Instant since);

    /** All attended rows (userId, createdAt) of a gym, for batched counting. */
    @Query("""
            select a.userId, a.createdAt from ClassAttendance a, GymClass c
            where a.gymClassId = c.id and c.gymId = :gymId and a.status in ('PRESENT', 'LATE')
            """)
    List<Object[]> attendanceTimesForGym(@Param("gymId") Long gymId);

    /** Attended classes for a gym within an inclusive date range. */
    @Query("""
            select count(a) from ClassAttendance a, GymClass c
            where a.gymClassId = c.id and c.gymId = :gymId and a.status in ('PRESENT', 'LATE')
              and a.classDate between :from and :to
            """)
    long countAttendedInGymBetween(@Param("gymId") Long gymId, @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    /** Today's verified CRM check-ins for one gym. */
    @Query("""
            select a from ClassAttendance a, GymClass c
            where a.gymClassId = c.id and c.gymId = :gymId and a.status in ('PRESENT', 'LATE')
              and a.classDate = :date
            order by c.startTime asc, a.id asc
            """)
    List<ClassAttendance> findAttendedInGymOnDate(@Param("gymId") Long gymId, @Param("date") LocalDate date);

    /** Verified attendance history of one member, restricted to one gym. */
    @Query("""
            select a from ClassAttendance a, GymClass c
            where a.gymClassId = c.id and c.gymId = :gymId and a.status in ('PRESENT', 'LATE')
              and a.userId = :userId
            order by a.classDate desc, a.id desc
            """)
    List<ClassAttendance> findAttendedForUserInGym(@Param("gymId") Long gymId, @Param("userId") Long userId);

    List<ClassAttendance> findAllByUserIdAndClassDateBetween(Long userId, LocalDate from, LocalDate to);

    /** Most recent date the student was PRESENT or LATE in this gym. */
    @Query("""
            select max(a.classDate) from ClassAttendance a, GymClass c
            where a.gymClassId = c.id and c.gymId = :gymId and a.status in ('PRESENT', 'LATE')
              and a.userId = :userId
            """)
    LocalDate lastAttendedInGym(@Param("gymId") Long gymId, @Param("userId") Long userId);

    @Query("""
            select a.gymClassId, a.classDate, count(a) from ClassAttendance a
            where a.classDate between :from and :to
              and a.status in ('PRESENT', 'LATE', 'RESERVED')
            group by a.gymClassId, a.classDate
            """)
    List<Object[]> countsBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
