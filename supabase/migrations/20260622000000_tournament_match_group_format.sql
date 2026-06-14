-- Store scoring format per match (scramble, best ball, singles, etc.)

ALTER TABLE tournament_match_groups
  ADD COLUMN IF NOT EXISTS format TEXT;

ALTER TABLE tournament_match_groups
  DROP CONSTRAINT IF EXISTS tournament_match_groups_format_check;

ALTER TABLE tournament_match_groups
  ADD CONSTRAINT tournament_match_groups_format_check
  CHECK (
    format IS NULL
    OR format IN ('scramble', 'best_ball', 'alternate_shot', 'singles')
  );

UPDATE tournament_match_groups
SET format = 'scramble'
WHERE format IS NULL;

ALTER TABLE tournament_match_groups
  ALTER COLUMN format SET DEFAULT 'scramble';

ALTER TABLE tournament_match_groups
  ALTER COLUMN format SET NOT NULL;
