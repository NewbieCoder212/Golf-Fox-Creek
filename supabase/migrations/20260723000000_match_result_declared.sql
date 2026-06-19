-- Admin-declared match results (forfeit / manual cup point) vs hole-by-hole scoring.

ALTER TABLE tournament_match_groups
  ADD COLUMN IF NOT EXISTS match_result_declared BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tournament_match_groups.match_result_declared IS
  'True when a manager declared the match result without hole-by-hole scoring.';
