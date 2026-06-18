/**
 * Server-side match point computation from direct hole results.
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

function pointsFromWinTally(aWins: number, bWins: number): {
  match_winner: HoleWinner | null;
  match_points_a: number;
  match_points_b: number;
} {
  if (aWins > bWins) {
    return { match_winner: 'side_a', match_points_a: 1, match_points_b: 0 };
  }
  if (bWins > aWins) {
    return { match_winner: 'side_b', match_points_a: 0, match_points_b: 1 };
  }
  return { match_winner: 'tie', match_points_a: 0.5, match_points_b: 0.5 };
}

function countWins(rows: HoleResultRow[]): { side_a: number; side_b: number } {
  let side_a = 0;
  let side_b = 0;
  for (const row of rows) {
    if (row.hole_winner === 'side_a') side_a += 1;
    else if (row.hole_winner === 'side_b') side_b += 1;
  }
  return { side_a, side_b };
}

export function computeMatchPointsFromHoleResults(params: {
  format: string;
  matchGroup: MatchGroupRow;
  holeResults: HoleResultRow[];
}): {
  match_winner: HoleWinner | null;
  match_points_a: number;
  match_points_b: number;
} {
  const { format, matchGroup, holeResults } = params;

  if (format === 'singles' || format === 'match_play') {
    const pairCount = Math.min(
      matchGroup.side_a_player_ids.length,
      matchGroup.side_b_player_ids.length
    );

    let totalA = 0;
    let totalB = 0;

    for (let i = 0; i < pairCount; i++) {
      const pairingRows = holeResults.filter((r) => (r.pairing_index ?? 0) === i);
      const wins = countWins(pairingRows);
      const pairPoints = pointsFromWinTally(wins.side_a, wins.side_b);
      totalA += pairPoints.match_points_a;
      totalB += pairPoints.match_points_b;
    }

    if (totalA > totalB) {
      return { match_winner: 'side_a', match_points_a: totalA, match_points_b: totalB };
    }
    if (totalB > totalA) {
      return { match_winner: 'side_b', match_points_a: totalA, match_points_b: totalB };
    }
    return { match_winner: 'tie', match_points_a: totalA, match_points_b: totalB };
  }

  const teamRows = holeResults.filter((r) => (r.pairing_index ?? 0) === 0);
  const wins = countWins(teamRows);
  return pointsFromWinTally(wins.side_a, wins.side_b);
}
