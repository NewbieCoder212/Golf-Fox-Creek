/**
 * Verify Generation Cup Round 3 singles session scoring setup and logic.
 *
 * Run: cd backend && bun run scripts/verify-round3-singles-session.ts
 *
 * Checks:
 * 1. Round 3 match groups have 2 slot-matched players per side
 * 2. Saved hole results use pairing_index 0 and 1 (when present)
 * 3. Session vs overall scoring behaves correctly for in-progress and completed pairings
 */

import { allOutcomesToHoleResults } from '../../mobile/src/lib/match-hole-outcomes';
import { buildDeclaredSinglesPairingHoleResults } from '../../mobile/src/lib/singles-pairing-declare';
import { buildRoundSessionPointsLeaderboard } from '../../mobile/src/lib/tournament-session-scoring';
import { buildMatchPointsLeaderboardFromHoleResults } from '../../mobile/src/lib/tournament-service';
import type {
  Tournament,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentTeam,
} from '../../mobile/src/types';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const TOURNAMENT_ID = '107c086c-8edd-4859-aa54-7ec6a0e9daba';
const ROUND_NUMBER = 3;

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

type PlayerRow = { id: string; display_name: string };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function holeRow(
  matchGroupId: string,
  hole: number,
  winner: 'side_a' | 'side_b' | 'tie',
  pairingIndex: number
): TournamentMatchHoleResult {
  return {
    id: `sim-${matchGroupId}-${pairingIndex}-${hole}`,
    match_group_id: matchGroupId,
    round_number: ROUND_NUMBER,
    hole,
    side_a_net: 0,
    side_b_net: 0,
    hole_winner: winner,
    pairing_index: pairingIndex,
  };
}

function declaredWinRows(
  matchGroupId: string,
  winner: 'side_a' | 'side_b',
  pairingIndex: number
): TournamentMatchHoleResult[] {
  return buildDeclaredSinglesPairingHoleResults({
    matchGroupId,
    roundNumber: ROUND_NUMBER,
    pairingIndex,
    winner,
  }).map((row, index) => ({
    id: `sim-${matchGroupId}-${pairingIndex}-${index}`,
    ...row,
  }));
}

function inProgressRows(
  matchGroupId: string,
  pairingIndex: number,
  sideAWins: number,
  sideBWins: number
): TournamentMatchHoleResult[] {
  const rows: TournamentMatchHoleResult[] = [];
  let hole = 1;
  for (let i = 0; i < sideAWins; i += 1) {
    rows.push(holeRow(matchGroupId, hole, 'side_a', pairingIndex));
    hole += 1;
  }
  for (let i = 0; i < sideBWins; i += 1) {
    rows.push(holeRow(matchGroupId, hole, 'side_b', pairingIndex));
    hole += 1;
  }
  return rows;
}

async function verifyMatchGroups(
  groups: TournamentMatchGroup[],
  playerMap: Record<string, string>
): Promise<void> {
  console.log('\n--- 1. Round 3 match group layout ---');
  assert(groups.length > 0, 'No Round 3 match groups found');

  for (const group of groups) {
    const aLen = group.side_a_player_ids.length;
    const bLen = group.side_b_player_ids.length;
    assert(
      aLen === 2 && bLen === 2,
      `Group ${group.group_number}: expected 2 players per side, got A=${aLen} B=${bLen}`
    );
    assert(group.format === 'singles', `Group ${group.group_number}: format should be singles`);
    const aNames = group.side_a_player_ids.map((id) => playerMap[id] ?? id.slice(0, 8));
    const bNames = group.side_b_player_ids.map((id) => playerMap[id] ?? id.slice(0, 8));
    console.log(
      `  Group ${group.group_number}: A[${aNames.join(', ')}] vs B[${bNames.join(', ')}]`
    );
  }
  console.log(`PASS: ${groups.length} groups, all 2-per-side singles`);
}

function verifySavePayloadPairingIndex(matchGroupId: string): void {
  const rows = allOutcomesToHoleResults({
    matchGroupId,
    roundNumber: ROUND_NUMBER,
    pairingOutcomes: {
      0: { 1: 'side_a', 2: 'side_b' },
      1: { 1: 'tie', 3: 'side_b' },
    },
  });
  const indices = [...new Set(rows.map((row) => row.pairing_index ?? 0))].sort();
  assert(
    indices.length === 2 && indices[0] === 0 && indices[1] === 1,
    `Save payload should emit pairing_index 0 and 1, got [${indices.join(', ')}]`
  );
  console.log('  Save payload: pairing_index 0 and 1 emitted correctly (allOutcomesToHoleResults)');
}

