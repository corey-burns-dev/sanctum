# Plan: Close Remaining Deep-Review Gaps (LOW Findings + Technical Debt)

## Summary

This plan covers all currently missing items from the deep production review that are not in existing `docs/plans/full-review-*.md` files:

1. LOW-1, LOW-2, LOW-4, LOW-6, LOW-7.
2. Technical debt from the report action list: LOW-3, LOW-5, OpenTelemetry wiring.

Delivery will be split into 6 focused PRs so each change is reviewable and reversible.

## Public APIs / Interfaces / Types

1. `GET /api/admin/users` query validation will add a max length for `q` and return `400` when exceeded.
2. Rate-limited sensitive endpoints will return `503` (not fail-open) when Redis rate-limit dependency is unavailable.
3. New backend config/env fields for DB pool tuning:
`DB_MAX_OPEN_CONNS`, `DB_MAX_IDLE_CONNS`, `DB_CONN_MAX_LIFETIME_MINUTES`.
4. New tracing config/env fields:
`TRACING_ENABLED`, `TRACING_EXPORTER`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_RATIO`.
5. No route/path additions. No response schema changes besides existing error envelope usage for new `400`/`503` cases.

## Implementation Plan

### PR-1: LOW-1 + LOW-6 (small correctness and validation fixes)

1. Remove dead no-op in `backend/internal/server/welcome_bot.go` (`_ = strings.TrimSpace(conv.Name)`).
2. Add `q` length validation in `backend/internal/server/moderation_handlers.go` `GetAdminUsers`.
3. Use constant `maxAdminUserSearchLen = 64`.
4. Behavior:
`q == ""` works as today,
`1..64` chars works as today,
`>64` returns validation error (`400`) with clear message.

### PR-2: LOW-2 (hybrid rate-limit failure policy)

1. Extend middleware in `backend/internal/middleware/ratelimit.go` with explicit failure policy:
`FailOpen` and `FailClosed`.
2. Keep backward compatibility:
`RateLimit(...)` remains and defaults to `FailOpen`.
3. Add new constructor:
`RateLimitWithPolicy(rdb, limit, window, policy, name...)`.
4. On Redis nil/error with `FailClosed`, return `503` with `"rate limit unavailable"` error.
5. Apply `FailClosed` only to sensitive routes in `backend/internal/server/server.go`:
`/api/auth/signup`, `/api/auth/login`, all `/api/admin/*`, and moderation report creation endpoints.
6. Keep non-sensitive routes on `FailOpen` to preserve availability.
7. Add explicit warning log on fail-closed path with route/resource/policy context.

### PR-3: LOW-4 + LOW-7 (frontend logging and reconnect behavior)

1. Replace raw `console.log` in:
`frontend/src/providers/ChatProvider.tsx`,
`frontend/src/hooks/useChatWebSocket.ts`
with `logger.debug(...)` or dev-gated debug logging.
2. Move or remove `frontend/src/api/throw-away.js` from production source tree:
target location `frontend/examples/socketio/throw-away-server.js` (not imported by app build).
3. Update `frontend/src/hooks/usePresence.ts` reconnect strategy:
replace fixed 5s retry with `getNextBackoff(...)` from `frontend/src/lib/ws-utils.ts`.
4. Add reconnect attempt counter ref and reset attempts on successful open.
5. Keep existing cleanup semantics on unmount.

### PR-4: LOW-3 (configurable DB connection pool)

1. Add fields to `backend/internal/config/config.go` `Config` struct:
`DBMaxOpenConns`, `DBMaxIdleConns`, `DBConnMaxLifetimeMinutes`.
2. Add defaults matching current behavior: `25`, `5`, `5`.
3. Add validation rules:
all values must be `>= 0`,
if `maxOpen > 0`, then `maxIdle <= maxOpen`,
`connMaxLifetimeMinutes >= 1` for production.
4. Update pool configuration in `backend/internal/database/database.go` `configurePool(...)` to use config values.
5. Update docs/examples:
`config.example.yml`, `backend/config.production.example.yml`, `scripts/config_sanity.sh`.

### PR-5: LOW-5 (tooling mismatch hardening)

1. Make lint/vuln checks toolchain-stable by running via containerized Go toolchain (repo-pinned) instead of host-installed binaries.
2. Add Make targets:
`lint-backend-docker` and `deps-vuln-docker`.
3. Update `make lint` and `make deps-vuln` to either:
call dockerized targets directly, or auto-fallback to them on local tool/version mismatch.
4. Keep existing local flow optional for contributors with matching local toolchain.
5. Document expected behavior in `README.md` and/or `backend/TESTING.md`.

### PR-6: OpenTelemetry activation (env-gated OTLP + dev stdout)

1. Wire tracing initialization into startup path (`backend/cmd/server/main.go`).
2. Refactor `backend/internal/observability/tracing.go`:
`InitTracing` returns shutdown function (`func(context.Context) error`) plus error.
3. Add exporter selection:
`stdout` for local/dev,
`otlp` for prod/staging when endpoint is configured.
4. Add request-span middleware in server middleware chain (HTTP span per request with request ID/user ID attributes when available).
5. Preserve current behavior when tracing disabled (`TRACING_ENABLED=false`).
6. Ensure graceful shutdown calls tracer provider shutdown with timeout.

## Test Cases and Scenarios

1. Backend validation tests:
`backend/internal/server/moderation_handlers_test.go` add `q` length boundary tests (`64` accepted, `65` rejected).
2. Middleware tests:
`backend/internal/middleware/ratelimit_test.go` add fail-open/fail-closed behavior for Redis nil/error paths.
3. Route behavior tests:
admin/auth/report routes return `503` on forced Redis error with fail-closed policy.
4. DB config tests:
`backend/internal/config/config_test.go` for new pool env validation and defaults.
5. DB pool application tests:
`backend/internal/database/database_test.go` verify configured values are applied to `sql.DB`.
6. Frontend tests:
`frontend/src/hooks/usePresence.test.ts` add backoff progression and reset-on-open behavior.
7. Frontend lint-level behavior:
assert no raw `console.log` in production app paths (`frontend/src/providers`, `frontend/src/hooks`).
8. Tooling smoke checks:
`make lint`, `make deps-vuln` succeed in a clean environment without host linter binaries.
9. Tracing tests:
unit tests for tracing config parsing and exporter selection; integration smoke ensures app starts with tracing on/off and shuts down cleanly.

## Rollout / Verification

1. Merge order: PR-1, PR-2, PR-3, PR-4, PR-5, PR-6.
2. After PR-2 deploy, monitor 503 rate for auth/admin routes during Redis incidents.
3. After PR-4 deploy, verify DB pool metrics and connection counts under load.
4. After PR-6 deploy, verify traces in local (stdout) and staging/prod (OTLP backend) before enabling in production at full sample rate.

## Assumptions and Defaults Chosen

1. Scope is “all remaining missing items” (LOW findings + technical debt + tracing).
2. LOW-2 policy is hybrid: fail-closed only for auth/admin/moderation-sensitive routes.
3. Admin user search max query length is `64`.
4. DB pool defaults remain current values unless overridden.
5. Tracing uses env-gated OTLP in non-dev and stdout for local/dev.
6. Existing endpoint paths and core response envelopes remain unchanged.
