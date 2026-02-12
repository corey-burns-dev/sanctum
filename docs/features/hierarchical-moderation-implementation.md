# Hierarchical Moderation: Implementation Reference

This document describes the implemented hierarchical moderation model in Sanctum
and maps it to code, schema, routes, and runtime behavior.

## Scope

Implemented in this rollout:

1. Master admin (`users.is_admin`) remains the global authority.
2. Sanctum admin authority is based on `sanctum_memberships.role`:
   - `owner`
   - `mod` (user-facing label: "Sanctum Admin")
3. Chat moderator authority is backed by a new `chatroom_moderators` table.
4. Chat moderation authorization is centralized and reused.
5. Development root bootstrap ensures `user_id=1` admin account in development.
6. API endpoints for sanctum-admin and chat-moderator management were added.
7. Chatroom capability flags are returned to support frontend gating.

## Role Model

### Master Admin

- Backing field: `users.is_admin = true`
- Scope: Global
- Typical powers:
  - Existing `/api/admin/*` routes
  - Sanctum admin management
  - Chat moderator management
  - Chat moderation actions

### Sanctum Admin

- Backing table: `sanctum_memberships`
- Roles:
  - `owner`
  - `mod` (display as "Sanctum Admin")
- Scope: Their sanctum and linked sanctum chatroom
- Typical powers:
  - Manage sanctum admins (owner/master only for promote/demote)
  - Moderate sanctum chatrooms
  - Manage sanctum chatroom moderators

### Chat Moderator

- Backing table: `chatroom_moderators`
- Scope: Specific chatroom only
- Typical powers:
  - Moderate participants in that room
  - Cannot manage sanctum admins
  - Cannot perform sanctum-scoped admin actions by default

## Schema Changes

### New table: `chatroom_moderators`

- Migration: `backend/internal/database/migrations/000005_chatroom_moderators.up.sql`
- Rollback: `backend/internal/database/migrations/000005_chatroom_moderators.down.sql`
- Model: `backend/internal/models/chatroom_moderator.go`
- Registry: `backend/internal/database/models_registry.go`

Columns:

1. `conversation_id` (PK, FK -> `conversations.id`)
2. `user_id` (PK, FK -> `users.id`)
3. `granted_by_user_id` (FK -> `users.id`)
4. `created_at`

Index:

1. `idx_chatroom_moderators_user_id`

## Centralized Authorization Helpers

Defined in `backend/internal/server/helpers.go`.

Key helper paths:

1. `isMasterAdminByUserID`
2. `getSanctumRoleByUserID`
3. `canManageSanctumByUserID`
4. `canManageSanctumAsOwnerByUserID`
5. `isChatroomModeratorByUserID`
6. `canManageChatroomModeratorsByUserID`
7. `canModerateChatroomByUserID`

`canModerateChatroomByUserID` resolution:

1. Master admin -> allow
2. If room linked to sanctum:
   - Sanctum owner/mod -> allow
3. Explicit `chatroom_moderators` membership -> allow
4. Legacy fallback for non-sanctum rooms:
   - Room creator -> allow
5. Otherwise deny

## Backend Service Integration

`ChatService` now accepts and uses centralized room moderation authz.

- File: `backend/internal/service/chat_service.go`
- Constructor wiring:
  - `backend/internal/server/server.go`
  - `backend/internal/server/chat_handlers.go`

Affected behavior:

1. `RemoveParticipant` now checks `canModerateChatroom` (or legacy fallback if callback unset).

## API Additions

## Sanctum admin management

Routes wired in `backend/internal/server/server.go` with handlers in
`backend/internal/server/sanctum_admin_handlers.go`.

1. `GET /api/sanctums/:slug/admins`
2. `POST /api/sanctums/:slug/admins/:userId`
3. `DELETE /api/sanctums/:slug/admins/:userId`

Authz:

1. List/promote/demote require sanctum owner or master admin.
2. Demote blocks demotion of sanctum `owner`.

## Chat moderator management

Routes wired in `backend/internal/server/server.go` with handlers in
`backend/internal/server/chat_handlers.go`.

1. `GET /api/chatrooms/:id/moderators`
2. `POST /api/chatrooms/:id/moderators/:userId`
3. `DELETE /api/chatrooms/:id/moderators/:userId`

Authz:

1. Master admin OR sanctum manager for linked sanctum chatroom.

## Chatroom capability flags

Returned in chatroom payloads:

1. `capabilities.can_moderate`
2. `capabilities.can_manage_moderators`

Exposed on:

1. `GET /api/chatrooms`
2. `GET /api/chatrooms/joined`
3. `GET /api/conversations/:id` (group conversations)

Backend shape defined in `backend/internal/server/chat_handlers.go` and frontend
type in `frontend/src/api/types.ts`.

## Development Root Admin Bootstrap

Bootstrap logic:

- File: `backend/internal/bootstrap/runtime.go`
- Test: `backend/internal/bootstrap/runtime_test.go`

Behavior (development only):

1. Controlled by:
   - `DEV_BOOTSTRAP_ROOT`
   - `DEV_ROOT_USERNAME`
   - `DEV_ROOT_EMAIL`
   - `DEV_ROOT_PASSWORD`
   - `DEV_ROOT_FORCE_CREDENTIALS`
2. Ensures user `id=1` exists and is admin.
3. Can force username/email/password reset for `id=1`.
4. Attempts to bump `users.id` sequence for PostgreSQL safety.

Config surface:

1. `backend/internal/config/config.go`
2. `.env.example`
3. `config.example.yml`

## Development Root Safety Guard

Demotion guard for `user_id=1` in development:

1. API guard: `backend/internal/server/user_handlers.go`
2. CLI guard: `backend/cmd/admin/main.go`
3. Bootstrap script safety behavior: `scripts/admin_bootstrap_me.sh`

## Frontend Integration

API and types:

1. `frontend/src/api/types.ts`
2. `frontend/src/api/client.ts`

Hooks:

1. `frontend/src/hooks/useSanctums.ts`
2. `frontend/src/hooks/useChat.ts`

UI:

1. Sanctum admin management section in `frontend/src/pages/SanctumDetail.tsx`
2. Capability-based moderation label in `frontend/src/pages/Chat.tsx`

## Test Coverage Added/Updated

1. Dev root bootstrap tests:
   - `backend/internal/bootstrap/runtime_test.go`
2. Chat service authorization constructor/test updates:
   - `backend/internal/service/chat_service_test.go`
3. Migration table expectations updated:
   - `backend/test/sanctum_migration_seed_test.go`

## Backward Compatibility Notes

1. Global `is_admin` semantics are preserved.
2. Existing `/api/admin/sanctum-requests` flow remains unchanged.
3. Existing chat routes are preserved; payloads only add optional `capabilities`.
4. Sanctum role enum in DB remains `owner|mod|member`.
