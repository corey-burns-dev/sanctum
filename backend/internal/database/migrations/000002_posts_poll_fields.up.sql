-- Posts: add polymorphic post fields.
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS link_url VARCHAR(2048) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS youtube_url VARCHAR(512) NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_posts_post_type'
    ) THEN
        ALTER TABLE posts
        ADD CONSTRAINT chk_posts_post_type
        CHECK (post_type IN ('text', 'media', 'video', 'link', 'poll'));
    END IF;
END $$;

-- Polls attached 1:1 with a post.
CREATE TABLE IF NOT EXISTS polls (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL UNIQUE,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_polls_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_options (
    id BIGSERIAL PRIMARY KEY,
    poll_id BIGINT NOT NULL,
    option_text VARCHAR(500) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_poll_options_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    CONSTRAINT uq_poll_options_id_poll UNIQUE (id, poll_id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    poll_id BIGINT NOT NULL,
    poll_option_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_poll_votes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_poll_votes_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    CONSTRAINT fk_poll_votes_option_in_poll FOREIGN KEY (poll_option_id, poll_id) REFERENCES poll_options(id, poll_id) ON DELETE CASCADE,
    CONSTRAINT uq_poll_votes_user_poll UNIQUE (user_id, poll_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_display_order ON poll_options (poll_id, display_order);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_option_id ON poll_votes (poll_option_id);
