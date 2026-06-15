export function sumHoles(
  holeScores: Record<number, number | null>,
  fromHole: number,
  toHole: number
): number | null {
  let total = 0;
  let hasScore = false;

  for (let hole = fromHole; hole <= toHole; hole++) {
    const score = holeScores[hole];
    if (score !== null && score !== undefined) {
      total += score;
      hasScore = true;
    }
  }

  return hasScore ? total : null;
}

export interface PlayerNineTotals {
  out: number | null;
  in: number | null;
  total: number | null;
}

export function computePlayerNineTotals(
  holeScores: Record<number, number | null>
): PlayerNineTotals {
  const out = sumHoles(holeScores, 1, 9);
  const inScore = sumHoles(holeScores, 10, 18);

  let total: number | null = null;
  if (out !== null && inScore !== null) {
    total = out + inScore;
  } else if (out !== null || inScore !== null) {
    total = (out ?? 0) + (inScore ?? 0);
  }

  return { out, in: inScore, total };
}

export function computeNineTotals(
  playerIds: string[],
  scores: Record<string, Record<number, number | null>>
): Record<string, PlayerNineTotals> {
  const totals: Record<string, PlayerNineTotals> = {};

  for (const playerId of playerIds) {
    totals[playerId] = computePlayerNineTotals(scores[playerId] ?? {});
  }

  return totals;
}

export function sumParForHoles(holePars: Record<number, number>, from: number, to: number): number {
  let total = 0;
  for (let hole = from; hole <= to; hole++) {
    total += holePars[hole] ?? 0;
  }
  return total;
}
