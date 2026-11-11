package com.bjjflow.backend.automations;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.bjjflow.backend.gyms.Gym;
import com.bjjflow.backend.gyms.GymRepository;

import lombok.RequiredArgsConstructor;

/** Resolves each gym's time zone, falling back to São Paulo for unknown values. */
@Service
@RequiredArgsConstructor
public class GymZones {

    public static final ZoneId DEFAULT = ZoneId.of("America/Sao_Paulo");

    private final GymRepository gymRepository;

    public static ZoneId zoneOf(Gym gym) {
        String id = gym == null ? null : gym.getTimezone();
        if (id == null || id.isBlank()) {
            return DEFAULT;
        }
        try {
            return ZoneId.of(id.trim());
        } catch (DateTimeException invalid) {
            return DEFAULT;
        }
    }

    public ZoneId zoneOf(Long gymId) {
        return gymRepository.findById(gymId).map(GymZones::zoneOf).orElse(DEFAULT);
    }

    public Map<Long, ZoneId> zonesFor(Collection<Long> gymIds) {
        Map<Long, ZoneId> zones = new HashMap<>();
        for (Gym gym : gymRepository.findAllById(gymIds)) {
            zones.put(gym.getId(), zoneOf(gym));
        }
        return zones;
    }
}
