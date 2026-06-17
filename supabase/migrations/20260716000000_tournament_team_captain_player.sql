-- Allow team captains to be any tournament roster player (not only linked member accounts).

ALTER TABLE tournament_teams
  ADD COLUMN IF NOT EXISTS captain_player_id UUID REFERENCES tournament_players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_teams_captain_player_id
  ON tournament_teams (captain_player_id)
  WHERE captain_player_id IS NOT NULL;
