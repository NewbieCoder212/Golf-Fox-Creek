/**
 * Inspect Generation Cup match score sync for TV display (no secrets printed).
 * Run: cd backend && bun run scripts/inspect-generation-cup-tv-sync.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const TOURNAMENT_ID = '107c086c-8edd-4859-aa54-7ec6a0e9daba';
const TEST_EMAIL = 'test.diapers.1@foxcreek.golf';

async function adminFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<T>;
}

type Player = { id: string; display_name: string; user_id: string | null };
type MatchGroup = {
  id: string;
  round_number: number;
  format: string;
  tee_time: string;
  side_a_player_ids: string[];
  side_b_player_ids: string[];
  match_winner: string | null;
};
type Score = {
  id: string;
  round_number: number;
  match_group_id: string | null;
  user_id: string | null;
  hole_scores: Array<{ hole: number; gross?: number; net?: number; entered?: boolean }> | null;
  created_at: string;
};

function throughHole(holeScores: Score['hole_scores']): number {
  let max = 0;
  for (const h of holeScores ?? []) {
    if (h.entered === false) continue;
    if ((h.gross ?? h.net) != null) max = Math.max(max, h.hole);
  }
  return max;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env in backend/.env');
    process.exit(1);
  }

  const [tournament, players, groups, scores] = await Promise.all([
    adminFetch<Array<{ name: string; match_use_net_scoring: boolean; display_token: string }>>(
      `/rest/v1/tournaments?id=eq.${TOURNAMENT_ID}&select=name,match_use_net_scoring,display_token`
    ),
    adminFetch<Player[]>(
      `/rest/v1/tournament_players?tournament_id=eq.${TOURNAMENT_ID}&select=id,display_name,user_id`
    ),
    adminFetch<MatchGroup[]>(
      `/rest/v1/tournament_match_groups?tournament_id=eq.${TOURNAMENT_ID}&select=id,round_number,format,tee_time,side_a_player_ids,side_b_player_ids,match_winner&order=tee_time.asc`
    ),
    adminFetch<Score[]>(
      `/rest/v1/tournament_scores?tournament_id=eq.${TOURNAMENT_ID}&select=id,round_number,match_group_id,user_id,hole_scores,created_at&order=created_at.desc`
    ),
  ]);

  const t = tournament[0];
  if (!t) {
    console.error('Tournament not found');
    process.exit(1);
  }

  const diapersPlayer = players.find((p) => p.display_name.toLowerCase().includes('diapers'));
  const diapersUserScores = scores.filter((s) => s.user_id && diapersPlayer?.user_id === s.user_id);

  const matchForDiapers = groups.find(
    (g) =>
      diapersPlayer &&
      (g.side_a_player_ids.includes(diapersPlayer.id) ||
        g.side_b_player_ids.includes(diapersPlayer.id))
  );

  const scoresForMatch = matchForDiapers
    ? scores.filter((s) => s.match_group_id === matchForDiapers.id)
    : [];

  console.log(`Tournament: ${t.name}`);
  console.log(`Match net scoring: ${t.match_use_net_scoring}`);
  console.log(`Match groups: ${groups.length}`);
  console.log(`Total score rows: ${scores.length}`);
  console.log(`Scores linked to match_group_id: ${scores.filter((s) => s.match_group_id).length}`);

  if (diapersPlayer) {
    console.log(`\nTest player: ${diapersPlayer.display_name} (${diapersPlayer.id})`);
  } else {
    console.log(`\nTest player not found for ${TEST_EMAIL}`);
  }

  if (matchForDiapers) {
    console.log(
      `\nDiapers match: round ${matchForDiapers.round_number} ${matchForDiapers.format} @ ${matchForDiapers.tee_time}`
    );
    console.log(`Match group id: ${matchForDiapers.id}`);
    console.log(`Score rows for this match: ${scoresForMatch.length}`);
    for (const s of scoresForMatch) {
      console.log(
        `  user ${s.user_id?.slice(0, 8) ?? 'team'}… through hole ${throughHole(s.hole_scores)} (created ${s.created_at})`
      );
    }
  }

  if (diapersUserScores.length > 0) {
    const latest = diapersUserScores[0]!;
    console.log(
      `\nLatest diapers user score: match_group_id=${latest.match_group_id ?? 'MISSING'} through=${throughHole(latest.hole_scores)}`
    );
    if (!latest.match_group_id) {
      console.log('WARNING: score row missing match_group_id — TV grids will not sync this match.');
    }
  }

  console.log(`\nTV path: /display/tournament/${TOURNAMENT_ID}?token=<display_token from admin>`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
