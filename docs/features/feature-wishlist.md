# Feature Wishlist

> **Note:** This document was consolidated from `MORE_FEATURES.md` and `cool_features_to_add_for_learning_fun.md` on 2026-02-12.

This document contains both production-ready feature ideas and experimental/learning-focused features. Features are organized by priority and learning value.

---

## 🔴 Critical - Tier 1: Production Readiness

### Observability & Monitoring

- [x] **Implement Custom Prometheus Metrics** (in progress on obs-monitoring branch)
  - Add custom collectors for Redis error rates
  - Track database query P95 latency
  - Monitor WebSocket connection counts per room
  - Track message throughput rates

- [x] **Add Distributed Tracing** (in progress on obs-monitoring branch)
  - Integrate OpenTelemetry for end-to-end request tracing
  - Trace requests through API → Service → Database → Redis
  - Add trace context propagation across WebSocket connections
  - Configure sampling rates for production

- [x] **Enhance Logging Coverage** (in progress on obs-monitoring branch)
  - Add structured logging to all repository methods
  - Log WebSocket connection lifecycle events (connect, disconnect, errors)
  - Include correlation IDs in all async operations

### Database & Caching

- [x] **Implement Read/Write Database Separation**
  - Configure GORM with separate read replica connections
  - Route all SELECT queries to read replicas
  - Ensure write operations use primary database
  - Add fallback logic if read replica is unavailable

- [x] **Migrate from Auto-Migration to Controlled Migrations**
  - Remove GORM AutoMigrate from production code
  - Implement migration tool (e.g., golang-migrate, goose)
  - Create rollback procedures for all migrations
  - Add migration version tracking

- [x] **Define Caching Strategy with TTLs**
  - Cache user profiles with 5-minute TTL
  - Cache room metadata with 10-minute TTL
  - Cache message history (last 50 messages) with 2-minute TTL
  - Implement cache invalidation on user updates
  - Implement cache invalidation on room updates
  - Add cache-aside pattern for all read-heavy operations


## 🟡 High Priority - Tier 2: Scale-Ready Architecture

### Code Architecture

- [x] **Introduce Service Layer**
  - Create `/internal/service` package
  - Extract business logic from handlers to service layer
  - Pattern: Handler → Service → Repository
  - Handlers should only handle I/O, validation, and serialization
  - Services should contain all business rules and orchestration
  - Initial rollout completed for posts via `backend/internal/service/post_service.go`
  - Continued rollout completed for comments via `backend/internal/service/comment_service.go`
  - Continued rollout completed for core chat flows via `backend/internal/service/chat_service.go`
  - Continued rollout completed for user/profile flows via `backend/internal/service/user_service.go`
  - Continued rollout completed for friendship flows via `backend/internal/service/friend_service.go`
  - Continued rollout completed for game room orchestration via `backend/internal/service/game_service.go`

- [ ] **Refactor to Use API Contracts as Source of Truth**
  - Generate server stubs from OpenAPI spec
  - Generate client SDKs from OpenAPI spec
  - Enforce spec-first development workflow
  - Add CI validation that code matches spec

### Background Processing

- [ ] **Implement Job Queue for Async Operations**
  - Integrate job queue library (Asynq or Machinery)
  - Move email notifications to background jobs
  - Move WebSocket notifications to background jobs (except real-time chat)
  - Move welcome bot messages to background jobs
  - Add retry logic with exponential backoff
  - Implement dead letter queue for failed jobs

### Deployment & Health

- [ ] **Add Health/Readiness Probes to App Service**
  - Create `/health/live` endpoint (checks if server is running)
  - Create `/health/ready` endpoint (checks DB, Redis, dependencies)
  - Update `compose.yml` with health check configuration
  - Configure appropriate timeouts and intervals

## 🟢 Medium Priority - Modern Chat Features

### Core Interaction Patterns

- [ ] **Implement Threaded Replies**
  - Add `parent_message_id` field to Message model
  - Create API endpoint: `POST /rooms/:id/messages/:messageId/replies`
  - Create API endpoint: `GET /rooms/:id/messages/:messageId/thread`
  - Display threaded UI in frontend
  - Broadcast thread updates via WebSocket

