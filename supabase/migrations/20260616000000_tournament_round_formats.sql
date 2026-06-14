-- Per-round tournament formats (Day 1 / Day 2 / Day 3 can differ)
-- Safe to re-run if a prior attempt stopped partway through.

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS round_formats JSONB;

UPDATE tournaments
SET round_formats = CASE rounds_count
  WHEN 2 THEN jsonb_build_array(format, format)
  WHEN 3 THEN jsonb_build_array(format, format, format)
  ELSE jsonb_build_array(format)
END
WHERE round_formats IS NULL;

ALTER TABLE tournaments ALTER COLUMN round_formats SET NOT NULL;

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_round_formats_check;

ALTER TABLE tournaments ADD CONSTRAINT tournaments_round_formats_check
  CHECK (
    jsonb_typeof(round_formats) = 'array'
    AND jsonb_array_length(round_formats) = rounds_count
    AND (round_formats->>0) IN ('scramble', 'best_ball', 'alternate_shot', 'singles')
    AND (
      (
        rounds_count = 2
        AND (round_formats->>1) IN ('scramble', 'best_ball', 'alternate_shot', 'singles')
      )
      OR (
        rounds_count = 3
        AND (round_formats->>1) IN ('scramble', 'best_ball', 'alternate_shot', 'singles')
        AND (round_formats->>2) IN ('scramble', 'best_ball', 'alternate_shot', 'singles')
      )
    )
  );

DROP INDEX IF EXISTS idx_tournaments_format;

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_format_check;

ALTER TABLE tournaments DROP COLUMN IF EXISTS format;
