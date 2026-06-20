/**
 * Declare Round 1 (best ball) session results for Generation Cup TV overall standings.
 * Use when yesterday's session total is known but per-match rows were cleared.
 *
 * Run: cd backend && DIAPERS_WINS=7 bun run scripts/declare-generation-cup-round1-session.ts
 * Dry run (default): add --apply to write to Supabase
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const TOURNAMENT_ID = '107c086c-8edd-4859-aa54-7ec6a0e9daba';
const DIAPERS_WINS = Number(process.env.DIAPERS_WINS ?? '7');
const APPLY = process.argv.includes('--apply');

type MatchGroup = {
  id: string;
  group_number: number;
  round_number: number;
  match_winner: string | null;
  match_points_a: number;
  match_points_b: number;
};

async function adminFetch<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function declaredPoints(winner: 'side_a' | 'side_b') {
  if (winner === 'side_a') {
    return { match_winner: 'side_a', match_points_a: 1, match_points_b: 0 };
  }
  return { match_winner: 'side_b', match_points_a: 0, match_points_b: 1 };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env in backend/.env');
    process.exit(1);
  }

  const groups = await adminFetch<MatchGroup[]>(
    `/rest/v1/tournament_match_groups?tournament_id=eq.${TOURNAMENT_ID}&round_number=eq.1&select=id,group_number,round_number,match_winner,match_points_a,match_points_b&order=group_number.asc`
  );

  if (groups.length === 0) {
    console.error('No round 1 match groups found.');
    process.exit(1);
  }

  if (DIAPERS_WINS < 0 || DIAPERS_WINS > groups.length) {
    console.error(`DIAPERS_WINS must be between 0 and ${groups.length}`);
    process.exit(1);
  }

  const dependsWins = groups.length - DIAPERS_WINS;
  console.log(
    `Round 1 session target: Diapers ${DIAPERS_WINS} – Depends ${dependsWins} (${groups.length} matches)`
  );
  console.log(APPLY ? 'Applying…' : 'Dry run — pass --apply to write\n');

  let diapersPoints = 0;
  let dependsPoints = 0;

  for (const [index, group] of groups.entries()) {
    const winner: 'side_a' | 'side_b' = index < DIAPERS_WINS ? 'side_a' : 'side_b';
    const points = declaredPoints(winner);
    if (winner === 'side_a') diapersPoints += 1;
    else dependsPoints += 1;

    console.log(
      `G${group.group_number}: ${winner === 'side_a' ? 'Diapers' : 'Depends'} win` +
        (group.match_winner ? ` (was ${group.match_winner})` : '')
    );

    if (!APPLY) continue;

    await adminFetch(`/rest/v1/tournament_match_groups?id=eq.${group.id}`, {
      method: 'PATCH',
      body: {
        ...points,
        match_result_declared: true,
      },
    });
  }

  console.log(`\nSession totals: Diapers ${diapersPoints} – Depends ${dependsPoints}`);
  if (!APPLY) {
    console.log('\nRe-run with --apply to save. Then refresh the TV link.');
  } else {
    console.log('\nDone. Refresh http://localhost:8081/tv/generation-cup');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
