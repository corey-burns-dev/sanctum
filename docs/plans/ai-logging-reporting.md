# AI-Assisted Stress Testing + Monitoring Pipeline (Makefile-First)

## Summary

Build a single-command workflow that:

1. Starts app + monitoring (Prometheus/Grafana/Loki).
2. Runs low/medium/high mixed social load (posts, comments, likes, friends, DMs, chat WS, game WS).
3. Pulls metrics/logs + k6 summaries.
4. Sends structured context to local Ollama (host service).
5. Produces a standalone HTML findings report (plus raw artifacts).

This plan uses **Python** for the AI analyzer and **unified mixed k6 scenario** with **conservative low/medium/high profiles**.

## Important Interface Changes

- New Make targets in `Makefile`:
  - `stress-low`, `stress-medium`, `stress-high`
  - `stress-all`
  - `stress-stack-up`, `stress-stack-down`
  - `ai-report` (analyze latest run artifacts and generate HTML)
  - `stress-ai-low`, `stress-ai-medium`, `stress-ai-high` (run + analyze)
- New runtime env vars (documented in `docs/operations/stress-testing.md`):
  - `BASE_URL` default `http://localhost:8375`
  - `OLLAMA_URL` default `http://localhost:11434`
  - `OLLAMA_MODEL` default `llama3.2:3b`
  - `PROM_URL` default `http://localhost:9090`
  - `LOKI_URL` default `http://localhost:3100`
  - `ARTIFACT_DIR` default `tmp/stress-runs`
- New artifact contract per run:
  - `summary.json` (k6)
  - `metrics.json` (Prometheus query results)
  - `logs.json` (Loki excerpts)
  - `ai-analysis.json` (structured model response)
  - `report.html` (final human report)
  - `report.md` (markdown report)
  - `report.txt` (plain-text report)

## Implementation Plan

### 1. Normalize the load profiles and orchestration

- Add profile files:
  - `load/profiles/low.json`
  - `load/profiles/medium.json`
  - `load/profiles/high.json`
- Baseline VU ramps (conservative default):
  - low: target 25/50/15 (auth/social/realtime groups)
  - medium: target 50/100/30
  - high: target 75/150/50
- Keep duration pattern consistent initially: 1m ramp, 3m hold, 1m ramp down.

### 2. Replace narrow stress behavior with unified mixed scenario

- Add `load/scripts/social_mixed.js` with weighted actions:
  - 25% feed/notifications reads
  - 15% posts (create/list)
  - 15% comments + like/unlike
  - 15% friend request/accept/status/list
  - 15% DM conversation create/send/read
  - 10% chat websocket (`/api/ws/chat` with join/message/read)
  - 5% game room create + game websocket (`/api/ws/game?room_id=...` join/move/chat)
- Keep existing `http_stress.js` and `ws_stress.js` as compatibility scripts; new Make targets use `social_mixed.js`.

### 3. Add robust k6 result export

- For each run, write artifacts under timestamped run dir:
  - `tmp/stress-runs/<timestamp>-<profile>/summary.json`
- Configure k6 execution to emit summary JSON for AI ingestion.

### 4. Build AI analyzer script (Python, no new heavy deps)

- Add `scripts/ai_stress_report.py`:
  - Inputs: run dir + optional profile label + endpoint env vars.
  - Pull Prometheus instant/range queries aligned to run window.
  - Pull Loki errors/warnings for same window.
  - Read k6 `summary.json`.
  - Build strict JSON-oriented prompt for Ollama.
  - Request structured response (status, findings, bottlenecks, likely causes, next actions, confidence).
  - Generate:
    - `ai-analysis.json`
    - styled standalone `report.html`
- Use only stdlib + `requests` (already pattern-consistent with repo scripts).
- Fail gracefully if one source is down; report partial coverage explicitly.

### 5. Fix metric/query alignment to real metric names

- Query real exported names, not doc placeholders:
  - `http_requests_total`
  - `http_request_duration_seconds_bucket`
  - `sanctum_active_websockets`
  - `sanctum_websocket_connections_total`
  - `sanctum_websocket_backpressure_drops_total`
  - `sanctum_database_query_latency_seconds`
  - `sanctum_message_throughput_total`
- Remove/avoid non-existent names like `ws_active_connections`.

### 6. Makefile integration (end-to-end flow)

- `stress-stack-up`: `make up`, `make monitor-up`, readiness checks, optional seed check.
- `stress-low|medium|high`: run `k6` with matching profile + artifact dir.
- `ai-report`: run analyzer against selected/latest run.
- `stress-ai-low|medium|high`: chain stack-up -> stress -> ai-report.
- `stress-all`: run low, medium, high sequentially, produce index page linking all HTML reports.

### 7. Documentation updates

- Update `docs/operations/stress-testing.md`:
  - New profile commands.
  - Artifact locations.
  - AI report usage examples.
  - Troubleshooting (Ollama unavailable, Prometheus empty range, Loki missing logs).
- Keep `docs/plans/ai-logging-metrics.md` as planning reference; add concise “Implemented Flow” section once coding is done.

## Test Cases and Scenarios

1. `make stress-low` produces valid k6 summary artifact and no script crashes.
2. `make ai-report` on low run generates both `ai-analysis.json` and `report.html`.
3. `make stress-ai-low` succeeds end-to-end with monitor stack already running.
4. Chat WS scenario validates ticket issuance + connect + join + message frame handling.
5. Game WS scenario validates room creation + join/move/chat frames without hard failures.
6. Analyzer handles partial outages:
   - Prometheus down: report still generated with explicit degraded data source.
   - Loki down: same behavior.
   - Ollama timeout: emit fallback HTML with collected raw metrics/log summary.
7. Metric sanity checks:
   - Queries return non-empty time series during medium/high runs.
   - Alert threshold sections in report reflect actual values.
8. `make stress-all` outputs three per-profile reports + top-level index HTML.

## Assumptions and Defaults

- Ollama runs on host (`http://localhost:11434`) and model is pre-pulled.
- Existing `make monitor-up` stack is the canonical Prometheus/Grafana/Loki path.
- First rollout favors reliability over max load; profile aggressiveness can be raised after baseline pass.
- Python is acceptable for orchestration/reporting speed; Go migration can be a later hardening step.
- HTML is primary report artifact; raw JSON artifacts are also persisted for reproducibility.

## Implemented Flow

Implemented in this repo:

- Make targets:
  - `stress-stack-up`, `stress-stack-down`
  - `stress-low`, `stress-medium`, `stress-high`
  - `ai-report`, `stress-index`
  - `stress-ai-low`, `stress-ai-medium`, `stress-ai-high`, `stress-all`
- k6 mixed scenario:
  - `load/scripts/social_mixed.js`
- k6 profiles:
  - `load/profiles/low.json`
  - `load/profiles/medium.json`
  - `load/profiles/high.json`
- AI collector + report generator:
  - `scripts/ai_stress_report.py`
- Docs updated:
  - `docs/operations/stress-testing.md`
- Grafana auto-provisioned dashboards:
  - `Stress Certification`
  - `API Endpoints Overview`
