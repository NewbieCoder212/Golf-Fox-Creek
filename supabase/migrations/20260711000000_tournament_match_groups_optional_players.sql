-- Allow saving tee-time slots before players are assigned to match groups.

ALTER TABLE tournament_match_groups
  DROP CONSTRAINT IF EXISTS tournament_match_groups_side_a_players_check;

ALTER TABLE tournament_match_groups
  DROP CONSTRAINT IF EXISTS tournament_match_groups_side_b_players_check;

ALTER TABLE tournament_match_groups
  ADD CONSTRAINT tournament_match_groups_side_a_players_check
    CHECK (cardinality(side_a_player_ids) >= 0);

ALTER TABLE tournament_match_groups
  ADD CONSTRAINT tournament_match_groups_side_b_players_check
    CHECK (cardinality(side_b_player_ids) >= 0);
