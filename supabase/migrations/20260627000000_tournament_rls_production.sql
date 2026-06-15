-- Re-enable tournament RLS with manager and member policies

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_tee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_match_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_match_hole_results ENABLE ROW LEVEL SECURITY;

-- Helper: is manager or super_admin
CREATE OR REPLACE FUNCTION is_tournament_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('manager', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: user is on a tournament roster or team
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
    SELECT 1 FROM tournament_scores ts
    WHERE ts.tournament_id = tournament_uuid AND ts.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- tournaments
DROP POLICY IF EXISTS "Managers manage tournaments" ON tournaments;
CREATE POLICY "Managers manage tournaments" ON tournaments
  FOR ALL USING (is_tournament_manager());

DROP POLICY IF EXISTS "Participants read tournaments" ON tournaments;
CREATE POLICY "Participants read tournaments" ON tournaments
  FOR SELECT USING (is_tournament_participant(id) OR is_tournament_manager());

DROP POLICY IF EXISTS "Authenticated read active tournaments" ON tournaments;
CREATE POLICY "Authenticated read active tournaments" ON tournaments
  FOR SELECT TO authenticated USING (end_date >= CURRENT_DATE - INTERVAL '30 days');

-- tournament_teams
DROP POLICY IF EXISTS "Managers manage tournament teams" ON tournament_teams;
CREATE POLICY "Managers manage tournament teams" ON tournament_teams
  FOR ALL USING (is_tournament_manager());

DROP POLICY IF EXISTS "Participants read tournament teams" ON tournament_teams;
CREATE POLICY "Participants read tournament teams" ON tournament_teams
  FOR SELECT USING (is_tournament_participant(tournament_id) OR is_tournament_manager());

-- tournament_players
DROP POLICY IF EXISTS "Managers manage tournament players" ON tournament_players;
CREATE POLICY "Managers manage tournament players" ON tournament_players
  FOR ALL USING (is_tournament_manager());

DROP POLICY IF EXISTS "Participants read tournament players" ON tournament_players;
CREATE POLICY "Participants read tournament players" ON tournament_players
  FOR SELECT USING (is_tournament_participant(tournament_id) OR is_tournament_manager());

-- tournament_match_groups
DROP POLICY IF EXISTS "Managers manage match groups" ON tournament_match_groups;
CREATE POLICY "Managers manage match groups" ON tournament_match_groups
  FOR ALL USING (is_tournament_manager());

DROP POLICY IF EXISTS "Participants read match groups" ON tournament_match_groups;
CREATE POLICY "Participants read match groups" ON tournament_match_groups
  FOR SELECT USING (is_tournament_participant(tournament_id) OR is_tournament_manager());

-- tournament_match_hole_results (read via match group join)
DROP POLICY IF EXISTS "Managers manage hole results" ON tournament_match_hole_results;
CREATE POLICY "Managers manage hole results" ON tournament_match_hole_results
  FOR ALL USING (is_tournament_manager());

DROP POLICY IF EXISTS "Participants read hole results" ON tournament_match_hole_results;
CREATE POLICY "Participants read hole results" ON tournament_match_hole_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournament_match_groups g
      WHERE g.id = tournament_match_hole_results.match_group_id
      AND (is_tournament_participant(g.tournament_id) OR is_tournament_manager())
    )
  );

-- tournament_scores
DROP POLICY IF EXISTS "Managers manage scores" ON tournament_scores;
CREATE POLICY "Managers manage scores" ON tournament_scores
  FOR ALL USING (is_tournament_manager());

DROP POLICY IF EXISTS "Members write own scores" ON tournament_scores;
CREATE POLICY "Members write own scores" ON tournament_scores
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_tournament_manager());

DROP POLICY IF EXISTS "Members update own scores" ON tournament_scores;
CREATE POLICY "Members update own scores" ON tournament_scores
  FOR UPDATE USING (user_id = auth.uid() OR is_tournament_manager());

DROP POLICY IF EXISTS "Participants read scores" ON tournament_scores;
CREATE POLICY "Participants read scores" ON tournament_scores
  FOR SELECT USING (is_tournament_participant(tournament_id) OR is_tournament_manager());

-- tournament_tee_assignments
DROP POLICY IF EXISTS "Managers manage tee assignments" ON tournament_tee_assignments;
CREATE POLICY "Managers manage tee assignments" ON tournament_tee_assignments
  FOR ALL USING (is_tournament_manager());

DROP POLICY IF EXISTS "Participants read tee assignments" ON tournament_tee_assignments;
CREATE POLICY "Participants read tee assignments" ON tournament_tee_assignments
  FOR SELECT USING (is_tournament_participant(tournament_id) OR is_tournament_manager() OR user_id = auth.uid());
