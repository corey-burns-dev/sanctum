DROP INDEX IF EXISTS idx_poll_votes_poll_option_id;
DROP INDEX IF EXISTS idx_poll_votes_poll_id;
DROP INDEX IF EXISTS idx_poll_options_poll_display_order;
DROP INDEX IF EXISTS idx_poll_options_poll_id;

DROP TABLE IF EXISTS poll_votes;
DROP TABLE IF EXISTS poll_options;
DROP TABLE IF EXISTS polls;

ALTER TABLE posts
DROP CONSTRAINT IF EXISTS chk_posts_post_type;

ALTER TABLE posts
DROP COLUMN IF EXISTS youtube_url,
DROP COLUMN IF EXISTS link_url,
DROP COLUMN IF EXISTS post_type;
