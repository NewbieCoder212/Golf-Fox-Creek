-- ============================================
-- FOX CREEK GOLF CLUB - TOURNAMENTS & WAGERING
-- Migration: Multi-day tournaments + side games
-- Date: 2026-06-14
-- ============================================
--
-- Prerequisites: supabase_schema.sql applied (user_profiles, rounds, uuid-ossp)
--
-- RLS: Intentionally left open for development (matches commit 4e6fc4e).
-- Re-enable with proper policies before production.

-- ============================================
-- TABLE: tournaments
-- Multi-day club events (Scramble, Best Ball, Alternate Shot, Singles)
-- ============================================

CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  format TEXT NOT NULL,
  rounds_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tournaments_format_check
    CHECK (format IN ('scramble', 'best_ball', 'alternate_shot', 'singles')),

  CONSTRAINT tournaments_rounds_count_check
    CHECK (rounds_count IN (2, 3)),

  CONSTRAINT tournaments_date_range_check
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_tournaments_dates ON tournaments (start_date, end_date);
CREATE INDEX idx_tournaments_format ON tournaments (format);


-- ============================================
-- TABLE: tournament_teams
-- Team rosters; player_ids reference user_profiles.id
-- ============================================

CREATE TABLE tournament_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  player_ids UUID[] NOT NULL DEFAULT '{}',

  CONSTRAINT tournament_teams_player_ids_not_empty
    CHECK (cardinality(player_ids) > 0)
);

CREATE INDEX idx_tournament_teams_tournament ON tournament_teams (tournament_id);
CREATE INDEX idx_tournament_teams_player_ids ON tournament_teams USING GIN (player_ids);


-- ============================================
-- TABLE: tournament_scores
-- Per-round scorecards with gross/net hole data
-- ============================================
--
-- hole_scores JSONB structure (18 holes):
-- [
--   { "hole": 1, "par": 4, "gross": 5, "net": 4 },
--   { "hole": 2, "par": 3, "gross": 3, "net": 3 },
--   ...
-- ]
--
-- team_id: set for team formats; NULL for singles
-- user_id: set for singles when team_id IS NULL (FK to user_profiles)

CREATE TABLE tournament_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  team_id UUID REFERENCES tournament_teams (id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles (id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  hole_scores JSONB NOT NULL DEFAULT '[]',
  total_gross INTEGER NOT NULL,
  total_net INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tournament_scores_round_number_check
    CHECK (round_number >= 1),

  CONSTRAINT tournament_scores_scorer_check
    CHECK (
      (team_id IS NOT NULL AND user_id IS NULL)
      OR (team_id IS NULL AND user_id IS NOT NULL)
    )
);

CREATE INDEX idx_tournament_scores_tournament ON tournament_scores (tournament_id);
CREATE INDEX idx_tournament_scores_team ON tournament_scores (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_tournament_scores_user ON tournament_scores (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_tournament_scores_round ON tournament_scores (tournament_id, round_number);

CREATE UNIQUE INDEX idx_tournament_scores_team_round
  ON tournament_scores (tournament_id, round_number, team_id)
  WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX idx_tournament_scores_user_round
  ON tournament_scores (tournament_id, round_number, user_id)
  WHERE team_id IS NULL;


-- ============================================
-- TABLE: wagering_sessions
-- Side games: Skins, Stableford/Points
-- Linked to a casual round OR a tournament event
-- ============================================
--
-- settings JSONB examples:
--   Skins:       { "carryover": true, "value_per_skin": 5 }
--   Stableford:  { "point_values": { "eagle": 4, "birdie": 2, "par": 0, "bogey": -1 } }
--
-- results JSONB: live calculation state (winners, balances, hole-by-hole ledger)

CREATE TABLE wagering_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID REFERENCES rounds (id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments (id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT wagering_sessions_game_type_check
    CHECK (game_type IN ('skins', 'stableford_points')),

  CONSTRAINT wagering_sessions_link_check
    CHECK (
      (round_id IS NOT NULL AND tournament_id IS NULL)
      OR (round_id IS NULL AND tournament_id IS NOT NULL)
    )
);

CREATE INDEX idx_wagering_sessions_round ON wagering_sessions (round_id) WHERE round_id IS NOT NULL;
CREATE INDEX idx_wagering_sessions_tournament ON wagering_sessions (tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_wagering_sessions_game_type ON wagering_sessions (game_type);


-- ============================================
-- ROW LEVEL SECURITY (development: disabled)
-- Matches commit 4e6fc4e — no strict policies yet
-- ============================================

ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE wagering_sessions DISABLE ROW LEVEL SECURITY;