async function verifyHoleResults(
  groups: TournamentMatchGroup[],
  holeResults: TournamentMatchHoleResult[]
): Promise<void> {
  console.log('\n--- 2. Hole results pairing_index ---');

  const groupIds = new Set(groups.map((g) => g.id));
  const r3Results = holeResults.filter((row) => groupIds.has(row.match_group_id));

  if (r3Results.length === 0) {
    console.log('  No Round 3 hole results saved yet (play has not started or no saves).');
    verifySavePayloadPairingIndex(groups[0]!.id);
    console.log('  SKIP live DB check — will pass once first scores are saved.');
    return;
  }

  const byGroup = new Map<string, Map<number, number>>();
  for (const row of r3Results) {
    const idx = row.pairing_index ?? 0;
    assert(idx === 0 || idx === 1, `Unexpected pairing_index ${idx} in group ${row.match_group_id}`);
    if (!byGroup.has(row.match_group_id)) byGroup.set(row.match_group_id, new Map());
    const map = byGroup.get(row.match_group_id)!;
    map.set(idx, (map.get(idx) ?? 0) + 1);
  }

  for (const group of groups) {
    const stats = byGroup.get(group.id);
    if (!stats) continue;
    const idx0 = stats.get(0) ?? 0;
    const idx1 = stats.get(1) ?? 0;
    console.log(`  Group ${group.group_number}: pairing_index 0=${idx0} holes, 1=${idx1} holes`);
    if (idx0 > 0 && idx1 > 0) {
      console.log(`    PASS: both pairings have hole results`);
    } else if (idx0 > 0 || idx1 > 0) {
      console.log(`    NOTE: only one pairing started so far (in progress)`);
    }
  }

  console.log(`PASS: ${r3Results.length} hole rows, pairing_index values are 0 or 1 only`);
}

