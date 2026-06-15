-- ============================================
-- FOX CREEK GOLF CLUB - TV DISPLAY LEADERBOARD
-- display_token on tournaments, sponsor positions, realtime + public read
-- Date: 2026-06-28
-- ============================================

-- Secret token embedded in TV display URLs (rotatable by managers)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS display_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_display_token
  ON tournaments (display_token);

-- Sponsor slot position for leaderboard / TV surfaces
ALTER TABLE ad_placements
  ADD COLUMN IF NOT EXISTS display_position TEXT;

ALTER TABLE ad_placements
  DROP CONSTRAINT IF EXISTS ad_placements_display_position_check;

ALTER TABLE ad_placements
  ADD CONSTRAINT ad_placements_display_position_check
  CHECK (
    display_position IS NULL
    OR display_position IN ('header_left', 'sidebar', 'footer')
  );

CREATE INDEX IF NOT EXISTS idx_ad_placements_leaderboard_position
  ON ad_placements (placement_type, display_position, is_active)
  WHERE placement_type = 'leaderboard';

-- Realtime for live TV standings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_scores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_match_groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_match_groups;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_match_hole_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_match_hole_results;
  END IF;
END $$;

-- Anonymous read for TV display + Realtime (active/recent tournaments only)
DROP POLICY IF EXISTS "Public read tournaments for TV display" ON tournaments;
CREATE POLICY "Public read tournaments for TV display" ON tournaments
  FOR SELECT TO anon, authenticated
  USING (
    end_date >= CURRENT_DATE - INTERVAL '30 days'
    AND start_date <= CURRENT_DATE + INTERVAL '7 days'
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
    )
  );
