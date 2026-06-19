-- Short TV display URLs: foxcreek.golf/tv/generation-cup
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS display_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_display_slug
  ON tournaments (display_slug)
  WHERE display_slug IS NOT NULL;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_display_slug_check;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_display_slug_check
  CHECK (display_slug IS NULL OR display_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- Generation Cup 2026 clubhouse TV
UPDATE tournaments
SET display_slug = 'generation-cup'
WHERE id = '107c086c-8edd-4859-aa54-7ec6a0e9daba'
   OR (display_slug IS NULL AND name ILIKE '%generation cup%');
