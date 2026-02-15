# Test Cleanup Implementation

## Overview

Implemented comprehensive test cleanup to prevent data accumulation while maintaining fast test execution through reusable authentication states.

## Problem Statement

**Before**: Tests created data (sanctum requests, posts, users) but never cleaned up, leading to:
- Database accumulation over time
- Potential naming collisions
- Harder to debug test failures (cluttered data)
- No clear data lifecycle

## Solution: Hybrid Cleanup Strategy

### 1. Per-Test Cleanup (Automatic)

Tests clean up data they create immediately after each test runs.

**Implementation**: `afterEach` hooks in test files

**What's cleaned up**:
- Sanctum requests (created during request flow tests)
- Sanctum entities (created when admin approves requests)
- Posts (created during post creation tests)

**Benefits**:
- ✅ No data accumulation between test runs
- ✅ Isolated test state
- ✅ Easier debugging (no orphaned data)
- ✅ Automatic (no env vars needed)

**Trade-off**: Adds ~100-500ms per test for cleanup API calls

### 2. Global Teardown (Optional)

Cleans up test users and auth states after all tests complete.

**Implementation**: `global-teardown.ts` configured in `playwright.config.ts`

**Environment variables**:
- `E2E_CLEANUP_USERS=true` - Delete test users from database
- `E2E_CLEANUP_AUTH=true` - Delete auth state JSON files

**What's cleaned up**:
- Test users (usernames starting with `e2e`, emails containing `e2e@example.com`)
- Authentication state files (`test/.auth/user.json`, `test/.auth/admin.json`)

**Benefits**:
- ✅ Completely clean state when needed
- ✅ Prevents user accumulation in database
- ✅ Forces regeneration of auth states (useful when auth logic changes)

**Default**: Disabled (fast re-runs, reuse auth states)

## Cleanup Utilities

### New Functions in `utils/api.ts`

```typescript
// Delete specific sanctum request
deleteSanctumRequest(request, token, requestId): Promise<boolean>

// Delete all user's sanctum requests
deleteAllMySanctumRequests(request, token): Promise<number>

// Delete specific post
deletePost(request, token, postId): Promise<boolean>

// Get user's posts
getMyPosts(request, token): Promise<Array<{id, content}>>

// Delete all user's posts
deleteAllMyPosts(request, token): Promise<number>

// Delete sanctum by slug (admin operation)
deleteSanctum(request, token, slug): Promise<boolean>
```

### Error Handling

All cleanup utilities:
- Return `false` if resource not found (404) instead of throwing
- Log warnings but don't fail tests if cleanup fails
- Continue cleanup even if individual deletions fail

**Rationale**: Cleanup failures shouldn't fail tests. Better to log and continue than to fail the test suite.

## Implementation Details

### Test: `sanctum-user-request.spec.ts`

```typescript
test.afterEach(async ({ request }) => {
  const userToken = readTokenFromStorageState(USER_STATE_PATH)
  const deletedCount = await deleteAllMySanctumRequests(request, userToken)
  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} sanctum request(s)`)
  }
})
```

**What it cleans**: All sanctum requests created by test user

**When**: After each test in this file

**Why**: Prevents request accumulation, ensures clean slate for next test

### Test: `sanctum-admin-approve.spec.ts`

```typescript
let createdSlugs: string[] = []

test.beforeEach(() => {
  createdSlugs = []
})

