-- ============================================
-- FOX CREEK GOLF CLUB - TOURNAMENT TEE ASSIGNMENTS
-- Manual tee times per team/player (no Chronogolf sync)
-- Date: 2026-06-15
-- ============================================

CREATE TABLE tournament_tee_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  team_id UUID REFERENCES tournament_teams (id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles (id) ON DELETE CASCADE,
  tee_time TIMESTAMPTZ NOT NULL,
  starting_hole INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tournament_tee_assignments_round_number_check
    CHECK (round_number >= 1),

  CONSTRAINT tournament_tee_assignments_starting_hole_check
    CHECK (starting_hole >= 1 AND starting_hole <= 18),

  CONSTRAINT tournament_tee_assignments_scorer_check
    CHECK (
      (team_id IS NOT NULL AND user_id IS NULL)
      OR (team_id IS NULL AND user_id IS NOT NULL)
    )
);

CREATE INDEX idx_tournament_tee_assignments_tournament
  ON tournament_tee_assignments (tournament_id);

CREATE INDEX idx_tournament_tee_assignments_round
  ON tournament_tee_assignments (tournament_id, round_number);

CREATE INDEX idx_tournament_tee_assignments_time
  ON tournament_tee_assignments (tournament_id, round_number, tee_time);

CREATE UNIQUE INDEX idx_tournament_tee_assignments_team_round
  ON tournament_tee_assignments (tournament_id, round_number, team_id)
  WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tournament_tee_assignments_user_round
  ON tournament_tee_assignments (tournament_id, round_number, user_id)
  WHERE team_id IS NULL;

ALTER TABLE tournament_tee_assignments DISABLE ROW LEVEL SECURITY;
