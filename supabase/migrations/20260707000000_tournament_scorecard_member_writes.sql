-- Allow tournament participants to save foursome scorecards (best ball / singles)
-- and sync match hole results for their tee-time group.

CREATE OR REPLACE FUNCTION is_user_in_match_group(group_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournament_match_groups g
    JOIN tournament_players tp
      ON tp.user_id = auth.uid()
     AND tp.tournament_id = g.tournament_id
    WHERE g.id = group_uuid
      AND (
        tp.id = ANY(g.side_a_player_ids)
        OR tp.id = ANY(g.side_b_player_ids)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

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

-- tournament_scores: foursome entry + own roster row
DROP POLICY IF EXISTS "Members write own scores" ON tournament_scores;
DROP POLICY IF EXISTS "Members update own scores" ON tournament_scores;
DROP POLICY IF EXISTS "Participants insert match scores" ON tournament_scores;
DROP POLICY IF EXISTS "Participants update match scores" ON tournament_scores;

CREATE POLICY "Participants insert match scores" ON tournament_scores
  FOR INSERT
  WITH CHECK (
    can_write_tournament_score(
      tournament_id,
      user_id,
      tournament_player_id,
      match_group_id,
      team_id
    )
  );

CREATE POLICY "Participants update match scores" ON tournament_scores
  FOR UPDATE
  USING (
    can_write_tournament_score(
      tournament_id,
      user_id,
      tournament_player_id,
      match_group_id,
      team_id
    )
  )
  WITH CHECK (
    can_write_tournament_score(
      tournament_id,
      user_id,
      tournament_player_id,
      match_group_id,
      team_id
    )
  );

-- Match hole results + match points (after score sync)
DROP POLICY IF EXISTS "Participants write match hole results" ON tournament_match_hole_results;

CREATE POLICY "Participants write match hole results" ON tournament_match_hole_results
  FOR ALL
  USING (
    is_tournament_manager()
    OR EXISTS (
      SELECT 1
      FROM tournament_match_groups g
      WHERE g.id = tournament_match_hole_results.match_group_id
        AND is_user_in_match_group(g.id)
    )
  )
  WITH CHECK (
    is_tournament_manager()
    OR EXISTS (
      SELECT 1
      FROM tournament_match_groups g
      WHERE g.id = tournament_match_hole_results.match_group_id
        AND is_user_in_match_group(g.id)
    )
  );

DROP POLICY IF EXISTS "Participants update match group results" ON tournament_match_groups;

CREATE POLICY "Participants update match group results" ON tournament_match_groups
  FOR UPDATE
  USING (
    is_tournament_manager()
    OR is_user_in_match_group(id)
  )
  WITH CHECK (
    is_tournament_manager()
    OR is_user_in_match_group(id)
  );
