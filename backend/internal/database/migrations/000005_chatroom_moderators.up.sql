CREATE TABLE IF NOT EXISTS chatroom_moderators (
    conversation_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    granted_by_user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_chatroom_moderators PRIMARY KEY (conversation_id, user_id),
    CONSTRAINT fk_chatroom_moderators_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_chatroom_moderators_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_chatroom_moderators_granted_by_user FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chatroom_moderators_user_id ON chatroom_moderators (user_id);
