-- Singles at a tee time: 2 players per team, index-matched 1v1 pairings (A1 vs B1, A2 vs B2).

UPDATE app_settings
SET
  setting_value = jsonb_set(
    setting_value,
    '{formats}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'id' = 'singles'
          THEN elem
            || jsonb_build_object('default_players_per_match', 2)
            || jsonb_build_object(
              'scoring_hint',
              '2 per side — paired 1v1 matches at each tee time (A1 vs B1, A2 vs B2)'
            )
            || jsonb_build_object(
              'how_it_works',
              'Same tee time: two players from each team. Slot 1 on Team A plays slot 1 on Team B head-to-head; slot 2 plays slot 2, and so on. Each pairing is its own 1v1 match — lowest score wins the hole (Up, Down, or All Square). Tied holes are halved.'
            )
            || jsonb_build_object(
              'the_score',
              'Each 1v1 pairing tracked as Up, Down, or All Square. Team match points sum wins across all pairings at that tee time.'
            )
          ELSE elem
        END
      )
      FROM jsonb_array_elements(setting_value->'formats') AS elem
    ),
    true
  ),
  updated_at = NOW()
WHERE setting_key = 'tournament_formats';
