-- Members can always read their own roster rows (hub "My Events" lookup).

DROP POLICY IF EXISTS "Members read own tournament players" ON tournament_players;

CREATE POLICY "Members read own tournament players" ON tournament_players
  FOR SELECT
  USING (user_id = auth.uid());
