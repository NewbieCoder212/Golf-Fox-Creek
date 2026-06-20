/**
 * Audit Generation Cup overall standings data for TV display.
 * Run: cd backend && bun run scripts/audit-generation-cup-standings.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const TOURNAMENT_ID = '107c086c-8edd-4859-aa54-7ec6a0e9daba';

async function adminFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env in backend/.env');
    process.exit(1);
  }

  const groupRows = await adminFetch<Array<{ id: string }>>(
    `/rest/v1/tournament_match_groups?tournament_id=eq.${TOURNAMENT_ID}&select=id`
  );
  const groupIds = groupRows.map((row) => row.id).join(',');

  const [groups, holeResults] = await Promise.all([
    adminFetch<
      Array<{
        id: string;
        round_number: number;
        group_number: number;
        format: string;
        match_winner: string | null;
        match_points_a: number;
        match_points_b: number;
        match_result_declared: boolean;
      }>
    >(
      `/rest/v1/tournament_match_groups?tournament_id=eq.${TOURNAMENT_ID}&select=id,round_number,group_number,format,match_winner,match_points_a,match_points_b,match_result_declared&order=round_number.asc,group_number.asc`
    ),
    groupIds
      ? adminFetch<Array<{ match_group_id: string }>>(
          `/rest/v1/tournament_match_hole_results?select=match_group_id&match_group_id=in.(${groupIds})`
        )
      : Promise.resolve([]),
  ]);

  const holesByGroup = new Map<string, number>();
  for (const row of holeResults) {
    holesByGroup.set(row.match_group_id, (holesByGroup.get(row.match_group_id) ?? 0) + 1);
  }

  let ptsA = 0;
  let ptsB = 0;

  for (const round of [1, 2, 3]) {
    const roundGroups = groups.filter((group) => group.round_number === round);
    const withWinner = roundGroups.filter((group) => group.match_winner != null);
    const withHoles = roundGroups.filter((group) => (holesByGroup.get(group.id) ?? 0) > 0);
    console.log(
      `Round ${round} (${roundGroups[0]?.format ?? '?'}): ${roundGroups.length} matches, ` +
        `${withWinner.length} with winner, ${withHoles.length} with hole results`
    );
  }

  console.log('\nRecorded cup points (match_winner rows only):');
  for (const group of groups) {
    if (group.match_winner == null) continue;
    ptsA += group.match_points_a ?? 0;
    ptsB += group.match_points_b ?? 0;
    console.log(
      `  R${group.round_number} G${group.group_number}: ${group.match_winner} (${group.match_points_a}-${group.match_points_b})` +
        (group.match_result_declared ? ' declared' : '')
    );
  }

  console.log(`\nOverall from DB winners: Diapers ${ptsA} – Depends ${ptsB}`);
  console.log(
    '\nIf yesterday was 7–5, declare Round 1 results in Admin → Matches or run:\n' +
      '  DIAPERS_WINS=7 bun run scripts/declare-generation-cup-round1-session.ts --apply'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
