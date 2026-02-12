## Plan: Selective Integration of `database-caching` Into `master` + Backend Stability Review

### Summary
`database-caching` is an orphan branch (single root commit, no merge-base with `master`), so a normal merge is unsafe and misleading.  
Use a selective patch strategy: port only validated, high-signal changes and intentionally drop risky structural regressions.

### Decisions Locked
1. Merge strategy: `Selective Patch`.
2. Backend review scope: `Validation Only`.
3. Server wiring: `Keep Current Pattern` (`internal/bootstrap` + `NewServerWithDeps` retained).

### File-by-File Merge Decisions
1. `Makefile`: **partially port**
- Keep:
  - Fix `test-api` target to call `./test-routes.sh` (current `./test-api.sh` is missing).
  - Add `test-frontend` target (`cd frontend && bun run test:run`) to match repo docs/instructions.
  - Update `.PHONY`/`help` entries only for these target corrections.
- Do not port:
  - Test pipeline behavior rewrites (`test-backend` auto `test-up`, coverage/load/e2e additions).
  - Formatter policy changes (`goimports`/`gofumpt` requirement).
  - Admin/report/swagger/openapi/deps workflow expansions from this branch.

2. `backend/test/sanctum_migration_seed_test.go`: **port targeted correctness fixes**
- Keep `//go:build integration`.
- Change `TestMigrationsApplyFreshDB` to execute real SQL migrations (`runMigrations`) instead of `runAutoMigrate`.
- Add assertions for:
  - FK constraint `fk_conversations_sanctum`.
  - Unique index `idx_conversations_sanctum_id_unique`.
- Keep idempotent seed test but use stable DB handle pattern consistent with current test setup.

3. `backend/cmd/server/main.go`: **do not port branch changes**.
4. `backend/internal/server/server.go`: **do not port branch changes**.
5. `backend/internal/bootstrap/runtime.go`: **keep file; do not delete**.
6. `backend/server/server.go`: **keep file; do not delete**.
7. `backend/cmd/debugseed/main.go`: **keep file; do not delete**.
8. `backend/test/*.go` (other touched tests): **do not port branch-wide helper/tag rewrites**.
9. `compose.monitor-lite.yml`, `compose.monitoring.yml`, `infra/prometheus/prometheus.yml`: **do not port quote-only formatting churn**.

### Why This Is “Best” for This Branch
1. Avoids merging unrelated histories and preserving a noisy WIP root commit.
2. Preserves current runtime/test architecture to minimize regression risk.
3. Captures concrete value from the branch (broken Make target fix + migration test correctness).
4. Keeps diff small and reviewable.

### Public API / Interface Impact
1. Backend HTTP API: **no route/response/type changes**.
2. Developer interface changes:
- `make test-api` becomes functional by calling existing `test-routes.sh`.
- `make test-frontend` becomes available (currently missing).

### Validation Plan (Post-Edit)
1. `make test-backend`
2. `make test-backend-integration`
3. `make test-frontend`
4. `make test-api` (with backend running)
5. Optional signal check: `make lint` and record that current failures are pre-existing lint debt, not introduced by this merge.

### Current Health Findings (Baseline Before Merge)
1. `make test-backend`: passes.
2. `make test-backend-integration`: passes.
3. `make lint`: fails with large pre-existing baseline (~273 issues).
4. `make test-api`: currently broken on `master` due missing `test-api.sh`.
5. `make test-frontend`: currently missing target on `master`.

### Assumptions and Defaults
1. No broad lint cleanup in this pass.
2. No architecture rewrite in this pass.
3. No OpenAPI/backend contract changes in this pass.
4. Goal is safe integration + backend confidence, not full branch parity.
