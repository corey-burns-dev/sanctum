# E2E Testing Guide

This directory contains end-to-end tests for the Sanctum application using Playwright.

## Overview

The test suite is organized into two tiers:

1. **Smoke Tests** (`@smoke`) - Critical path validation
2. **Full Test Suite** - Comprehensive coverage including edge cases

## Smoke Tests

Smoke tests validate the most critical user journeys and run on every PR/push in CI. They provide fast feedback to catch breaking changes before merge.

### When to Mark a Test as `@smoke`

A test should be marked with the `@smoke` tag if it validates:

- **Core authentication flows**: signup, login, logout
- **Primary user journeys**: request sanctum, approve request, join sanctum, send messages
- **Critical navigation**: accessing main app sections (feed, sanctums, profile)
- **Essential features**: features that would render the app unusable if broken

### What NOT to Mark as `@smoke`

- Edge cases and error handling (unless they're critical safeguards)
- Performance or stress tests (use `@preprod` or no tag)
- Features that are nice-to-have but not core functionality
- UI polish or cosmetic features

### Current Smoke Tests

The smoke suite includes **7 critical path tests**:

**Authentication & Onboarding**:
- `auth-flows.spec.ts:4` - Signup redirects to onboarding

**Navigation**:
- `navigation.spec.ts:8` - Navigate to sanctums and back

**Sanctum Workflows**:
- `sanctum-user-request.spec.ts:9` - User submits sanctum request and sees it in their list
- `sanctum-admin-approve.spec.ts:12` - Admin approves sanctum request

**Core Features**:
- `sanctum-open-chat.spec.ts:7` - Open chat from sanctum
- `stress-journeys.spec.ts:8` - User creates a post from feed
- `friends-workflow.spec.ts:8` - Friends page loads

**Target execution time**: < 90 seconds for the full smoke suite (7 tests)

### Running Smoke Tests Locally

```bash
# Run smoke tests only
bun run test:e2e:smoke

# Run in UI mode for debugging
bun run test:e2e:smoke --ui

# Run in headed mode to watch
bun run test:e2e:smoke --headed
```

### CI Integration

Smoke tests run automatically on:
- Every push to any branch
- Every pull request

The job fails fast if smoke tests fail, preventing broken code from being merged.

## Full Test Suite

The full test suite includes all tests (smoke + additional coverage) and runs:
- Locally when requested: `bun run test:e2e`
- In CI nightly (scheduled)
- Optionally in pre-push hook when `FULL_E2E=1` is set

### Test Tags

- `@smoke` - Critical path smoke tests (fast, run on every PR)
- `@preprod` - Pre-production validation tests (currently used in stress-journeys)
- No tag - Regular e2e tests (run in full suite only)

## Test Structure

### Global Setup (`global-setup.ts`)

Runs once before all tests to:
1. Create authenticated test user via API (with retry logic)
2. Create admin user and promote to admin role
3. Store authentication state in JSON files

The setup implements exponential backoff retry logic (8 attempts, max 10s wait) to handle API startup delays.

### Global Teardown (`global-teardown.ts`)

Runs once after all tests complete to optionally clean up test data:

**Environment variables**:
- `E2E_CLEANUP_USERS=true` - Delete test users from database
- `E2E_CLEANUP_AUTH=true` - Delete auth state files

**Default behavior**: No cleanup (fast re-runs, auth states reused)

**Full cleanup example**:
```bash
E2E_CLEANUP_USERS=true E2E_CLEANUP_AUTH=true bun run test:e2e:smoke
```

**When to use cleanup**:
- Before committing (ensure clean state)
- After making auth changes (regenerate auth states)
- When test database accumulates too much data

### Per-Test Cleanup (`afterEach` hooks)

Individual tests clean up data they create:

- **Sanctum request test**: Deletes sanctum requests after each test
- **Admin approve test**: Deletes approved sanctums and pending requests
- **Post creation test**: Deletes posts after each test

This prevents data accumulation while allowing fast test re-runs (base test users persist).

### Authentication Fixtures (`fixtures/auth.ts`)

Provides reusable authentication states:
- `USER_STATE_PATH` - Regular authenticated user
- `ADMIN_STATE_PATH` - Admin user with elevated permissions

Tests can use `test.use({ storageState: USER_STATE_PATH })` to run as an authenticated user.

### API Utilities (`utils/api.ts`)

Helper functions for:

**Data creation**:
- Creating unique slugs that pass backend validation (3-24 chars, alphanumeric + hyphens)
- Making authenticated API requests
- Creating sanctum requests, posts, and other test data

**Data verification**:
- Polling for async operations (e.g., checking if request was created)
- Listing user's sanctum requests and posts

**Cleanup utilities**:
- `deleteAllMySanctumRequests()` - Delete all requests created by user
- `deleteAllMyPosts()` - Delete all posts created by user
- `deleteSanctum()` - Delete a sanctum by slug (admin only)
- `deleteSanctumRequest()` - Delete a specific sanctum request

These cleanup utilities are used in `afterEach` hooks to prevent data accumulation.

### Configuration (`config.ts`)

Centralized timeout constants:
- `TEST_TIMEOUTS.POLL` - Default timeout for async operations (15s)
- `TEST_TIMEOUTS.POLL_INTERVAL` - Polling interval for expect.poll() (500ms)
- `TEST_TIMEOUTS.RETRY_BASE` - Base delay for retry logic (2s)
- `TEST_TIMEOUTS.RETRY_MAX` - Max delay for retry logic (10s)

Use these constants instead of hardcoding timeout values.

## Writing New Tests

### Basic Test Template

```typescript
import { expect, test } from '@playwright/test'
import { TEST_TIMEOUTS } from './config'
import { USER_STATE_PATH } from './fixtures/auth'

test.describe('Feature Name', () => {
  test.use({ storageState: USER_STATE_PATH })

  test('should do something @smoke', async ({ page }) => {
    await page.goto('/your-route')

    // Your test actions
    await page.getByRole('button', { name: 'Submit' }).click()

    // Assertions
    await expect(page.getByText('Success')).toBeVisible()
  })
})
```

### Using Timeouts

Always use constants from `config.ts`:

```typescript
import { TEST_TIMEOUTS } from './config'

// For polling API state
await expect
  .poll(
    () => checkSomethingViaAPI(request, token),
    { timeout: TEST_TIMEOUTS.POLL, intervals: [TEST_TIMEOUTS.POLL_INTERVAL] }
  )
  .toBe(true)

// For UI visibility checks (Playwright auto-waits, but explicit timeout is good practice)
await expect(element).toBeVisible({ timeout: TEST_TIMEOUTS.POLL })
```

### Creating Unique Test Data

Use the `uniqueSlug()` utility to generate unique identifiers:

```typescript
import { uniqueSlug } from './utils/api'

const slug = uniqueSlug('test-prefix')  // e.g., "test-prefix-abc123"
const name = `Test Name ${slug}`
```

This ensures slugs:
- Are globally unique (timestamp + random suffix)
- Pass backend validation (3-24 chars, alphanumeric + hyphens)
- Are traceable in logs (include prefix for context)

### Deciding to Add `@smoke` Tag

Ask yourself:
1. **Would a failure here block critical user workflows?**
2. **Is this a happy-path scenario users will hit daily?**
3. **Can this test run reliably in < 10 seconds?**
4. **Does this test have minimal external dependencies?**

If yes to all → add `@smoke`

If unsure → start without `@smoke`, add it later if the test proves stable and critical

## Debugging Tests

### Run a Single Test

```bash
# By line number
bun run test:e2e sanctum-user-request.spec.ts:8

# By name pattern
bun run test:e2e -g "auth user submits request"
```

### Use UI Mode

```bash
bun run test:e2e --ui
```

This opens an interactive UI where you can:
- Step through tests
- See DOM snapshots
- View network requests
- Time travel through test execution

### View Test Report

After running tests:

```bash
bun playwright show-report reports/playwright-report
```

### Check Trace Files

Traces are captured on test failure. View them with:

```bash
bun playwright show-trace test-results/path-to-trace.zip
```

## CI/CD Integration

### Smoke Test Job (`.github/workflows/ci.yml`)

Runs on every push/PR:
1. Starts PostgreSQL and Redis services
2. Waits for services to be healthy
3. Runs database migrations
4. Executes smoke tests with `--workers=1`
5. Uploads Playwright report and videos on failure
6. Dumps service logs on failure

### Full Test Suite

Currently runs nightly (scheduled) with full parallelization.

### Pre-Push Hook

Optionally run smoke tests locally before pushing:

```bash
# In .git/hooks/pre-push
FULL_E2E=1 git push  # Run full e2e suite
# Or just push normally for smoke tests (if configured)
```

Skip with:
```bash
SKIP_E2E_PRE_PUSH=1 git push
```

## Parallelization

Smoke tests now run with **2 workers** by default for faster execution.

**Default behavior**:
```bash
bun run test:e2e:smoke  # Runs with 2 workers
```

**Environment variables**:
- `E2E_WORKERS=1` - Force sequential execution (for debugging)
- `E2E_WORKERS=4` - Use more workers (faster machines)

**Rationale**: Tests are isolated via cleanup utilities and unique identifiers, making parallel execution safe.

See `PARALLELIZATION_ANALYSIS.md` for detailed analysis.

## Known Limitations

1. **Hardcoded test user credentials**: Uses `TestPass123!@#` for all test users. Not a security issue since this is test environment only.

2. **Optional full cleanup**: Test cleanup is automatic for per-test data (posts, requests), but optional for test users. Set `E2E_CLEANUP_USERS=true` for full cleanup.

## Troubleshooting

### "signup failed" errors

**Cause**: API server not running or database not ready

**Fix**:
- Ensure backend is running: `cd backend && bun run dev`
- Check database is running: `pg_isready`
- Verify migrations are up to date: `cd backend && bun run db:migrate`

### "Cannot connect to database" errors

**Cause**: PostgreSQL not running or wrong connection details

**Fix**:
- Check `PGDATABASE`, `PGUSER`, `PGPASSWORD` environment variables
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Check global-setup.ts database selection logic

### Flaky tests

**Common causes**:
- Race conditions (element not ready)
- Network delays (API calls slow)
- Timing assumptions (hardcoded waits)

**Fixes**:
- Use Playwright auto-waiting (avoid `page.waitForTimeout()`)
- Use `expect.poll()` for async state checks
- Add `waitUntil: 'networkidle'` for page navigation
- Increase timeouts only as last resort

### Tests pass locally but fail in CI

**Common causes**:
- Different service startup times
- Race conditions exposed by CI parallelization
- Environment variable differences

**Fixes**:
- Add retry logic to global setup (already implemented)
- Check CI logs for service health check failures
- Verify environment variables match between local and CI

## Contributing

When adding new tests:

1. **Follow existing patterns**: Look at similar tests for structure
2. **Use shared utilities**: Don't duplicate slug generation, API calls, etc.
3. **Add helpful comments**: Explain WHY, not WHAT (code shows what)
4. **Test your test**: Run it locally 3-5 times to ensure stability
5. **Consider smoke tag carefully**: Don't over-populate smoke suite
6. **Update this README**: If you add new patterns or utilities

When modifying existing tests:

1. **Preserve test intent**: Don't change what's being tested without reason
2. **Maintain backward compatibility**: Other tests may depend on utilities
3. **Run full suite**: Ensure your changes don't break other tests
4. **Update comments**: If test behavior changes, update explanations

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Project Contributing Guide](../../../CONTRIBUTING.md)
