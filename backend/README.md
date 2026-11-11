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

The API starts on http://localhost:8090 (see `server.port` in `application.yml`).
Smoke test:

```
curl http://localhost:8090/api/v1/health
```

H2 web console (dev only): http://localhost:8090/h2-console
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
## Production configuration

The `postgres` profile reads everything from environment variables.

| Variable | Required | Purpose |
|---|---|---|
| `SPRING_PROFILES_ACTIVE=postgres` | yes | Selects the production profile |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | yes | PostgreSQL connection |
| `APP_JWT_SECRET` | yes | Token signing key, at least 32 random characters. The app refuses to start without it |
| `APP_CORS_ALLOWED_ORIGINS` | yes, for the CRM | Comma-separated browser origins allowed to call the API, e.g. `https://crm.example.com`. Wildcards allowed (`https://*.vercel.app`). Empty blocks every browser origin; the mobile app is unaffected |
| `APP_MEDIA_PROVIDER=s3` | recommended | Store media in an S3-compatible bucket instead of the server's disk |
| `APP_MEDIA_S3_ENDPOINT` | with `s3` | Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`. Leave empty for AWS S3 |
| `APP_MEDIA_S3_REGION` | with `s3` | `auto` for R2 (default); the bucket region for AWS |
| `APP_MEDIA_S3_BUCKET`, `APP_MEDIA_S3_ACCESS_KEY`, `APP_MEDIA_S3_SECRET_KEY` | with `s3` | Bucket and API credentials |
| `APP_MEDIA_S3_PUBLIC_BASE_URL` | with `s3` | Public/CDN domain the files are read from, e.g. `https://media.example.com` |
| `DB_POOL_SIZE` | no | Database connections per instance (default 10) |
| `APP_JWT_ACCEPT_LEGACY_REFRESH` | no | Set to `false` about 30 days after the session upgrade ships, to stop accepting the old stateless refresh tokens |

Health probes for the platform: `/actuator/health/liveness` and `/actuator/health/readiness`.

### Sessions

Access tokens last 15 minutes. Refresh tokens are opaque, stored hashed in
`refresh_tokens`, rotated on every use, and revoked on logout
(`POST /api/v1/auth/logout`), password reset and password change.

### Media uploads

Clients call `POST /api/v1/media/uploads` for a one-time upload URL and send the
file straight to the bucket. With `APP_MEDIA_PROVIDER=local` (dev) that endpoint
answers `direct: false` and clients post the file to `POST /api/v1/media` instead.

## Tests on PostgreSQL

`.\mvnw.cmd test` runs against a real PostgreSQL 16 started as a local process
(no Docker needed; the binaries are downloaded by Maven on first run).
Use `.\mvnw.cmd test "-Dtest.db=h2"` to run on in-memory H2 instead.

## Background jobs

Push notifications, emails and large notification fan-outs (staff posts, CRM
announcements) run as background jobs. A job is a row in the `jobs` table,
written in the same transaction as the change that caused it, so a rolled-back
change never sends anything and a committed one survives a restart. The worker
polls every second (`APP_JOBS_POLL_INTERVAL_MS`), retries failures with
exponential backoff (10s doubling, capped at 1h) and marks a job `FAILED` after
its last attempt. Several instances can run the worker safely.

Look for stuck work with `SELECT type, status, attempts, last_error FROM jobs
WHERE status <> 'DONE'`. Finished jobs are purged after 7 days.

## Scheduled automations

Daily ladders (payment reminders, engagement) run at 08:00 in each gym's own
time zone (`gyms.timezone`, default `America/Sao_Paulo`); class reminders run
hourly. A row in `scheduler_locks` makes each run happen on one instance only.

## Realtime

The apps keep a WebSocket open at `/api/v1/realtime` and receive small events
(new message, new notification) that tell them what to refetch. The first frame
must be `{"type":"auth","token":"<access token>"}`; the server closes with code
4001 when the token is invalid or expires, and the app refreshes and reconnects.

Connections are held in the memory of the instance the app is connected to.
Before running more than one instance, relay events through a shared channel
(Postgres `LISTEN/NOTIFY` or Redis); until then, polling still delivers updates.

## Idempotent writes

`POST /api/v1/checkins` and `POST /api/v1/conversations/{id}/messages` accept an
optional `clientId` chosen by the app. Repeating a request with the same
`clientId` returns the original instead of creating a duplicate, which lets the
app retry and replay its offline queue safely.
