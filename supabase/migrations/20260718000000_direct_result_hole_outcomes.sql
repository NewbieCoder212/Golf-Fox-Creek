-- Direct Result match play: per-pairing singles + optional stroke values

ALTER TABLE tournament_match_hole_results
  ADD COLUMN IF NOT EXISTS pairing_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tournament_match_hole_results
  ALTER COLUMN side_a_net DROP NOT NULL,
  ALTER COLUMN side_b_net DROP NOT NULL;

ALTER TABLE tournament_match_hole_results
  DROP CONSTRAINT IF EXISTS tournament_match_hole_results_unique;

ALTER TABLE tournament_match_hole_results
  ADD CONSTRAINT tournament_match_hole_results_unique
    UNIQUE (match_group_id, round_number, hole, pairing_index);

CREATE INDEX IF NOT EXISTS idx_tournament_match_hole_results_pairing
  ON tournament_match_hole_results (match_group_id, round_number, pairing_index);
