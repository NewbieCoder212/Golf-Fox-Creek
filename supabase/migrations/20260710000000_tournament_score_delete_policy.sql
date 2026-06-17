-- Allow match participants to delete score rows for their pairing (clear scores flow).

DROP POLICY IF EXISTS "Participants delete match scores" ON tournament_scores;

CREATE POLICY "Participants delete match scores" ON tournament_scores
  FOR DELETE
  USING (
    can_write_tournament_score(
      tournament_id,
      user_id,
      tournament_player_id,
      match_group_id,
      team_id
    )
  );
