import { Hono } from 'hono';
import { adminFetch, isSupabaseAdminConfigured } from '../lib/supabase-admin';
import { buildTournamentDisplayPayload } from '../lib/tournament-display';

const displayRouter = new Hono();

async function fetchRows<T>(path: string): Promise<T[]> {
  const { ok, data } = await adminFetch<T[] | T>(path);
  if (!ok) return [];
  return Array.isArray(data) ? data : data ? [data] : [];
}

displayRouter.get('/tournament/:id', async (c) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: 'Display service is not configured' }, 503);
  }

  const tournamentId = c.req.param('id');
  const token = c.req.query('token')?.trim();

  if (!token) {
    return c.json({ error: 'Missing display token' }, 401);
  }

  const tournaments = await fetchRows<{
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    display_token: string;
    round_schedule: Array<{ formats: string[] }>;
    rounds_count: number;
    match_use_net_scoring: boolean;
  }>(
    `/rest/v1/tournaments?id=eq.${tournamentId}&display_token=eq.${token}&select=id,name,start_date,end_date,display_token,round_schedule,rounds_count,match_use_net_scoring`
  );

  const tournament = tournaments[0];
  if (!tournament) {
    return c.json({ error: 'Tournament not found or invalid token' }, 404);
  }

  const matchGroupSelect =
    'id,tournament_id,round_number,format,side_a_team_id,side_b_team_id,side_a_player_ids,side_b_player_ids,tee_time,starting_hole,group_number,notes,match_winner,match_points_a,match_points_b,created_at';

  const [teams, players, scores, matchGroups, fullMatchGroups, ads] = await Promise.all([
    fetchRows(`/rest/v1/tournament_teams?tournament_id=eq.${tournamentId}&select=id,tournament_id,team_name,side`),
    fetchRows(`/rest/v1/tournament_players?tournament_id=eq.${tournamentId}&select=id,tournament_id,display_name`),
    fetchRows(
      `/rest/v1/tournament_scores?tournament_id=eq.${tournamentId}&select=id,tournament_id,team_id,tournament_player_id,user_id,match_group_id,round_number,hole_scores,total_gross,total_net,created_at&order=round_number.asc`
    ),
    fetchRows(
      `/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=tournament_id,side_a_team_id,side_b_team_id,match_points_a,match_points_b,match_winner`
    ),
    fetchRows(
      `/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=${matchGroupSelect}&order=round_number.asc,tee_time.asc,group_number.asc`
    ),
    fetchRows(
      `/rest/v1/ad_placements?placement_type=eq.leaderboard&is_active=eq.true&order=created_at.desc&select=id,sponsor_name,placement_type,image_url,banner_text,action_url,display_position,is_active`
    ),
  ]);

  const matchGroupIds = await fetchRows<{ id: string }>(
    `/rest/v1/tournament_match_groups?tournament_id=eq.${tournamentId}&select=id`
  );

  let holeResults: { hole_winner: 'side_a' | 'side_b' | 'tie' }[] = [];
  let fullHoleResults: Array<{
    id: string;
    match_group_id: string;
    round_number: number;
    hole: number;
    hole_winner: 'side_a' | 'side_b' | 'tie';
    pairing_index?: number;
    side_a_net?: number | null;
    side_b_net?: number | null;
  }> = [];
  if (matchGroupIds.length > 0) {
    const ids = matchGroupIds.map((row) => row.id).join(',');
    holeResults = await fetchRows(
      `/rest/v1/tournament_match_hole_results?match_group_id=in.(${ids})&select=hole_winner`
    );
    fullHoleResults = await fetchRows(
      `/rest/v1/tournament_match_hole_results?match_group_id=in.(${ids})&select=id,match_group_id,round_number,hole,hole_winner,pairing_index,side_a_net,side_b_net&order=round_number.asc,hole.asc`
    );
  }

  const payload = buildTournamentDisplayPayload({
    tournament,
    teams: teams as never,
    players: players as never,
    scores: scores as never,
    matchGroups: matchGroups as never,
    holeResults,
    ads: ads as never,
    fullMatchGroups: fullMatchGroups as never,
    fullScores: scores as never,
    fullHoleResults: fullHoleResults as never,
  });

  return c.json(payload);
});

export { displayRouter };
