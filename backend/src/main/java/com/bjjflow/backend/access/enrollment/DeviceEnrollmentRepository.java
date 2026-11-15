package com.bjjflow.backend.access.enrollment;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceEnrollmentRepository extends JpaRepository<DeviceEnrollment, Long> {

    List<DeviceEnrollment> findAllByGymIdAndUserIdOrderByIdDesc(Long gymId, Long userId);

    List<DeviceEnrollment> findAllByGymIdAndUserIdAndMethodAndStatusIn(Long gymId, Long userId,
            DeviceEnrollment.Method method, Collection<DeviceEnrollment.Status> statuses);

    List<DeviceEnrollment> findAllByGymIdAndUserIdAndDeviceIdAndStatusIn(Long gymId, Long userId, Long deviceId,
            Collection<DeviceEnrollment.Status> statuses);

    Optional<DeviceEnrollment> findByCommandId(Long commandId);

    Optional<DeviceEnrollment> findByIdAndGymId(Long id, Long gymId);
}
