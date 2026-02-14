#!/usr/bin/env bash
set -euo pipefail

if [ "${SKIP_E2E_PRE_PUSH:-}" = "1" ]; then
  echo "Skipping e2e pre-push check (SKIP_E2E_PRE_PUSH=1)"
  exit 0
fi

echo "Installing Playwright browsers (best-effort)..."
cd "$(dirname "$0")/.."/frontend || exit 1

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found in PATH — cannot run Playwright smoke tests. Install Bun or run tests manually." >&2
  exit 0
fi

# attempt to install browsers if script exists
if bun -v >/dev/null 2>&1; then
  bun run test:e2e:install || true
fi

echo "Running Playwright smoke tests (grep @smoke, single worker)..."
bun run test:e2e -- --grep @smoke --workers=1
