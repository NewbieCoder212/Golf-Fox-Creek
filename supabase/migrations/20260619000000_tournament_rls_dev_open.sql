-- Tournament tables: disable RLS for development (matches 20260614000000 intent).
-- RLS was blocking inserts — created tournaments never saved.

ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_tee_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE wagering_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_match_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_match_hole_results DISABLE ROW LEVEL SECURITY;
