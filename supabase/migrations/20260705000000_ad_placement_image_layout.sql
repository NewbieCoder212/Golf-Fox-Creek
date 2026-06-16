-- Ad image layout: banner (wide strip), portrait (tall flyer), square

ALTER TABLE ad_placements
  ADD COLUMN IF NOT EXISTS image_layout TEXT NOT NULL DEFAULT 'banner';

ALTER TABLE ad_placements
  DROP CONSTRAINT IF EXISTS ad_placements_image_layout_check;

ALTER TABLE ad_placements
  ADD CONSTRAINT ad_placements_image_layout_check
  CHECK (image_layout IN ('banner', 'portrait', 'square'));
