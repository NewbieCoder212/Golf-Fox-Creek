-- Add member_hub placement type for home screen sponsor banners

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
      'member_hub'
    )
  );