- [ ] **Add @Mention System**
  - Parse message content for `@username` patterns
  - Create notifications for mentioned users
  - Store mentions in database (many-to-many: messages ↔ users)
  - Add API endpoint: `GET /users/me/mentions`
  - Highlight mentions in message UI

- [ ] **Implement Message Reactions**
  - Create Reaction model (message_id, user_id, emoji)
  - Create API endpoint: `POST /rooms/:id/messages/:messageId/reactions`
  - Create API endpoint: `DELETE /rooms/:id/messages/:messageId/reactions/:emoji`
  - Aggregate reaction counts per message
  - Broadcast reaction updates via WebSocket

- [ ] **Add Rich Text / Markdown Support**
  - Implement markdown parsing on backend (use `goldmark`)
  - Sanitize HTML output to prevent XSS
  - Integrate DOMPurify on frontend
  - Support: bold, italic, code blocks, links, lists
  - Add markdown preview in message composer

### UX Enhancements

- [ ] **Implement Infinite Scroll for Message History**
  - Modify backend to support cursor-based pagination
  - Add `before` query parameter to `GET /rooms/:id/messages`
  - Integrate TanStack Query on frontend
  - Fetch older messages when user scrolls to top
  - Maintain scroll position after loading history

- [ ] **Add Message Edit & Soft Delete**
  - Add `deleted_at` and `edited_at` timestamps to Message model
  - Create API endpoint: `PATCH /rooms/:id/messages/:messageId` (edit)
  - Create API endpoint: `DELETE /rooms/:id/messages/:messageId` (soft delete)
  - Show "(edited)" indicator on edited messages
  - Show "(deleted)" placeholder for deleted messages
  - Maintain audit trail in database

- [ ] **Implement Read Receipts (DMs only)**
  - Create MessageReceipt model (message_id, user_id, read_at)
  - Track "Delivered" status (message sent to recipient)
  - Track "Read" status (recipient opened conversation)
  - Create API endpoint: `POST /messages/:id/read`
  - Display status indicators in UI

- [ ] **Add Unread Message Indicator**
  - Store last-read message ID per user per room
  - Calculate unread count on room list
  - Display "New Messages" divider in message list
  - Auto-scroll to first unread message when opening room

### Community Features

- [ ] **Implement Report & Block Mechanisms**
  - Create Report model (reporter_id, reported_user_id, message_id, reason)
  - Create Block model (blocker_id, blocked_id)
  - Create API endpoint: `POST /users/:id/block`
  - Create API endpoint: `POST /messages/:id/report`
  - Hide blocked users' messages from blocker's view
  - Create admin moderation dashboard

- [ ] **Add Welcome Bot**
  - Create system user account ("WelcomeBot")
  - Trigger welcome message on user's first room join
  - Include quick tutorial on features (@mentions, /commands)
  - Personalize message with user's name

- [ ] **Implement Empty State Coaching**
  - Show placeholder text in empty rooms: "Be the first to say hello!"
  - Display room guidelines/description when no messages
  - Add "Invite friends" CTA in empty private rooms

### Role-Based Access Control

- [x] **Implement Hierarchical Moderation Foundation**
  - Added role hierarchy:
    - Master Admin (`users.is_admin`)
    - Sanctum Admin (`sanctum_memberships.role` = `owner|mod`)
    - Chat Moderator (`chatroom_moderators`)
  - Added centralized authz checks for sanctum/chat moderation paths.
  - Added sanctum-admin and chat-moderator management endpoints.
  - Added chatroom `capabilities` flags for frontend gating.
  - Added development root bootstrap (`user_id=1`) + dev safety guards.
  - Docs:
    - Implementation: `docs/features/hierarchical-moderation-implementation.md`
    - Usage: `docs/guides/hierarchical-moderation-guide.md`

- [ ] **Expand RBAC Beyond IsAdmin**
  - Create Role model (id, name, permissions)
  - Create UserRole junction table
  - Add permissions: `message.pin`, `user.mute`, `message.delete`
  - Implement role checking middleware
  - Create admin endpoints for role management

