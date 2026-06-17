-- Tournament-level handicap defaults and per-player overrides

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS handicap_use_index BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS handicap_allowance_pct INTEGER NOT NULL DEFAULT 100;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_handicap_allowance_pct_check;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_handicap_allowance_pct_check
  CHECK (handicap_allowance_pct IN (75, 85, 100));

ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS handicap_use_index BOOLEAN;

ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS handicap_allowance_pct INTEGER;

ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS manual_handicap TEXT;

ALTER TABLE tournament_players
  DROP CONSTRAINT IF EXISTS tournament_players_handicap_allowance_pct_check;

ALTER TABLE tournament_players
  ADD CONSTRAINT tournament_players_handicap_allowance_pct_check
  CHECK (handicap_allowance_pct IS NULL OR handicap_allowance_pct IN (75, 85, 100));
