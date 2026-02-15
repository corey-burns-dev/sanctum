# Parallelization Analysis

## Current State

**Smoke tests run with `--workers=1`** (single worker, sequential execution)

**Location**: `scripts/run-e2e-smoke.sh:23`

## Why Single Worker?

Historical reasons (likely):
1. Test isolation concerns
2. Database contention
3. Shared authentication states

## Test Isolation Review

### Global Setup (Shared Resources)

**Created once before all tests**:
- Test user (username: `e2euser`, stored in `USER_STATE_PATH`)
- Admin user (username: `e2eadmin`, stored in `ADMIN_STATE_PATH`)

**Shared by**: All tests using `storageState`

**Isolation**: ✅ Read-only (tests don't modify these users)

### Tests Using USER_STATE_PATH (6 tests)

| Test | Creates | Cleans Up | Parallelization Safe? |
|------|---------|-----------|----------------------|
| `navigation.spec.ts:8` | Nothing | N/A | ✅ Yes |
| `sanctum-user-request.spec.ts:9` | Sanctum requests | ✅ afterEach | ✅ Yes |
| `sanctum-open-chat.spec.ts:7` | Nothing | N/A | ✅ Yes |
| `stress-journeys.spec.ts:8` | Posts | ✅ afterEach | ✅ Yes |
| `stress-journeys.spec.ts:28` | Nothing | N/A | ✅ Yes (not smoke) |
| `friends-workflow.spec.ts:8` | Nothing | N/A | ✅ Yes |

**Assessment**: All tests using USER_STATE_PATH are now isolated via cleanup

### Tests Using ADMIN_STATE_PATH (1 test)

| Test | Creates | Cleans Up | Parallelization Safe? |
|------|---------|-----------|----------------------|
| `sanctum-admin-approve.spec.ts:50` | Sanctum requests + sanctums | ✅ afterEach | ✅ Yes |

**Assessment**: Single test, no conflicts

### Tests Creating New Users (1 test)

| Test | Creates | Cleans Up | Parallelization Safe? |
|------|---------|-----------|----------------------|
| `auth-flows.spec.ts:4` | New user | ⚠️ No (optional global teardown) | ✅ Yes |

**Assessment**: Creates unique user each time (timestamp + random suffix), no conflicts

## Potential Issues

### 1. Database Contention ⚠️

**Scenario**: Multiple tests hitting database simultaneously

**Impact**: Possible slowdown, not a correctness issue

**Mitigation**: PostgreSQL handles concurrent connections well

### 2. API Rate Limiting ⚠️

**Scenario**: Many parallel requests to API

**Impact**: Possible 429 errors if rate limiting exists

**Current**: No evidence of rate limiting in test environment

### 3. Cleanup Race Conditions ⚠️

**Scenario**: Test finishes, cleanup runs, but another test is still accessing shared data

**Current**: ✅ No shared mutable data (each test creates unique slugs/posts)

## Recommendation: Enable Parallelization

### Evidence Supporting Parallelization ✅

1. **Test isolation implemented**: All tests clean up their data
2. **Unique identifiers**: Tests use `uniqueSlug()` with timestamps + random
3. **Read-only shared state**: Auth states are not modified
4. **No observable conflicts**: Tests don't share mutable resources

### Proposed Change

**Before**:
```bash
bun run test:e2e -- --grep @smoke --workers=1
```

**After**:
```bash
# Default: Use Playwright's default (CPU cores)
bun run test:e2e -- --grep @smoke

# Or configure based on environment:
WORKERS=${E2E_WORKERS:-2}
bun run test:e2e -- --grep @smoke --workers=$WORKERS
```

### Testing Plan

1. **Phase 1**: Test with `--workers=2` locally
   - Run smoke suite 5 times
   - Verify no failures
   - Check for race conditions

2. **Phase 2**: Test with `--workers=3` in CI
   - Monitor for flakiness
   - Compare execution times

3. **Phase 3**: Enable full parallelization
   - Use Playwright default (CPU cores)
   - Monitor for issues
   - Rollback if needed

### Expected Performance Improvement

**Current**: 7 tests × ~5-10s each = ~35-70s (sequential)

**With 2 workers**: ~20-40s (40-50% faster)

**With 4 workers**: ~10-20s (60-70% faster)

**CI benefit**: Faster feedback loop, less queue time

## Implementation

### Option 1: Remove --workers=1 (Recommended)

Let Playwright use default parallelization (CPU cores):

```bash
# scripts/run-e2e-smoke.sh:23
- bun run test:e2e -- --grep @smoke --workers=1
+ bun run test:e2e -- --grep @smoke
```

**Pros**: Maximum speed, simple
**Cons**: May overwhelm slow machines

### Option 2: Configurable Workers

Allow environment variable override:

```bash
# scripts/run-e2e-smoke.sh:23
+ WORKERS=${E2E_WORKERS:-2}
- bun run test:e2e -- --grep @smoke --workers=1
+ bun run test:e2e -- --grep @smoke --workers=$WORKERS
```

**Pros**: Flexible, can tune per environment
**Cons**: Slightly more complex

### Option 3: Conservative (2 workers)

Fixed to 2 workers for predictability:

```bash
# scripts/run-e2e-smoke.sh:23
- bun run test:e2e -- --grep @smoke --workers=1
+ bun run test:e2e -- --grep @smoke --workers=2
```

**Pros**: Safe middle ground, 2x speedup
**Cons**: Doesn't leverage faster machines

## Risks and Mitigation

### Risk 1: Flaky Tests

**Symptom**: Tests pass individually but fail in parallel

**Mitigation**:
- Monitor CI for increased flakiness
- Add retries in CI (already configured: 1 retry)
- Rollback to `--workers=1` if needed

### Risk 2: Resource Exhaustion

**Symptom**: Database connections or memory issues

**Mitigation**:
- Start with `--workers=2` (conservative)
- Monitor resource usage
- Increase gradually if stable

### Risk 3: Cleanup Conflicts

**Symptom**: Tests interfere with each other's cleanup

**Mitigation**:
- Unique identifiers prevent conflicts
- Cleanup utilities handle 404s gracefully
- Tests are already isolated

## Decision

✅ **Recommended**: Enable parallelization with 2 workers

**Rationale**:
1. Tests are properly isolated (cleanup implemented)
2. No shared mutable state
3. Unique identifiers prevent conflicts
4. 40-50% performance improvement
5. Low risk with monitoring

**Rollback plan**: Change `--workers=2` back to `--workers=1` if issues arise

## Implementation Steps

1. Update `scripts/run-e2e-smoke.sh` to use `--workers=2`
2. Update documentation (README.md)
3. Test locally (run 10 times, verify no failures)
4. Monitor CI for 1 week
5. Gradually increase to `--workers=4` if stable
6. Document findings in this file
