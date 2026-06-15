-- Match-win points for Ryder Cup style leaderboard (1 point per match win, 0.5 on tie)

ALTER TABLE tournament_match_groups
  ADD COLUMN IF NOT EXISTS match_winner TEXT CHECK (match_winner IN ('side_a', 'side_b', 'tie')),
  ADD COLUMN IF NOT EXISTS match_points_a NUMERIC(3, 1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS match_points_b NUMERIC(3, 1) NOT NULL DEFAULT 0;

COMMENT ON COLUMN tournament_match_groups.match_points_a IS 'Match points earned by side A (1 per win, 0.5 per tie)';
COMMENT ON COLUMN tournament_match_groups.match_points_b IS 'Match points earned by side B (1 per win, 0.5 per tie)';
