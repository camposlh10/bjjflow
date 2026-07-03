# BJJ Flow — Backend

REST API for BJJ Flow, a training companion and community app for jiu-jitsu practitioners.

## Stack

- Java 21, Spring Boot 4 (Maven)
- Spring Web MVC, Spring Data JPA, Spring Security (JWT)
- PostgreSQL (prod) / H2 in PostgreSQL-compatibility mode (dev)
- Flyway migrations

## Running locally

No database install needed — the default `dev` profile uses an embedded H2 database
(file-based, stored under `./data/`):

```
.\mvnw.cmd spring-boot:run
```

The API starts on http://localhost:8081 (8080 is taken by Apache on the dev machine).
Smoke test:

```
curl http://localhost:8081/api/v1/health
```

H2 web console (dev only): http://localhost:8081/h2-console
(JDBC URL `jdbc:h2:file:./data/bjjflow-dev`, user `sa`, empty password)

## Running against PostgreSQL

With Docker Desktop installed:

```
docker compose up -d
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=postgres"
```

Or point the `postgres` profile in `src/main/resources/application.yml` at any
PostgreSQL 16 instance (database `bjjflow`).

## Project layout

```
src/main/java/com/bjjflow/backend/
  config/     # security, CORS, app configuration
  health/     # health check endpoint
  ...         # feature packages added per domain (auth, users, techniques, checkins)
```

## Tests

```
.\mvnw.cmd test
```
