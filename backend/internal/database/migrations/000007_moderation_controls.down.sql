DROP INDEX IF EXISTS idx_users_is_banned;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_users_banned_by_user'
      AND table_name = 'users'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT fk_users_banned_by_user;
  END IF;
END $$;

ALTER TABLE users
    DROP COLUMN IF EXISTS banned_by_user_id,
    DROP COLUMN IF EXISTS banned_reason,
    DROP COLUMN IF EXISTS banned_at,
    DROP COLUMN IF EXISTS is_banned;

DROP INDEX IF EXISTS idx_welcome_bot_events_user_type;
DROP TABLE IF EXISTS welcome_bot_events;

DROP INDEX IF EXISTS idx_chatroom_mutes_conversation_id;
DROP INDEX IF EXISTS idx_chatroom_mutes_user_id;
DROP TABLE IF EXISTS chatroom_mutes;

DROP INDEX IF EXISTS idx_moderation_reports_reported_user_id;
DROP INDEX IF EXISTS idx_moderation_reports_target;
DROP INDEX IF EXISTS idx_moderation_reports_status;
DROP TABLE IF EXISTS moderation_reports;

DROP INDEX IF EXISTS idx_user_blocks_blocked_id;
DROP INDEX IF EXISTS idx_user_blocks_blocker_id;
DROP TABLE IF EXISTS user_blocks;
