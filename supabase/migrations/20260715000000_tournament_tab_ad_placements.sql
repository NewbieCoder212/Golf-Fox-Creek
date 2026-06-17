-- Per-tab sponsor placements on the tournament event screen

ALTER TABLE ad_placements
  DROP CONSTRAINT IF EXISTS ad_placements_placement_type_check;

ALTER TABLE ad_placements
  ADD CONSTRAINT ad_placements_placement_type_check
  CHECK (
    placement_type IN (
      'scorecard_header',
      'hole_sponsor',
      'hole_sponsor_secondary',
      'the_turn',
      'leaderboard',
      'member_hub',
      'tournament_detail',
      'tournament_tab_schedule',
      'tournament_tab_match',
      'tournament_tab_teams'
    )
  );