- [ ] **Add Message Pinning**
  - Add `pinned` boolean field to Message model
  - Create API endpoint: `POST /rooms/:id/messages/:messageId/pin` (admin only)
  - Display pinned messages at top of room
  - Limit to 3 pinned messages per room

- [ ] **Add User Muting (Moderation)**
  - Create Mute model (room_id, user_id, muted_until, muted_by)
  - Create API endpoint: `POST /rooms/:id/mute/:userId` (admin only)
  - Prevent muted users from sending messages
  - Show mute expiration in UI
  - Auto-unmute after expiration

## 🔵 Low Priority - Quality of Life

### Advanced Features

- [ ] **Implement Link Previews (Open Graph)**
  - Create microservice/function to scrape URLs
  - Extract Open Graph metadata (title, description, image)
  - Cache preview data in Redis (24-hour TTL)
  - Display preview cards for shared links
  - Add privacy toggle to disable link previews

- [ ] **Add System Messages**
  - Generate system messages for user joins/leaves
  - Format: "*Username joined the room*"
  - Trigger from existing presence logic
  - Style differently from user messages (grey/italics)

- [ ] **Enhance Typing Indicators**
  - Ensure robust typing indicator across all rooms
  - Add debouncing (500ms) to reduce broadcasts
  - Clear indicator after 5 seconds of inactivity
  - Show multiple users typing: "Alice and Bob are typing..."

- [ ] **Implement Feature Flags**
  - Integrate feature flag library (LaunchDarkly, Unleash, or custom)
  - Wrap new features in flag checks
  - Create admin UI for toggling features
  - Implement gradual rollouts (percentage-based)

## 🧪 Testing & Safety

- [ ] **Run Tests with Race Detector**
  - Add `-race` flag to CI test command
  - Fix any race conditions detected
  - Ensure all concurrent code is race-safe

- [ ] **Add Load Testing**
  - Create load test scenarios (k6 or Locust)
  - Test WebSocket connection limits
  - Test message throughput under load
  - Identify bottlenecks and optimize

- [ ] **Implement Circuit Breakers**
  - Add circuit breaker for database calls
  - Add circuit breaker for Redis calls
  - Add circuit breaker for external services
  - Configure thresholds and timeout behavior

---

## **Admin Dashboard Design**

An admin page is essential for a "moderated" growth strategy. Since you are using React and `shadcn` components, you can build a view at `/admin` with the following sections:

### **Moderation & Ban Management**

* **Flagged Content:** A list of posts or comments reported by users for violating the "No Politics/News" rule.
* **Ban Requests:** If you implement a "Report User" feature, this queue shows users with repeated violations.
* **User Management:** Ability to search for a user and toggle a `IsBanned` or `IsModerator` flag on their profile.

### **System Health & Statistics**

* **Growth Metrics:** Real-time counters for `Total Users`, `Active Sanctuaries`, and `Daily Posts`.
* **Traffic Monitoring:** Integrate a view for your rate-limiter to see if any specific IP addresses are hitting the API too hard.

### **New Admin Feature Ideas**

* **"Shadow Ban" Toggle:** Instead of a hard ban, you could "Shadow Ban" a user where only they see their own posts. This is a classic "senior-level" anti-abuse tactic.
* **Global Announcement Tool:** A way to push a "System Message" notification to every user's `RealtimeNotifications` feed.
* **Content Spotlight:** An admin tool to mark specific "Community of the Month" or "Default" sanctuararies to help new users find quality content.
* **Audit Log:** A read-only list of every action taken by admins (e.g., "Admin A approved Community X") to ensure accountability.

---

## 🎮 Real-Time & Multiplayer Learning Features

Great for learning distributed systems, real-time state, and server authority.

### 1. Turn-Based Multiplayer Games

Examples:

- Tic-Tac-Toe
- Connect-4
- Chess (basic rules)
- Word or trivia games

Key concepts you'll learn:

- Server-authoritative game state
- Real-time updates via WebSockets
- Matchmaking and room management
- Turn validation and cheating prevention
- Reconnection and resume logic

**Tip:** Start turn-based, not physics-based. Turn-based games teach harder and more transferable problems.

### 2. Spectator Mode (Underrated but Powerful)

Allow other users to watch games in progress.

What you'll learn:

