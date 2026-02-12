DROP INDEX IF EXISTS idx_posts_image_hash;
ALTER TABLE posts DROP COLUMN IF EXISTS image_hash;

DROP INDEX IF EXISTS idx_image_variants_image_id;
DROP TABLE IF EXISTS image_variants;

DROP INDEX IF EXISTS idx_images_status;
ALTER TABLE images
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS blurhash,
  DROP COLUMN IF EXISTS error,
  DROP COLUMN IF EXISTS crop_mode,
  DROP COLUMN IF EXISTS crop_x,
  DROP COLUMN IF EXISTS crop_y,
  DROP COLUMN IF EXISTS crop_w,
  DROP COLUMN IF EXISTS crop_h,
  DROP COLUMN IF EXISTS processing_started_at,
  DROP COLUMN IF EXISTS processing_attempts;
