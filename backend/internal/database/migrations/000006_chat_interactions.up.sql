CREATE TABLE IF NOT EXISTS message_reactions (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_message_reactions_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_message_reactions UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions (user_id);

CREATE TABLE IF NOT EXISTS message_mentions (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    mentioned_user_id BIGINT NOT NULL,
    mentioned_by_user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    CONSTRAINT fk_message_mentions_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_mentions_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_mentions_mentioned_user FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_mentions_mentioned_by_user FOREIGN KEY (mentioned_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_message_mentions UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_mentions_mentioned_user_id ON message_mentions (mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_mentions_conversation_id ON message_mentions (conversation_id);
