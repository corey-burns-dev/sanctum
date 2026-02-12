CREATE TABLE IF NOT EXISTS user_blocks (
    id BIGSERIAL PRIMARY KEY,
    blocker_id BIGINT NOT NULL,
    blocked_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_user_blocks_not_self CHECK (blocker_id <> blocked_id),
    CONSTRAINT uq_user_blocks UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks (blocked_id);

CREATE TABLE IF NOT EXISTS moderation_reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    reported_user_id BIGINT,
    reason VARCHAR(120) NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    resolved_by_user_id BIGINT,
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_moderation_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_moderation_reports_reported_user FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_moderation_reports_resolved_by_user FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_moderation_reports_target_type CHECK (target_type IN ('post', 'message', 'user')),
    CONSTRAINT chk_moderation_reports_status CHECK (status IN ('open', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON moderation_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_target ON moderation_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_reported_user_id ON moderation_reports (reported_user_id, status);

CREATE TABLE IF NOT EXISTS chatroom_mutes (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    muted_by_user_id BIGINT NOT NULL,
    reason VARCHAR(255) NOT NULL DEFAULT '',
    muted_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_chatroom_mutes_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_chatroom_mutes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_chatroom_mutes_muted_by_user FOREIGN KEY (muted_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_chatroom_mutes UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chatroom_mutes_user_id ON chatroom_mutes (user_id);
CREATE INDEX IF NOT EXISTS idx_chatroom_mutes_conversation_id ON chatroom_mutes (conversation_id, muted_until);

CREATE TABLE IF NOT EXISTS welcome_bot_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    conversation_id BIGINT,
    event_type VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_welcome_bot_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_welcome_bot_events_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT uq_welcome_bot_events UNIQUE (user_id, conversation_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_welcome_bot_events_user_type ON welcome_bot_events (user_id, event_type);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS banned_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS banned_by_user_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_users_banned_by_user'
      AND table_name = 'users'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_banned_by_user FOREIGN KEY (banned_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users (is_banned);
