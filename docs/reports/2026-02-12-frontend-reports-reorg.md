# Frontend reports reorganization (2026-02-12)

Summary
- Consolidated all frontend test artifacts and reports into `frontend/reports/`.
- Updated configs, CI workflows, and helper scripts to reference the new paths.

Why
- Reduce clutter in repo root and make CI artifact paths consistent.
- Avoid multiple top-level frontend artifact folders by centralizing them.

Mapping (old -> new)
- `frontend/playwright-report/` -> `frontend/reports/playwright-report/`
- `frontend/test-results/` -> `frontend/reports/test-results/`
- `frontend/coverage/` -> `frontend/reports/coverage/`
- `frontend/test/` -> `frontend/reports/test/`

Files / Configs updated
- `frontend/playwright.config.ts` — `testDir` now points to `./reports/test/tests/e2e` and Playwright HTML output uses `reports/playwright-report`.
- `.github/workflows/ci.yml` and `.github/workflows/e2e-nightly.yml` — artifact upload paths updated to `frontend/reports/*`.
- `quick-deploy-fixes.sh` — Dockerignore generation updated to ignore `frontend/reports/coverage/` and `frontend/reports/test-results/`.
- `frontend/.gitignore`, `frontend/.biomeignore`, `frontend/tsconfig.json` — ignores/excludes updated for `reports/*` paths.
- `scripts/migrate-frontend-reports.sh` — helper added to move existing artifacts into the new folder.

How to verify locally
1. Run the migration script (will move any existing artifacts into `frontend/reports/`):

```bash
./scripts/migrate-frontend-reports.sh
```

2. Run Playwright locally to generate new artifacts (example):

```bash
cd frontend
# run Playwright via Bun/npm/yarn as configured in package.json (example)
npm run test:e2e
# or use the local Playwright CLI
npx playwright test
```

3. Inspect generated artifacts under `frontend/reports/playwright-report/` and `frontend/reports/test-results/`.

Notes / Followups
- CI should pick up the new artifact paths automatically on the next run (this commit was pushed to trigger CI).
- If any external automation references the old folder names, update them to the new `frontend/reports/*` locations.