-- Post-tournament access lock: managers can close player + TV access while retaining data.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS access_locked_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION is_tournament_access_locked(tournament_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = tournament_uuid AND access_locked_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- tournaments
DROP POLICY IF EXISTS "Participants read tournaments" ON tournaments;
CREATE POLICY "Participants read tournaments" ON tournaments
  FOR SELECT USING (
    is_tournament_manager()
    OR (
      is_tournament_participant(id)
      AND NOT is_tournament_access_locked(id)
    )
  );

DROP POLICY IF EXISTS "Authenticated read active tournaments" ON tournaments;
CREATE POLICY "Authenticated read active tournaments" ON tournaments
  FOR SELECT TO authenticated
  USING (
    end_date >= CURRENT_DATE - INTERVAL '30 days'
    AND NOT is_tournament_access_locked(id)
  );

-- tournament_teams
DROP POLICY IF EXISTS "Participants read tournament teams" ON tournament_teams;
CREATE POLICY "Participants read tournament teams" ON tournament_teams
  FOR SELECT USING (
    is_tournament_manager()
    OR (
      is_tournament_participant(tournament_id)
      AND NOT is_tournament_access_locked(tournament_id)
    )
  );

DROP POLICY IF EXISTS "Captains update draft team roster" ON tournament_teams;
CREATE POLICY "Captains update draft team roster" ON tournament_teams
  FOR UPDATE
  USING (
    is_draft_team_captain_of_team(id)
    AND NOT is_tournament_access_locked(tournament_id)
  )
  WITH CHECK (
    is_draft_team_captain_of_team(id)
    AND NOT is_tournament_access_locked(tournament_id)
  );

-- tournament_players
DROP POLICY IF EXISTS "Participants read tournament players" ON tournament_players;
CREATE POLICY "Participants read tournament players" ON tournament_players
  FOR SELECT USING (
    is_tournament_manager()
    OR (
      is_tournament_participant(tournament_id)
      AND NOT is_tournament_access_locked(tournament_id)
    )
  );

DROP POLICY IF EXISTS "Captains insert tournament players" ON tournament_players;
CREATE POLICY "Captains insert tournament players" ON tournament_players
  FOR INSERT
  WITH CHECK (
    is_draft_team_captain(tournament_id)
    AND NOT is_tournament_access_locked(tournament_id)
  );

-- tournament_match_groups
DROP POLICY IF EXISTS "Participants read match groups" ON tournament_match_groups;
CREATE POLICY "Participants read match groups" ON tournament_match_groups
  FOR SELECT USING (
    is_tournament_manager()
    OR (
      is_tournament_participant(tournament_id)
      AND NOT is_tournament_access_locked(tournament_id)
    )
  );

DROP POLICY IF EXISTS "Participants update match group results" ON tournament_match_groups;
CREATE POLICY "Participants update match group results" ON tournament_match_groups
  FOR UPDATE
  USING (
    is_tournament_manager()
    OR (
      is_user_in_match_group(id)
      AND NOT is_tournament_access_locked(tournament_id)
    )
  )
  WITH CHECK (
    is_tournament_manager()
    OR (
      is_user_in_match_group(id)
      AND NOT is_tournament_access_locked(tournament_id)
    )
  );

-- tournament_match_hole_results
DROP POLICY IF EXISTS "Participants read hole results" ON tournament_match_hole_results;
CREATE POLICY "Participants read hole results" ON tournament_match_hole_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournament_match_groups g
      WHERE g.id = tournament_match_hole_results.match_group_id
      AND (
        is_tournament_manager()
        OR (
          is_tournament_participant(g.tournament_id)
          AND NOT is_tournament_access_locked(g.tournament_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Participants write match hole results" ON tournament_match_hole_results;
CREATE POLICY "Participants write match hole results" ON tournament_match_hole_results
  FOR ALL
  USING (
    is_tournament_manager()
    OR (
      EXISTS (
        SELECT 1 FROM tournament_match_groups g
        WHERE g.id = tournament_match_hole_results.match_group_id
          AND is_user_in_match_group(g.id)
          AND NOT is_tournament_access_locked(g.tournament_id)
      )
    )
  )
  WITH CHECK (
    is_tournament_manager()
    OR (
      EXISTS (
        SELECT 1 FROM tournament_match_groups g
        WHERE g.id = tournament_match_hole_results.match_group_id
          AND is_user_in_match_group(g.id)
          AND NOT is_tournament_access_locked(g.tournament_id)
      )
    )
  );

-- tournament_scores
DROP POLICY IF EXISTS "Participants read scores" ON tournament_scores;
CREATE POLICY "Participants read scores" ON tournament_scores
  FOR SELECT USING (
    is_tournament_manager()
    OR (
      is_tournament_participant(tournament_id)
      AND NOT is_tournament_access_locked(tournament_id)
    )
  );

-- tournament_tee_assignments
DROP POLICY IF EXISTS "Participants read tee assignments" ON tournament_tee_assignments;
CREATE POLICY "Participants read tee assignments" ON tournament_tee_assignments
  FOR SELECT USING (
    is_tournament_manager()
    OR user_id = auth.uid()
    OR (
      is_tournament_participant(tournament_id)
      AND NOT is_tournament_access_locked(tournament_id)
    )
  );

-- Score writes blocked when tournament is locked
CREATE OR REPLACE FUNCTION can_write_tournament_score(
  score_tournament_id UUID,
  score_user_id UUID,
  score_tournament_player_id UUID,
  score_match_group_id UUID,
  score_team_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF is_tournament_manager() THEN
    RETURN TRUE;
  END IF;

  IF is_tournament_access_locked(score_tournament_id) THEN
    RETURN FALSE;
  END IF;

  IF score_user_id IS NOT NULL AND score_user_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  IF score_tournament_player_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM tournament_players tp
    WHERE tp.id = score_tournament_player_id
      AND tp.user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  IF score_match_group_id IS NOT NULL
     AND is_user_in_match_group(score_match_group_id) THEN
    IF score_tournament_player_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1
        FROM tournament_match_groups g
        WHERE g.id = score_match_group_id
          AND score_tournament_player_id = ANY(
            g.side_a_player_ids || g.side_b_player_ids
          )
      );
    END IF;

    IF score_team_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1
        FROM tournament_match_groups g
        WHERE g.id = score_match_group_id
          AND (
            g.side_a_team_id = score_team_id
            OR g.side_b_team_id = score_team_id
          )
      );
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- TV display public read blocked when locked
DROP POLICY IF EXISTS "Public read tournaments for TV display" ON tournaments;
CREATE POLICY "Public read tournaments for TV display" ON tournaments
  FOR SELECT TO anon, authenticated
  USING (
    end_date >= CURRENT_DATE - INTERVAL '30 days'
    AND start_date <= CURRENT_DATE + INTERVAL '7 days'
    AND access_locked_at IS NULL
  );

DROP POLICY IF EXISTS "Public read tournament teams for TV display" ON tournament_teams;
CREATE POLICY "Public read tournament teams for TV display" ON tournament_teams
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_teams.tournament_id
      AND t.end_date >= CURRENT_DATE - INTERVAL '30 days'
      AND t.start_date <= CURRENT_DATE + INTERVAL '7 days'
      AND t.access_locked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Public read tournament players for TV display" ON tournament_players;
CREATE POLICY "Public read tournament players for TV display" ON tournament_players
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_players.tournament_id
      AND t.end_date >= CURRENT_DATE - INTERVAL '30 days'
      AND t.start_date <= CURRENT_DATE + INTERVAL '7 days'
      AND t.access_locked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Public read tournament scores for TV display" ON tournament_scores;
CREATE POLICY "Public read tournament scores for TV display" ON tournament_scores
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_scores.tournament_id
      AND t.end_date >= CURRENT_DATE - INTERVAL '30 days'
      AND t.start_date <= CURRENT_DATE + INTERVAL '7 days'
      AND t.access_locked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Public read tournament match groups for TV display" ON tournament_match_groups;
CREATE POLICY "Public read tournament match groups for TV display" ON tournament_match_groups
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_match_groups.tournament_id
      AND t.end_date >= CURRENT_DATE - INTERVAL '30 days'
      AND t.start_date <= CURRENT_DATE + INTERVAL '7 days'
      AND t.access_locked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Public read match hole results for TV display" ON tournament_match_hole_results;
CREATE POLICY "Public read match hole results for TV display" ON tournament_match_hole_results
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournament_match_groups mg
      JOIN tournaments t ON t.id = mg.tournament_id
      WHERE mg.id = tournament_match_hole_results.match_group_id
      AND t.end_date >= CURRENT_DATE - INTERVAL '30 days'
      AND t.start_date <= CURRENT_DATE + INTERVAL '7 days'
      AND t.access_locked_at IS NULL
    )
  );
