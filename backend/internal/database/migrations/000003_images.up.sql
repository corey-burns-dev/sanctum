CREATE TABLE IF NOT EXISTS images (
    id BIGSERIAL PRIMARY KEY,
    hash VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    size_bytes BIGINT NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    original_path VARCHAR(512) NOT NULL,
    thumbnail_path VARCHAR(512) NOT NULL,
    medium_path VARCHAR(512) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_images_hash UNIQUE (hash),
    CONSTRAINT chk_images_size_bytes CHECK (size_bytes > 0),
    CONSTRAINT chk_images_width CHECK (width > 0),
    CONSTRAINT chk_images_height CHECK (height > 0),
    CONSTRAINT fk_images_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_user ON images (user_id);
CREATE INDEX IF NOT EXISTS idx_images_user_uploaded_at ON images (user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images (uploaded_at DESC);
