-- ============================================
-- TOURNAMENT MATCH GROUPS (2v2 team pairings)
-- Side A: 2 players vs Side B: 2 players per tee time
-- Date: 2026-06-20
-- ============================================

-- How many players from EACH team in a foursome (default 2v2)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS players_per_match INTEGER NOT NULL DEFAULT 2;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_players_per_match_check;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_players_per_match_check
  CHECK (players_per_match >= 1 AND players_per_match <= 4);

-- Side A / Side B for the two competing teams
ALTER TABLE tournament_teams
  ADD COLUMN IF NOT EXISTS side TEXT;

ALTER TABLE tournament_teams
  DROP CONSTRAINT IF EXISTS tournament_teams_side_check;

ALTER TABLE tournament_teams
  ADD CONSTRAINT tournament_teams_side_check
  CHECK (side IN ('side_a', 'side_b'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_teams_tournament_side
  ON tournament_teams (tournament_id, side);

-- ============================================
-- TABLE: tournament_match_groups
-- One row = one tee time foursome (2 from side A vs 2 from side B)
-- ============================================

CREATE TABLE IF NOT EXISTS tournament_match_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  side_a_team_id UUID NOT NULL REFERENCES tournament_teams (id) ON DELETE CASCADE,
  side_b_team_id UUID NOT NULL REFERENCES tournament_teams (id) ON DELETE CASCADE,
  side_a_player_ids UUID[] NOT NULL,
  side_b_player_ids UUID[] NOT NULL,
  tee_time TIMESTAMPTZ NOT NULL,
  starting_hole INTEGER NOT NULL DEFAULT 1,
  group_number INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tournament_match_groups_round_check
    CHECK (round_number >= 1),

  CONSTRAINT tournament_match_groups_starting_hole_check
    CHECK (starting_hole >= 1 AND starting_hole <= 18),

  CONSTRAINT tournament_match_groups_distinct_teams_check
    CHECK (side_a_team_id <> side_b_team_id),

  CONSTRAINT tournament_match_groups_side_a_players_check
    CHECK (cardinality(side_a_player_ids) >= 1),

  CONSTRAINT tournament_match_groups_side_b_players_check
    CHECK (cardinality(side_b_player_ids) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_tournament_match_groups_tournament
  ON tournament_match_groups (tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_match_groups_round
  ON tournament_match_groups (tournament_id, round_number);

CREATE INDEX IF NOT EXISTS idx_tournament_match_groups_tee_time
  ON tournament_match_groups (tournament_id, round_number, tee_time);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_match_groups_group_number
  ON tournament_match_groups (tournament_id, round_number, group_number);

-- ============================================
-- Hole results per match (team wins the hole)
-- Populated for scramble / best ball / alternate shot
-- ============================================

CREATE TABLE IF NOT EXISTS tournament_match_hole_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_group_id UUID NOT NULL REFERENCES tournament_match_groups (id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  hole INTEGER NOT NULL,
  side_a_net INTEGER NOT NULL,
  side_b_net INTEGER NOT NULL,
  hole_winner TEXT NOT NULL DEFAULT 'tie',

  CONSTRAINT tournament_match_hole_results_hole_check
    CHECK (hole >= 1 AND hole <= 18),

  CONSTRAINT tournament_match_hole_results_winner_check
    CHECK (hole_winner IN ('side_a', 'side_b', 'tie')),

  CONSTRAINT tournament_match_hole_results_unique
    UNIQUE (match_group_id, round_number, hole)
);

CREATE INDEX IF NOT EXISTS idx_tournament_match_hole_results_match
  ON tournament_match_hole_results (match_group_id, round_number);

-- Link scorecards to a specific 2v2 match (optional but recommended)
ALTER TABLE tournament_scores
  ADD COLUMN IF NOT EXISTS match_group_id UUID REFERENCES tournament_match_groups (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_scores_match_group
  ON tournament_scores (match_group_id)
  WHERE match_group_id IS NOT NULL;

ALTER TABLE tournament_match_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_match_hole_results DISABLE ROW LEVEL SECURITY;
