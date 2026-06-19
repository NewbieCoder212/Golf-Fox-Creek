/**
 * Server-side match point computation from direct hole results.
 * Cup points are only persisted when a match-play contest is actually complete.
 */

type HoleWinner = 'side_a' | 'side_b' | 'tie';

type HoleResultRow = {
  hole: number;
  hole_winner: HoleWinner;
  pairing_index?: number;
};

type MatchGroupRow = {
  side_a_player_ids: string[];
  side_b_player_ids: string[];
};

type PersistedCupPoints = {
  match_winner: HoleWinner | null;
  match_points_a: number;
  match_points_b: number;
};

const EMPTY_PERSISTED_CUP_POINTS: PersistedCupPoints = {
  match_winner: null,
  match_points_a: 0,
  match_points_b: 0,
};

function computeMatchLeadFromResults(
  results: HoleResultRow[],
  throughHole: number = 18
): number {
  let lead = 0;
  for (const row of results) {
    if (row.hole > throughHole) continue;
    if (row.hole_winner === 'side_a') lead += 1;
    else if (row.hole_winner === 'side_b') lead -= 1;
  }
  return lead;
}

function computeLiveMatchStatus(holeResults: HoleResultRow[]) {
  const sorted = [...holeResults].sort((a, b) => a.hole - b.hole);
  const lead = computeMatchLeadFromResults(sorted);
  const throughHole = sorted.length > 0 ? Math.max(...sorted.map((row) => row.hole)) : 0;
  const holesRemaining = Math.max(0, 18 - throughHole);
  const clinched = lead !== 0 && Math.abs(lead) > holesRemaining;

  return { lead, throughHole, clinched };
}

function isMatchActuallyComplete(
  matchStatus: ReturnType<typeof computeLiveMatchStatus>,
  _holeResultCount: number
): boolean {
  if (matchStatus.clinched) return true;
  return matchStatus.throughHole >= 18;
}

function cupPointsFromMatchPlayLead(lead: number): PersistedCupPoints {
  if (lead > 0) {
    return { match_winner: 'side_a', match_points_a: 1, match_points_b: 0 };
  }
  if (lead < 0) {
    return { match_winner: 'side_b', match_points_a: 0, match_points_b: 1 };
  }
  return { match_winner: 'tie', match_points_a: 0.5, match_points_b: 0.5 };
}

function persistedCupPointsForHoleResults(holeResults: HoleResultRow[]): PersistedCupPoints {
  if (holeResults.length === 0) {
    return { ...EMPTY_PERSISTED_CUP_POINTS };
  }

  const matchStatus = computeLiveMatchStatus(holeResults);
  if (!isMatchActuallyComplete(matchStatus, holeResults.length)) {
    return { ...EMPTY_PERSISTED_CUP_POINTS };
  }

  return cupPointsFromMatchPlayLead(matchStatus.lead);
}

function isSinglesFormat(format: string): boolean {
  return format === 'singles' || format === 'singles_match_play';
}

function aggregateSinglesCupPoints(
  matchGroup: MatchGroupRow,
  holeResults: HoleResultRow[]
): PersistedCupPoints {
  const pairCount = Math.min(
    matchGroup.side_a_player_ids.length,
    matchGroup.side_b_player_ids.length
  );

  let totalA = 0;
  let totalB = 0;

  for (let index = 0; index < pairCount; index += 1) {
    const pairingRows = holeResults.filter((row) => (row.pairing_index ?? 0) === index);
    const pairPoints = persistedCupPointsForHoleResults(pairingRows);
    totalA += pairPoints.match_points_a;
    totalB += pairPoints.match_points_b;
  }

  if (totalA === 0 && totalB === 0) {
    return { ...EMPTY_PERSISTED_CUP_POINTS };
  }

  if (totalA > totalB) {
    return { match_winner: 'side_a', match_points_a: totalA, match_points_b: totalB };
  }
  if (totalB > totalA) {
    return { match_winner: 'side_b', match_points_a: totalA, match_points_b: totalB };
  }
  return { match_winner: 'tie', match_points_a: totalA, match_points_b: totalB };
}

export function computeMatchPointsFromHoleResults(params: {
  format: string;
  matchGroup: MatchGroupRow;
  holeResults: HoleResultRow[];
}): PersistedCupPoints {
  const { format, matchGroup, holeResults } = params;

  if (isSinglesFormat(format)) {
    return aggregateSinglesCupPoints(matchGroup, holeResults);
  }

  const teamRows = holeResults.filter((row) => (row.pairing_index ?? 0) === 0);
  return persistedCupPointsForHoleResults(teamRows);
}
