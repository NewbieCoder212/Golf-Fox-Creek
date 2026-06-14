-- Named tournament roster entries (members or guests)

CREATE TABLE IF NOT EXISTS tournament_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  handicap_index NUMERIC(4, 1),
  user_id UUID REFERENCES user_profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tournament_players_display_name_not_empty
    CHECK (length(trim(display_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament
  ON tournament_players (tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_players_user
  ON tournament_players (user_id)
  WHERE user_id IS NOT NULL;

-- Singles scores for guest / roster players
ALTER TABLE tournament_scores
  ADD COLUMN IF NOT EXISTS tournament_player_id UUID REFERENCES tournament_players (id) ON DELETE CASCADE;

ALTER TABLE tournament_scores
  DROP CONSTRAINT IF EXISTS tournament_scores_scorer_check;

ALTER TABLE tournament_scores
  ADD CONSTRAINT tournament_scores_scorer_check
  CHECK (
    (
      team_id IS NOT NULL
      AND user_id IS NULL
      AND tournament_player_id IS NULL
    )
    OR (
      team_id IS NULL
      AND user_id IS NOT NULL
      AND tournament_player_id IS NULL
    )
    OR (
      team_id IS NULL
      AND user_id IS NULL
      AND tournament_player_id IS NOT NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_scores_tournament_player_round
  ON tournament_scores (tournament_id, round_number, tournament_player_id)
  WHERE tournament_player_id IS NOT NULL;

ALTER TABLE tournament_players DISABLE ROW LEVEL SECURITY;