function verifySessionVsOverall(
  tournament: Tournament,
  teams: TournamentTeam[],
  sampleGroup: TournamentMatchGroup
): void {
  console.log('\n--- 3. Session vs overall scoring simulation ---');

  const sideAName = teams.find((t) => t.side === 'side_a')?.team_name ?? 'Depends';
  const sideBName = teams.find((t) => t.side === 'side_b')?.team_name ?? 'Diapers';

  const gid = sampleGroup.id;

  // Scenario A: both pairings in progress (A leads pairing 0, B leads pairing 1)
  const inProgressHoles = [
    ...inProgressRows(gid, 0, 3, 1), // A1 2 UP through 4
    ...inProgressRows(gid, 1, 1, 2), // A2 1 DOWN through 3
  ];

  const sessionInProgress = buildRoundSessionPointsLeaderboard(
    teams,
    [sampleGroup],
    inProgressHoles,
    tournament,
    sideAName,
    sideBName
  );
  const sideAInProgress = sessionInProgress.find((t) => t.side === 'side_a')?.matchPoints ?? 0;
  const sideBInProgress = sessionInProgress.find((t) => t.side === 'side_b')?.matchPoints ?? 0;
  assert(sideAInProgress === 1, `Expected session A=1 (pairing0 lead), got ${sideAInProgress}`);
  assert(sideBInProgress === 1, `Expected session B=1 (pairing1 lead), got ${sideBInProgress}`);
  console.log(`  In-progress: session ${sideAName}=${sideAInProgress}, ${sideBName}=${sideBInProgress}`);

  const overallInProgress = buildMatchPointsLeaderboardFromHoleResults(
    teams,
    [sampleGroup],
    inProgressHoles,
    { tournament }
  );
  const overallA = overallInProgress.find((t) => t.side === 'side_a')?.matchPoints ?? 0;
  const overallB = overallInProgress.find((t) => t.side === 'side_b')?.matchPoints ?? 0;
  assert(overallA === 0 && overallB === 0, 'In-progress matches should not count in overall yet');
  console.log(`  In-progress: overall ${sideAName}=${overallA}, ${sideBName}=${overallB} (none final)`);

  // Scenario B: pairing 0 complete (A wins), pairing 1 still in progress (B leads)
  const mixedHoles = [
    ...declaredWinRows(gid, 'side_a', 0),
    ...inProgressRows(gid, 1, 1, 2),
  ];

  const sessionMixed = buildRoundSessionPointsLeaderboard(
    teams,
    [sampleGroup],
    mixedHoles,
    tournament,
    sideAName,
    sideBName
  );
  const sessionMixedB = sessionMixed.find((t) => t.side === 'side_b')?.matchPoints ?? 0;
  const sessionMixedA = sessionMixed.find((t) => t.side === 'side_a')?.matchPoints ?? 0;
  assert(
    sessionMixedA === 0,
    `Completed pairing should leave session A=0, got ${sessionMixedA}`
  );
  assert(
    sessionMixedB === 1,
    `In-progress pairing 1 B lead should give session B=1, got ${sessionMixedB}`
  );
  console.log(`  Mixed: session ${sideAName}=${sessionMixedA}, ${sideBName}=${sessionMixedB}`);

  const overallMixed = buildMatchPointsLeaderboardFromHoleResults(
    teams,
    [sampleGroup],
    mixedHoles,
    { tournament }
  );
  const overallMixedA = overallMixed.find((t) => t.side === 'side_a')?.matchPoints ?? 0;
  const overallMixedB = overallMixed.find((t) => t.side === 'side_b')?.matchPoints ?? 0;
  assert(overallMixedA === 1, `Completed pairing 0 should give overall A=1, got ${overallMixedA}`);
  assert(overallMixedB === 0, `Incomplete pairing 1 should not add overall B yet, got ${overallMixedB}`);
  console.log(`  Mixed: overall ${sideAName}=${overallMixedA}, ${sideBName}=${overallMixedB}`);

  // Scenario C: both pairings complete
  const completeHoles = [
    ...declaredWinRows(gid, 'side_a', 0),
    ...declaredWinRows(gid, 'side_b', 1),
  ];

  const sessionComplete = buildRoundSessionPointsLeaderboard(
    teams,
    [sampleGroup],
    completeHoles,
    tournament,
    sideAName,
    sideBName
  );
  const sessionCompleteTotal =
    (sessionComplete.find((t) => t.side === 'side_a')?.matchPoints ?? 0) +
    (sessionComplete.find((t) => t.side === 'side_b')?.matchPoints ?? 0);
  assert(sessionCompleteTotal === 0, 'All pairings complete → session should be 0 total');
  console.log(`  Complete: session total points = ${sessionCompleteTotal}`);

  const overallComplete = buildMatchPointsLeaderboardFromHoleResults(
    teams,
    [sampleGroup],
    completeHoles,
    { tournament }
  );
  const overallCompleteA = overallComplete.find((t) => t.side === 'side_a')?.matchPoints ?? 0;
  const overallCompleteB = overallComplete.find((t) => t.side === 'side_b')?.matchPoints ?? 0;
  assert(overallCompleteA === 1, `Both done: overall A=1, got ${overallCompleteA}`);
  assert(overallCompleteB === 1, `Both done: overall B=1, got ${overallCompleteB}`);
  console.log(`  Complete: overall ${sideAName}=${overallCompleteA}, ${sideBName}=${overallCompleteB}`);

  console.log('PASS: session tracks in-progress pairings; overall accumulates completed pairings');
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env in backend/.env');
    process.exit(1);
  }

  const [tournamentRows, teams, groups, players, allHoleResults] = await Promise.all([
    adminFetch<Tournament[]>(
      `/rest/v1/tournaments?id=eq.${TOURNAMENT_ID}&select=id,name,round_schedule,rounds_count,start_date,match_use_net_scoring`
    ),
    adminFetch<TournamentTeam[]>(
      `/rest/v1/tournament_teams?tournament_id=eq.${TOURNAMENT_ID}&select=id,team_name,side`
    ),
    adminFetch<TournamentMatchGroup[]>(
      `/rest/v1/tournament_match_groups?tournament_id=eq.${TOURNAMENT_ID}&round_number=eq.${ROUND_NUMBER}&select=*&order=group_number.asc`
    ),
    adminFetch<PlayerRow[]>(
      `/rest/v1/tournament_players?tournament_id=eq.${TOURNAMENT_ID}&select=id,display_name`
    ),
    adminFetch<TournamentMatchHoleResult[]>(
      `/rest/v1/tournament_match_hole_results?round_number=eq.${ROUND_NUMBER}&select=id,match_group_id,round_number,hole,hole_winner,pairing_index,side_a_net,side_b_net`
    ),
  ]);

  const tournament = tournamentRows[0];
  if (!tournament) {
    console.error('Tournament not found');
    process.exit(1);
  }

  const round3Format = tournament.round_schedule.flatMap((d) => d.formats)[2];
  console.log(`Tournament: ${tournament.name}`);
  console.log(`Round 3 format from schedule: ${round3Format ?? 'unknown'}`);
  assert(round3Format === 'singles', `Round 3 schedule format should be singles, got ${round3Format}`);

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p.display_name]));

  await verifyMatchGroups(groups, playerMap);
  await verifyHoleResults(groups, allHoleResults);
  verifySessionVsOverall(tournament, teams, groups[0]!);

  console.log('\n=== ALL CHECKS PASSED ===');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
