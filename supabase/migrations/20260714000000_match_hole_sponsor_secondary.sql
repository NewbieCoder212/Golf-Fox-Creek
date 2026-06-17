-- Second per-hole sponsor slot during match score entry (holes 1–18)

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
      'tournament_detail'
    )
  );
