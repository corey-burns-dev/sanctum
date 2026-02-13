## Fix WebSocket 401 Loop After Signup (Handshake Ticket Consumption)

### Summary

The signup flow succeeds, but immediately after auth the frontend opens realtime sockets and receives repeated WebSocket failures. Current behavior shows:

- `POST /api/ws/ticket` returns `200`
- `GET /api/ws*` returns `401` in a loop

Plan is to restore the previously stable handshake path by moving WS ticket consumption out of `AuthRequired()` `GETDEL` and into WebSocket handlers after successful upgrade/user resolution.

### Root-Cause Hypothesis to Implement Against

`AuthRequired()` currently consumes ticket via `GETDEL` in middleware (`backend/internal/server/server.go`). For WS upgrades, request/middleware path can be evaluated more than once during handshake pathing, causing ticket to be consumed too early and subsequent pass to fail with `Invalid or expired WebSocket ticket`.

### Public API / Interface / Type Changes

- No public API path changes.
- No request/response schema changes.
- No frontend type changes.
- Behavior change only: valid WS tickets reliably establish WS connections instead of failing with immediate 401 loops.

### Implementation Plan

1. Backend: make WS ticket validation handshake-safe

- File: `backend/internal/server/server.go`
- In `AuthRequired()`:
  - Replace `GetDel` path for WS tickets with:
    - `GET` to validate and resolve `userID`
    - do **not** delete ticket in middleware for WS paths
  - Keep existing behavior for non-WS paths unchanged.
  - Preserve existing unauthorized response for invalid/expired ticket on WS paths.

1. Backend: consume ticket in WS handlers after successful auth context

- File: `backend/internal/server/example_handlers.go`
  - In `WebsocketHandler()`, after `userID` is confirmed, delete key `ws_ticket:<ticket>` best-effort.
- File: `backend/internal/server/websocket_handlers.go`
  - In `WebSocketChatHandler()`, same post-auth consume behavior.
- File: `backend/internal/server/game_handlers.go`
  - In `WebSocketGameHandler()`, same post-auth consume behavior.
- Consumption semantics:
  - Best-effort deletion (`Del`) if ticket present and Redis client exists.
  - Do not fail established connection if delete operation errors.

1. Guardrails and logging

- Add debug-level or minimal server log comments around WS ticket validation/consume points (no ticket value logging).
- Keep current error response text (`Invalid or expired WebSocket ticket`) for compatibility.

1. Frontend: no functional changes for this fix

- Existing reconnect/backoff behavior in:
  - `frontend/src/providers/ChatProvider.tsx`
  - `frontend/src/hooks/useRealtimeNotifications.ts`
  - `frontend/src/hooks/useGameRoomSession.ts`
  remains unchanged.
- This backend fix should eliminate reconnect thrash by restoring successful WS establishment.

### Test Cases and Scenarios

1. Middleware behavior tests

- File: `backend/internal/server/middleware_test.go`
- Add/extend tests for WS ticket path:
  - valid ticket allows request through auth middleware on `/api/ws*`
  - invalid ticket returns `401`
  - non-WS token logic still works as before

1. WebSocket handler ticket consumption tests (targeted)

- Add tests ensuring:
  - ticket key remains available through middleware for WS path
  - handler consumes ticket after user resolution
  - second connection attempt with same ticket fails

1. Regression check: signup -> realtime bootstrap

- Scenario:
  - signup/login success
  - issue WS ticket
  - connect notifications/chat websocket
- Expected:
  - WS opens successfully
  - no repeated `GET /api/ws` `401` increment pattern

1. Manual verification

- Confirm logs no longer show repeated:
  - `WebSocket connection to 'ws://.../api/ws?...' failed`
- Confirm metrics trend:
  - `POST /api/ws/ticket` 200 remains
  - sharp reduction of `GET /api/ws` 401 during normal signed-in navigation

### Acceptance Criteria

- After signup/login, chat/notification/game sockets connect without repeated handshake failures.
- `docs/logs/problem-log.txt` reproduction path no longer emits continuous WS error loop.
- No regressions in HTTP auth flows (`/auth/*`, protected REST endpoints).
- Existing backend tests pass, plus new WS ticket regression coverage.

### Assumptions and Defaults

- Scope is backend handshake correctness only (no UI changes).
- Priority is restoring stable realtime connectivity now.
- Atomic single-use strictness via middleware `GETDEL` is intentionally relaxed for WS handshake safety in this patch.
- Future hardening (if needed): move to a handshake-safe atomic consume model using a dedicated Redis script + connection nonce, separate task.