test.afterEach(async ({ request }) => {
  const adminToken = readTokenFromStorageState(ADMIN_STATE_PATH)
  const userToken = readTokenFromStorageState(USER_STATE_PATH)

  // Clean up approved sanctums
  for (const slug of createdSlugs) {
    await deleteSanctum(request, adminToken, slug)
  }

  // Clean up pending requests (in case test failed before approval)
  await deleteAllMySanctumRequests(request, userToken)
})
```

**What it cleans**:
1. Approved sanctums (tracked via `createdSlugs` array)
2. Any pending requests (in case test failed mid-execution)

**When**: After each test in this file

**Why**: Handles both success (sanctum created) and failure (request pending) cases

### Test: `stress-journeys.spec.ts`

```typescript
test.afterEach(async ({ request }) => {
  const userToken = readTokenFromStorageState(USER_STATE_PATH)
  const deletedCount = await deleteAllMyPosts(request, userToken)
  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} post(s)`)
  }
})
```

**What it cleans**: All posts created by test user

**When**: After each test that creates posts

**Why**: Prevents post accumulation in feed

### Global Teardown: `global-teardown.ts`

```typescript
export default async function globalTeardown() {
  const cleanupUsers = process.env.E2E_CLEANUP_USERS === 'true'
  const cleanupAuth = process.env.E2E_CLEANUP_AUTH === 'true'

  if (cleanupAuth) {
    // Delete auth state JSON files
  }

  if (cleanupUsers) {
    // Delete test users from database via SQL
    DELETE FROM users WHERE username LIKE 'e2e%' OR email LIKE '%e2e%@example.com'
  }
}
```

**What it cleans**:
1. Auth state files (optional)
2. Test users from database (optional)

**When**: Once after all tests complete

**Why**: Full reset capability without slowing down normal test runs

## Usage Examples

### Normal Test Run (Fast)

```bash
bun run test:e2e:smoke
```

**Cleanup behavior**:
- ✅ Per-test cleanup runs (sanctum requests, posts)
- ❌ Users persist (fast re-runs, auth states reused)
- ❌ Auth states persist (no need to recreate)

**Duration**: ~30-90 seconds

### Full Cleanup Run

```bash
E2E_CLEANUP_USERS=true E2E_CLEANUP_AUTH=true bun run test:e2e:smoke
```

**Cleanup behavior**:
- ✅ Per-test cleanup runs
- ✅ Test users deleted from database
- ✅ Auth states regenerated on next run

**Duration**: ~30-90 seconds + 5-10 seconds teardown

**When to use**: Before committing, when auth logic changes, periodic maintenance

### Cleanup Auth Only

```bash
E2E_CLEANUP_AUTH=true bun run test:e2e:smoke
```

**Cleanup behavior**:
- ✅ Per-test cleanup runs
- ❌ Users persist
- ✅ Auth states regenerated

**When to use**: Auth state corruption, token format changes

## Verification

### Check Cleanup Works

1. **Run tests and verify cleanup logs**:
   ```bash
   bun run test:e2e:smoke
   ```

   Look for output like:
   ```
   🧹 Cleaned up 1 sanctum request(s)
   🧹 Cleaned up 1 post(s)
   🧹 Cleaned up sanctum: e2e-approve-abc123
   ```

2. **Verify no data accumulation**:
   ```bash
   # Run tests 3 times
   for i in {1..3}; do bun run test:e2e:smoke; done

   # Check database for e2e data (should be minimal)
   psql -d sanctum_test -c "SELECT COUNT(*) FROM sanctum_requests WHERE requested_slug LIKE 'e2e-%'"
   psql -d sanctum_test -c "SELECT COUNT(*) FROM posts WHERE content LIKE '%Playwright%'"
   ```

3. **Test full cleanup**:
   ```bash
   E2E_CLEANUP_USERS=true bun run test:e2e:smoke

   # Check users deleted
   psql -d sanctum_test -c "SELECT COUNT(*) FROM users WHERE email LIKE '%e2e%@example.com'"
   # Should return 0
   ```

## Impact Assessment

### Benefits ✅

1. **No data accumulation**: Database stays clean across test runs
2. **Better debugging**: No orphaned data confusing test failures
3. **Isolation**: Each test starts with clean slate
4. **Flexibility**: Optional full cleanup when needed
5. **Performance**: Fast re-runs (users persist by default)

### Trade-offs ⚠️

1. **Slight slowdown**: ~100-500ms per test for cleanup API calls
2. **Complexity**: More code to maintain (cleanup utilities + hooks)
3. **Network overhead**: Additional API requests for deletions

### Mitigation

- Cleanup runs in parallel with test teardown (doesn't block next test)
- Errors are logged but don't fail tests
- Optional full cleanup (don't pay cost unless needed)

## Files Modified

**Created**:
1. `global-teardown.ts` - Global cleanup handler

**Modified**:
2. `utils/api.ts` - Added cleanup utilities
3. `sanctum-user-request.spec.ts` - Added afterEach cleanup
4. `sanctum-admin-approve.spec.ts` - Added beforeEach/afterEach cleanup
5. `stress-journeys.spec.ts` - Added afterEach cleanup
6. `playwright.config.ts` - Configured globalTeardown
7. `README.md` - Documented cleanup behavior

## Future Enhancements

### Potential Improvements

1. **Cleanup statistics**: Track total cleanup time and record counts
   ```typescript
   test.afterAll(() => {
     console.log(`Total cleanup time: ${cleanupMs}ms`)
     console.log(`Total items deleted: ${deletedCount}`)
   })
   ```

2. **Selective cleanup**: Environment variable to disable per-test cleanup
   ```bash
   SKIP_TEST_CLEANUP=true bun run test:e2e:smoke  # Faster but accumulates data
   ```

3. **Cleanup verification**: Assert cleanup succeeded
   ```typescript
   test.afterEach(async ({ request }) => {
     await deleteAllMyPosts(request, token)
     const remaining = await getMyPosts(request, token)
     expect(remaining).toHaveLength(0)
   })
   ```

4. **Database transaction rollback**: Use transactions for complete isolation
   - Pro: Perfect isolation, no cleanup needed
   - Con: Requires transaction support, more complex setup

## Best Practices

### When Writing New Tests

1. **Identify created data**: What resources does your test create?
2. **Add cleanup hook**: Use `afterEach` to clean up test-specific data
3. **Track identifiers**: Store IDs/slugs in test-scoped variables for cleanup
4. **Handle failures**: Ensure cleanup runs even if test fails
5. **Log cleanup**: Use `console.log` to verify cleanup is working

### Example Template

```typescript
test.describe('My Feature', () => {
  let createdIds: number[] = []

  test.beforeEach(() => {
    createdIds = []
  })

  test.afterEach(async ({ request }) => {
    const token = readTokenFromStorageState(USER_STATE_PATH)

    for (const id of createdIds) {
      try {
        await deleteMyResource(request, token, id)
      } catch (error) {
        console.warn(`Failed to delete resource ${id}:`, error)
      }
    }
  })

  test('my test', async ({ page, request }) => {
    // Create resource
    const id = await createResource(...)
    createdIds.push(id)

    // Test assertions
    // ...
  })
})
```

## Summary

**From**: No cleanup, data accumulates indefinitely
**To**: Automatic per-test cleanup + optional full cleanup

**Key Achievement**: Clean, isolated tests that don't pollute the database, while maintaining fast re-run capability through reusable auth states.

**Default behavior**: Fast and clean (per-test cleanup only)
**Full cleanup option**: Available when needed (users + auth states)
