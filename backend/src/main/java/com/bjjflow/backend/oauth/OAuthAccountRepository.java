package com.bjjflow.backend.oauth;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OAuthAccountRepository extends JpaRepository<OAuthAccount, Long> {

    Optional<OAuthAccount> findByProviderAndSubject(OAuthProvider provider, String subject);
}
