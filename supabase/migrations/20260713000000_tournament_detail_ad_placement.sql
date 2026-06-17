-- Add tournament_detail placement type for sponsor banners on event detail screens

ALTER TABLE ad_placements
  DROP CONSTRAINT IF EXISTS ad_placements_placement_type_check;

ALTER TABLE ad_placements
  ADD CONSTRAINT ad_placements_placement_type_check
  CHECK (
    placement_type IN (
      'scorecard_header',
      'hole_sponsor',
      'the_turn',
      'leaderboard',
      'member_hub',
      'tournament_detail'
    )
  );
