DROP INDEX IF EXISTS idx_message_mentions_conversation_id;
DROP INDEX IF EXISTS idx_message_mentions_mentioned_user_id;
DROP TABLE IF EXISTS message_mentions;

DROP INDEX IF EXISTS idx_message_reactions_user_id;
DROP INDEX IF EXISTS idx_message_reactions_message_id;
DROP TABLE IF EXISTS message_reactions;
