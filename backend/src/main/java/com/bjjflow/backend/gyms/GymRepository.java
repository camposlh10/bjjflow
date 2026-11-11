package com.bjjflow.backend.gyms;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GymRepository extends JpaRepository<Gym, Long> {

    List<Gym> findAllByCityIgnoreCase(String city);

    Optional<Gym> findByInviteCode(String inviteCode);

    /** Largest gyms first with their member counts, in one query: rows of [id, name, city, members]. */
    @org.springframework.data.jpa.repository.Query("""
            select g.id, g.name, g.city, count(m.id)
            from Gym g left join GymMember m on m.gymId = g.id
            group by g.id, g.name, g.city
            order by count(m.id) desc, g.id asc
            """)
    java.util.List<Object[]> largest(org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
            select g.id, g.name, g.city, count(m.id)
            from Gym g left join GymMember m on m.gymId = g.id
            where lower(g.city) = lower(:city)
            group by g.id, g.name, g.city
            order by count(m.id) desc, g.id asc
            """)
    java.util.List<Object[]> largestInCity(@org.springframework.data.repository.query.Param("city") String city,
            org.springframework.data.domain.Pageable pageable);
}
