package com.bjjflow.backend.users;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByUsernameIgnoreCase(String username);

    Optional<User> findByUsernameIgnoreCase(String username);

    /** People search by display name or @handle (case-insensitive contains); private accounts excluded. */
    @Query("""
            select u from User u
            where (u.privateAccount is null or u.privateAccount = false)
              and (lower(u.displayName) like lower(concat('%', :q, '%'))
               or lower(u.username) like lower(concat('%', :q, '%')))
            order by u.displayName asc
            """)
    List<User> search(@Param("q") String q, Pageable pageable);
}
