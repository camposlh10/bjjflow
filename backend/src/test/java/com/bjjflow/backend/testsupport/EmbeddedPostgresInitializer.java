package com.bjjflow.backend.testsupport;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Map;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * Runs the test suite against a real PostgreSQL 16 (the production database)
 * instead of H2, so migrations and queries are exercised on the engine they
 * ship on. The server is a plain local process: no Docker needed. It starts
 * once per test JVM and is shared by every Spring context.
 *
 * Registered for all tests via META-INF/spring.factories. To fall back to the
 * in-memory H2 database from application-test.yml: {@code mvnw test -Dtest.db=h2}.
 */
public class EmbeddedPostgresInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static EmbeddedPostgres postgres;

    @Override
    public void initialize(ConfigurableApplicationContext context) {
        if ("h2".equalsIgnoreCase(System.getProperty("test.db"))) {
            return;
        }
        String url = server().getJdbcUrl("postgres", "postgres");
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("embedded-postgres", Map.of(
                "spring.datasource.url", url,
                "spring.datasource.username", "postgres",
                "spring.datasource.password", "",
                "spring.datasource.driver-class-name", "org.postgresql.Driver")));
    }

    private static synchronized EmbeddedPostgres server() {
        if (postgres == null) {
            try {
                postgres = EmbeddedPostgres.builder().start();
            } catch (IOException e) {
                throw new UncheckedIOException("Could not start embedded PostgreSQL", e);
            }
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    postgres.close();
                } catch (IOException ignored) {
                    // JVM is exiting anyway.
                }
            }));
        }
        return postgres;
    }
}