- Read-only real-time streams
- Permissioned WebSocket connections
- Broadcast fan-out at scale
- Efficient state syncing

This feels very "production-grade" and is impressive to explain.

---

## 🧠 Systems That Make You a Better Engineer

These features aren't flashy, but they build serious backend and product intuition.

### 3. Recommendation System

Examples:

- People you may want to follow
- Posts you may like
- Games you might enjoy

Start simple:

- Mutual friends
- Shared activity
- Recent interactions

You'll learn:

- Ranking and scoring algorithms
- Data modeling tradeoffs
- Performance vs accuracy
- Cold-start problems

### 4. Real Notification Engine

Beyond simple alerts.

Features:

- Batched notifications
- Read/unread state
- User preferences
- In-app vs push vs email (can be mocked)

You'll learn:

- Event-driven architecture
- Async jobs and workers
- Idempotency
- Fan-out strategies

### 5. Feature Flags & Experiments

Ability to:

- Enable features for subsets of users
- Gradually roll out changes
- Instantly disable broken features

You'll learn:

- Safe deployment strategies
- A/B testing basics
- Product experimentation mindset

This is extremely impressive in portfolios and interviews.

---

## 🧩 Advanced Backend Challenges

These features sharpen your data and infrastructure skills.

### 6. Search System

Add search for:

- Users
- Posts
- Games

Progression:

1. SQL `LIKE`
2. Full-text search
3. Ranking and relevance

You'll learn:

- Indexing strategies
- Query optimization
- Relevance scoring

### 7. Rate Limiting & Abuse Prevention

Make the app hostile-traffic ready.

Add:

- Per-user rate limits
- Per-IP rate limits
- Burst vs sustained traffic handling

You'll learn:

- Token bucket algorithms
- Redis-based counters
- Practical security thinking

---

## 🎨 Frontend & UX Power Moves

These improve perceived quality and real-world UX skills.

### 8. Offline Mode & Optimistic UI

Examples:

- Send messages while offline
- Queue actions and sync later
- Optimistic likes and comments

You'll learn:

- State reconciliation
- Conflict resolution
- Distributed systems edge cases

### 9. Customizable Profiles (Done Right)

Not just colors.

Ideas:

- Profile widgets
- Public stats (games won, activity)
- Fine-grained privacy controls

You'll learn:

- Permission systems
- Flexible schemas
- UI composition patterns

---

## 🧪 Infra & Scale Learning (Advanced)

These are "senior-level" learning features.

### 10. Shadow Traffic & Replay

- Record real requests
- Replay them against new versions

You'll learn:

- Safe deploy techniques
- Production debugging
- Observability-driven development

### 11. Event Log / Activity Feed

Build a real event system:

- User did X
- Game started
- Friend joined

Consume events for:

- Activity feeds
- Notifications
- Analytics

You'll learn:

- Event-driven design
- System decoupling
- Long-term scalability

---

## 🏁 Recommended Path (Best Learning ROI)

If the goal is **maximum learning + cool factor**, prioritize:

1. 🎮 Turn-based multiplayer games
2. 🔔 Real notification engine
3. 🧠 Recommendation system
4. 🚦 Rate limiting & abuse prevention
5. 🧪 Feature flags

---

## 📝 Implementation Notes

**For AI Agents:**
- Each checkbox represents a discrete task
- Tasks include specific endpoints, models, and technical details
- Prioritize Tier 1 (🔴) before Tier 2 (🟡)
- Review existing code patterns before implementing
- Ensure all database changes include migrations
- Add tests for each new feature
- Update OpenAPI spec with new endpoints

**Current Strengths:**
- ✅ Structured logging with slog
- ✅ Redis Pub/Sub for WebSocket scaling
- ✅ Basic rate limiting
- ✅ WebSocket hub architecture
- ✅ Integration test suite

**Immediate Next Steps:**
1. Implement Service layer refactor
2. Add database read/write separation
3. Integrate job queue for async processing
4. Add distributed tracing
5. Implement JWT refresh tokens

---

## 🧠 Final Thought

Each of these features mirrors real production challenges. Pick **one**, design it end-to-end (schema → API → real-time → UI), and treat it like a real product feature.

That approach will teach you more than building five shallow features ever could.
