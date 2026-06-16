-- Team captain, roster readiness, and onboard email tracking

ALTER TABLE tournament_teams
  ADD COLUMN IF NOT EXISTS captain_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roster_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS roster_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS roster_ready_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboard_email_sent_at TIMESTAMPTZ;

ALTER TABLE tournament_teams
  DROP CONSTRAINT IF EXISTS tournament_teams_roster_status_check;

ALTER TABLE tournament_teams
  ADD CONSTRAINT tournament_teams_roster_status_check
  CHECK (roster_status IN ('draft', 'ready'));

-- Captains count as tournament participants even before roster placement
CREATE OR REPLACE FUNCTION is_tournament_participant(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_players tp
    WHERE tp.tournament_id = tournament_uuid AND tp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM tournament_teams tt
    WHERE tt.tournament_id = tournament_uuid
    AND auth.uid() = ANY(
      SELECT tp2.user_id FROM tournament_players tp2
      WHERE tp2.id = ANY(tt.player_ids) AND tp2.user_id IS NOT NULL
    )
  )
  OR EXISTS (
    SELECT 1 FROM tournament_teams tt
    WHERE tt.tournament_id = tournament_uuid AND tt.captain_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM tournament_scores ts
    WHERE ts.tournament_id = tournament_uuid AND ts.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_draft_team_captain(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_teams tt
    WHERE tt.tournament_id = tournament_uuid
      AND tt.captain_user_id = auth.uid()
      AND tt.roster_status = 'draft'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_draft_team_captain_of_team(team_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournament_teams tt
    WHERE tt.id = team_uuid
      AND tt.captain_user_id = auth.uid()
      AND tt.roster_status = 'draft'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Captains may update their draft team roster
DROP POLICY IF EXISTS "Captains update draft team roster" ON tournament_teams;
CREATE POLICY "Captains update draft team roster" ON tournament_teams
  FOR UPDATE
  USING (is_draft_team_captain_of_team(id))
  WITH CHECK (is_draft_team_captain_of_team(id));

-- Captains may insert tournament players while managing a draft roster
DROP POLICY IF EXISTS "Captains insert tournament players" ON tournament_players;
CREATE POLICY "Captains insert tournament players" ON tournament_players
  FOR INSERT
  WITH CHECK (is_draft_team_captain(tournament_id));
